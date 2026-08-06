import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView,
  Platform, Dimensions, Modal, Animated, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import MapView, { Marker, Polygon, Polyline } from '../../components/MapViewWrapper';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { dataService } from '../../services/dataService';
import { askAIAssistant } from '../../services/aiService';

const { width: SW } = Dimensions.get('window');

interface MapPoint { latitude: number; longitude: number; }
interface SearchResult { place_id: number; display_name: string; lat: string; lon: string; }
interface SoilData {
  type: string;
  clay: number;
  sand: number;
  silt: number;
  ph: number;
  organic: number;
  health_score?: number;
  source?: 'isric' | 'estimated';
  loading: boolean;
  error: boolean;
}

interface WaterData {
  moisture0to7: number;
  moisture7to28: number;
  source?: 'gee' | 'open-meteo';
  loading: boolean;
  error: boolean;
}

const CROPS = [
  { name: 'Rice', emoji: '🌾', nepaliName: 'धान' },
  { name: 'Maize', emoji: '🌽', nepaliName: 'मकै' },
  { name: 'Wheat', emoji: '🌾', nepaliName: 'गहुँ' },
  { name: 'Potato', emoji: '🥔', nepaliName: 'आलु' },
  { name: 'Mustard', emoji: '🟡', nepaliName: 'तोरी' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const DAY_HEADER_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const getSuggestedCrops = (month: number): string[] => {
  switch (month) {
    case 5: // June
    case 6: // July
    case 7: // August
      return ['Rice', 'Maize'];
    case 8: // September
      return ['Potato', 'Mustard', 'Maize'];
    case 9: // October
    case 10: // November
      return ['Wheat', 'Potato', 'Mustard'];
    case 11: // December
    case 0:  // January
      return ['Wheat', 'Potato'];
    case 1:  // February
    case 2:  // March
      return ['Maize', 'Wheat'];
    case 3:  // April
    case 4:  // May
      return ['Maize', 'Rice'];
    default:
      return ['Rice', 'Maize', 'Wheat', 'Potato', 'Mustard'];
  }
};

const sortByAngle = (pts: MapPoint[]): MapPoint[] => {
  if (pts.length < 3) return pts;
  const cx = pts.reduce((s, p) => s + p.latitude, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.longitude, 0) / pts.length;
  return [...pts].sort((a, b) =>
    Math.atan2(a.latitude - cx, a.longitude - cy) - Math.atan2(b.latitude - cx, b.longitude - cy)
  );
};

const toRad = (v: number) => (v * Math.PI) / 180;
const sphericalArea = (c: MapPoint[]): number => {
  if (c.length < 3) return 0;
  const R = 6378137;
  let s = 0;
  for (let i = 0; i < c.length; i++) {
    const p1 = c[i], p2 = c[(i + 1) % c.length];
    s += (toRad(p2.longitude) - toRad(p1.longitude)) * (2 + Math.sin(toRad(p1.latitude)) + Math.sin(toRad(p2.latitude)));
  }
  return Math.abs((s * R * R) / 2);
};

const classifySoil = (clay: number, sand: number, silt: number): string => {
  if (clay >= 40) return 'Clay';
  if (sand >= 85) return 'Sandy';
  if (silt >= 80) return 'Silty';
  if (clay >= 27 && sand <= 45) return 'Clay Loam';
  if (sand >= 50 && clay >= 20) return 'Sandy Clay Loam';
  if (silt >= 50 && clay < 27) return 'Silt Loam';
  if (sand >= 43 && clay < 20) return 'Sandy Loam';
  return 'Loamy';
};

const calibrateWaterMoisture = (
  rawMoisture: number,
  clay: number,
  sand: number,
  silt: number
): number => {
  if (clay === 0 && sand === 0 && silt === 0) return rawMoisture;
  const refWP = 15;
  const refFC = 35;
  const localWP = 5 * (sand / 100) + 15 * (silt / 100) + 25 * (clay / 100);
  const localFC = 15 * (sand / 100) + 32 * (silt / 100) + 45 * (clay / 100);
  let calibrated = rawMoisture;
  if (rawMoisture <= refWP) {
    const factor = rawMoisture / refWP;
    calibrated = factor * localWP;
  } else if (rawMoisture >= refFC) {
    const excess = (rawMoisture - refFC) / (100 - refFC);
    const maxPorosity = 45 * (clay / 100) + 40 * (silt / 100) + 35 * (sand / 100);
    calibrated = localFC + excess * (maxPorosity - localFC);
  } else {
    const percentOfRange = (rawMoisture - refWP) / (refFC - refWP);
    calibrated = localWP + percentOfRange * (localFC - localWP);
  }
  return Math.max(2, Math.min(55, calibrated));
};

const getEstimatedSoil = (lat: number, lon: number): SoilData => {
  const seed = Math.sin(lat * 1000 + lon * 10000);
  const hash = (min: number, max: number, offset = 0) => {
    const val = Math.abs(Math.sin(seed + offset));
    return min + val * (max - min);
  };

  let type = 'Loamy';
  let clay = 20;
  let sand = 40;
  let silt = 40;
  let ph = 6.2;
  let organic = 2.4;

  if (lat < 27.2) {
    clay = hash(18, 25, 1);
    silt = hash(52, 68, 2);
    sand = 100 - clay - silt;
    ph = hash(6.3, 7.3, 3);
    organic = hash(2.0, 3.2, 4);
  } else if (lat > 28.0) {
    sand = hash(62, 76, 1);
    clay = hash(8, 14, 2);
    silt = 100 - sand - clay;
    ph = hash(5.1, 5.9, 3);
    organic = hash(0.8, 1.6, 4);
  } else {
    clay = hash(28, 38, 1);
    sand = hash(22, 35, 2);
    silt = 100 - clay - sand;
    ph = hash(5.6, 6.5, 3);
    organic = hash(1.6, 2.6, 4);
  }

  type = classifySoil(clay, sand, silt);

  return { type, clay, sand, silt, ph, organic, loading: false, error: false };
};

import Markdown from '@ronradtke/react-native-markdown-display';

const getChatMarkdownStyles = (textColor: string) => ({
  body: {
    color: textColor,
    fontSize: 13.5,
    lineHeight: 19,
  },
  heading1: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: textColor,
    marginTop: 6,
    marginBottom: 4,
  },
  heading2: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: textColor,
    marginTop: 6,
    marginBottom: 4,
  },
  heading3: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: textColor,
    marginTop: 4,
    marginBottom: 4,
  },
  heading4: {
    fontSize: 13.5,
    fontWeight: '700' as const,
    color: textColor,
    marginTop: 4,
    marginBottom: 2,
  },
  paragraph: {
    marginTop: 2,
    marginBottom: 4,
  },
  bullet_list: {
    marginTop: 2,
    marginBottom: 4,
  },
  ordered_list: {
    marginTop: 2,
    marginBottom: 4,
  },
  list_item: {
    marginVertical: 1,
  },
  list_item_content: {
    flex: 1,
  },
  strong: {
    fontWeight: '700' as const,
    color: textColor,
  },
  em: {
    fontStyle: 'italic' as const,
    color: textColor,
  },
  blockquote: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderLeftColor: '#EF4444',
    borderLeftWidth: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 6,
    borderRadius: 8,
  },
  fence: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
    fontSize: 12,
  },
  code_block: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
    fontSize: 12,
  },
  table: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 6,
    marginVertical: 4,
  },
  td: {
    padding: 4,
    fontSize: 12,
  },
  th: {
    padding: 4,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  hr: {
    marginVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
});

interface ExistingField {
  id: string;
  name: string;
  crop_type?: string;
  boundaries: MapPoint[];
}

// Point-in-polygon ray-casting test
function isPointInPolygon(point: MapPoint, vs: MapPoint[]): boolean {
  let x = point.latitude, y = point.longitude;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i].latitude, yi = vs[i].longitude;
    let xj = vs[j].latitude, yj = vs[j].longitude;
    let intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Line segment intersection test
function doSegmentsIntersect(p1: MapPoint, p2: MapPoint, p3: MapPoint, p4: MapPoint): boolean {
  function ccw(A: MapPoint, B: MapPoint, C: MapPoint) {
    return (C.longitude - A.longitude) * (B.latitude - A.latitude) > (B.longitude - A.longitude) * (C.latitude - A.latitude);
  }
  return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
}

// Check if two 2D polygons overlap or intersect spatially
function checkPolygonsOverlap(polyA: MapPoint[], polyB: MapPoint[]): boolean {
  if (polyA.length < 3 || polyB.length < 3) return false;

  // 1. Any vertex of polyA inside polyB
  for (const p of polyA) {
    if (isPointInPolygon(p, polyB)) return true;
  }
  // 2. Any vertex of polyB inside polyA
  for (const p of polyB) {
    if (isPointInPolygon(p, polyA)) return true;
  }
  // 3. Any edge of polyA intersects any edge of polyB
  for (let i = 0; i < polyA.length; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % polyA.length];
    for (let j = 0; j < polyB.length; j++) {
      const b1 = polyB[j];
      const b2 = polyB[(j + 1) % polyB.length];
      if (doSegmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

export default function AddFieldScreen() {
  const { colors, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const mapRef = useRef<MapView | null>(null);
  const detailsScrollRef = useRef<ScrollView | null>(null);
  const aiChatScrollRef = useRef<ScrollView | null>(null);

  const [step, setStep] = useState<'map' | 'details'>('map');
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState<MapPoint>({ latitude: 27.7172, longitude: 85.3240 });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [fieldName, setFieldName] = useState('');
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);
  const [locationName, setLocationName] = useState('');
  const [saving, setSaving] = useState(false);

  // Crop status: 'planted' (already seeded) vs 'planned' (future crop)
  const [isPlanted, setIsPlanted] = useState<boolean>(true);
  const [plantWeek, setPlantWeek] = useState<number>(() => {
    const d = new Date().getDate();
    if (d <= 7) return 1;
    if (d <= 14) return 2;
    if (d <= 21) return 3;
    return 4;
  });
  const [plantDay, setPlantDay] = useState<number>(new Date().getDate());
  const [plantMonth, setPlantMonth] = useState<number>(new Date().getMonth());
  const [plantYear, setPlantYear] = useState<number>(new Date().getFullYear());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const [cropSearchQuery, setCropSearchQuery] = useState('');
  const [showCropSearch, setShowCropSearch] = useState(false);
  const [cropCardY, setCropCardY] = useState(0);

  // Dedicated AI Crop Advisor Assistant Chat Modal
  const [showAICropModal, setShowAICropModal] = useState(false);
  const [aiCropMessages, setAiCropMessages] = useState<Array<{ id: string; sender: 'ai' | 'user'; text: string }>>([]);
  const [aiCropInput, setAiCropInput] = useState('');
  const [aiCropLoading, setAiCropLoading] = useState(false);

  const openAICropAssistant = () => {
    setShowAICropModal(true);
    if (aiCropMessages.length === 0) {
      const locStr = locationName || 'Nepal';
      const areaStr = kattha > 0 ? `${kattha} Kattha` : 'mapped area';
      const initialGreeting = `Namaste! 🌾 I am your Avani AI Crop Advisor.\n\nBased on your farm in ${locStr} (${areaStr}) during ${MONTHS[plantMonth]} (Monsoon), Rice (Dhan) and Maize (Makai) are highly recommended.\n\nAsk me anything about seed varieties, soil preparation, fertilizer timing, or crop selection!`;
      setAiCropMessages([{
        id: '1',
        sender: 'ai',
        text: initialGreeting
      }]);
    }
  };

  const handleSendAICropQuery = async (queryText?: string) => {
    const textToSend = queryText || aiCropInput;
    if (!textToSend.trim() || aiCropLoading) return;

    const userMsgId = Date.now().toString();
    const userMessage = { id: userMsgId, sender: 'user' as const, text: textToSend.trim() };
    setAiCropMessages(prev => [...prev, userMessage]);
    if (!queryText) setAiCropInput('');
    setAiCropLoading(true);

    setTimeout(() => {
      aiChatScrollRef.current?.scrollToEnd({ animated: true });
    }, 60);

    try {
      const locStr = locationName || 'Nepal';
      const areaStr = kattha > 0 ? `${kattha} Kattha` : 'mapped area';
      const cropAdvisorPrompt = `You are Avani AI Crop Advisor, a highly critical, direct, and concise agricultural expert assisting a farmer in Nepal/South Asia.

CRITICAL PERSONA GUIDELINES:
1. CRITIQUE SUB-OPTIMAL OR WRONG FARMING IDEAS: Be direct, discerning, and critical. If the user suggests an impractical, ill-timed, wasteful, or harmful crop choice, timing, or soil preparation (e.g. planting an out-of-season crop, wrong crop for soil pH, over-fertilizing during monsoon rains), CRITICIZE THE IDEA DIRECTLY and explain scientifically why it is flawed.
2. BE DIRECT & CONCISE: Do not waste words on generic fluff, excessive greetings, or repetitive pleasantries. Get straight to the point with sharp, actionable agronomic advice.
3. DATA-DRIVEN ACCURACY: Use real-time farm location (${locStr}), area (${areaStr}), soil chemistry, weather forecasts, and Nepalese seasonal timelines to back up your critique and recommendations.

Instructions:
- Keep answers scannable, compact, and direct.
- Use clean Markdown headers (### Header) and bullet points (- Item).
- Highlight key facts with **bold text** or '> WARNING: Warning text' alerts.`;

      const response = await askAIAssistant(textToSend.trim(), [], 'en', false, cropAdvisorPrompt);
      const aiMsg = { id: (Date.now() + 1).toString(), sender: 'ai' as const, text: response };
      setAiCropMessages(prev => [...prev, aiMsg]);
      setTimeout(() => {
        aiChatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (e) {
      const errorMsg = { id: (Date.now() + 1).toString(), sender: 'ai' as const, text: 'Sorry, I could not process your request right now. Please try again.' };
      setAiCropMessages(prev => [...prev, errorMsg]);
      setTimeout(() => {
        aiChatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } finally {
      setAiCropLoading(false);
      Keyboard.dismiss();
    }
  };

  const filteredCrops = useMemo(() => {
    if (!cropSearchQuery.trim()) return CROPS;
    const q = cropSearchQuery.trim().toLowerCase();
    return CROPS.filter(c => c.name.toLowerCase().includes(q));
  }, [cropSearchQuery]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', 
      () => {
        setIsKeyboardOpen(true);
        if (showAICropModal) {
          setTimeout(() => {
            aiChatScrollRef.current?.scrollToEnd({ animated: true });
          }, 120);
        }
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', 
      () => setIsKeyboardOpen(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [showAICropModal]);

  const [soil, setSoil] = useState<SoilData>({
    type: '', clay: 0, sand: 0, silt: 0, ph: 0, organic: 0, loading: false, error: false,
  });

  const [existingFieldNames, setExistingFieldNames] = useState<string[]>([]);
  const [existingFields, setExistingFields] = useState<ExistingField[]>([]);

  useEffect(() => {
    const loadFields = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const fields = await dataService.getFields(session.user.id);
          if (fields && Array.isArray(fields)) {
            setExistingFieldNames(fields.map(f => f.name.trim().toLowerCase()));
            const parsedFields: ExistingField[] = fields.map(f => {
              let b: MapPoint[] = [];
              if (f.boundaries) {
                try {
                  const p = typeof f.boundaries === 'string' ? JSON.parse(f.boundaries) : f.boundaries;
                  if (Array.isArray(p)) b = p;
                } catch (e) {}
              }
              return {
                id: f.id,
                name: f.name,
                crop_type: f.crop_type,
                boundaries: b
              };
            }).filter(f => f.boundaries.length >= 3);
            setExistingFields(parsedFields);
          }
        }
      } catch (e) {
        console.warn('Error loading existing fields:', e);
      }
    };
    loadFields();
  }, []);

  const getUniqueSuggestedName = (baseLoc: string, existing: string[]): { primary: string; options: string[] } => {
    const cleanBase = baseLoc ? baseLoc.split(',')[0].trim() : 'My';
    const candidate1 = `${cleanBase} Field`;
    const candidate2 = `${cleanBase} Farm`;

    const options: string[] = [];
    
    // Find unique version for candidate 1
    let n1 = candidate1;
    let counter = 2;
    while (existing.includes(n1.toLowerCase())) {
      n1 = `${candidate1} ${counter}`;
      counter++;
    }
    options.push(n1);

    // Find unique version for candidate 2
    let n2 = candidate2;
    let c2 = 2;
    while (existing.includes(n2.toLowerCase())) {
      n2 = `${candidate2} ${c2}`;
      c2++;
    }
    if (!options.includes(n2)) options.push(n2);

    // Find unique version for candidate 3
    let n3 = `${cleanBase} Field ${counter}`;
    while (existing.includes(n3.toLowerCase()) || options.includes(n3)) {
      counter++;
      n3 = `${cleanBase} Field ${counter}`;
    }
    if (!options.includes(n3)) options.push(n3);

    return { primary: options[0], options };
  };

  const suggestedNamesObj = useMemo(() => {
    return getUniqueSuggestedName(locationName, existingFieldNames);
  }, [locationName, existingFieldNames]);

  const isDuplicateName = useMemo(() => {
    if (!fieldName.trim()) return false;
    return existingFieldNames.includes(fieldName.trim().toLowerCase());
  }, [fieldName, existingFieldNames]);

  const [water, setWater] = useState<WaterData>({
    moisture0to7: 0, moisture7to28: 0, loading: false, error: false,
  });

  const [region, setRegion] = useState({
    latitude: 27.7172, longitude: 85.3240, latitudeDelta: 0.0012, longitudeDelta: 0.0012,
  });

  const sorted = useMemo(() => sortByAngle(points), [points]);
  const kattha = useMemo(() => parseFloat((sphericalArea(sorted) / 338.63).toFixed(2)), [sorted]);

  const getGPS = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const r = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.0012, longitudeDelta: 0.0012 };
      setRegion(r);
      mapRef.current?.animateToRegion(r, 1200);
    } catch (e: any) { console.warn(e.message); }
    finally { setLocationLoading(false); }
  };
  useEffect(() => { getGPS(); }, []);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 3) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.trim())}&limit=5`, { headers: { 'User-Agent': 'AvaniApp' } });
        setSearchResults(await r.json());
      } catch { } finally { setSearchLoading(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Debounced background pre-fetching
  useEffect(() => {
    if (points.length < 3) {
      setLocationName(''); setFieldName('');
      setSoil({ type: '', clay: 0, sand: 0, silt: 0, ph: 0, organic: 0, loading: false, error: false });
      setWater({ moisture0to7: 0, moisture7to28: 0, loading: false, error: false });
      return;
    }

    const delayTimer = setTimeout(() => {
      const latC = points.reduce((s, p) => s + p.latitude, 0) / points.length;
      const lonC = points.reduce((s, p) => s + p.longitude, 0) / points.length;

      const fetchLocation = async () => {
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latC}&lon=${lonC}`, { headers: { 'User-Agent': 'AvaniApp' } });
          const d = await r.json();
          if (d?.address) {
            const name = d.address.village || d.address.suburb || d.address.town || d.address.city || d.address.municipality || '';
            const dist = d.address.state_district || d.address.state || '';
            const locStr = name ? `${name}, ${dist}` : 'Nepal';
            setLocationName(locStr);
            const sug = getUniqueSuggestedName(name || 'Nepal', existingFieldNames);
            setFieldName(sug.primary);
          }
        } catch {
          setLocationName('Nepal');
          const sug = getUniqueSuggestedName('Nepal', existingFieldNames);
          setFieldName(sug.primary);
        }
      };

      fetchLocation();
      fetchWaterData(points);
    }, 850);

    return () => clearTimeout(delayTimer);
  }, [points]);

  const placeCorner = () => { if (searchResults.length > 0) setSearchResults([]); setPoints(prev => [...prev, mapCenter]); };
  const undo = () => setPoints(prev => prev.slice(0, -1));
  const clear = () => setPoints([]);
  const pickSearchResult = (item: SearchResult) => {
    const r = { latitude: parseFloat(item.lat), longitude: parseFloat(item.lon), latitudeDelta: 0.0012, longitudeDelta: 0.0012 };
    setRegion(r);
    mapRef.current?.animateToRegion(r, 1200);
    setSearchQuery(''); setSearchResults([]);
  };

  const fetchWaterData = async (coords: MapPoint[]) => {
    if (coords.length < 3) return;
    setWater(prev => ({ ...prev, loading: true, error: false }));
    setSoil(prev => ({ ...prev, loading: true, error: false }));
    try {
      console.log('Fetching GEE satellite metrics for boundaries:', coords);
      const { data, error } = await supabase.functions.invoke('get-farm-metrics', {
        body: { boundaries: coords }
      });
      if (error || !data || !data.success) {
        throw new Error(error?.message || data?.error || 'GEE Error');
      }
      console.log('GEE response data:', data);
      setWater({
        moisture0to7: data.moisture,
        moisture7to28: Math.max(15, data.moisture - 2), // root zone estimation
        source: 'gee',
        loading: false,
        error: false
      });
      if (data.soil) {
        const type = classifySoil(data.soil.clay, data.soil.sand, data.soil.silt);
        setSoil({
          type,
          clay: data.soil.clay,
          sand: data.soil.sand,
          silt: data.soil.silt,
          ph: data.soil.ph,
          organic: data.soil.organic,
          health_score: data.health_score ?? 75,
          source: 'isric',
          loading: false,
          error: false
        });
      } else {
        const lat = coords.reduce((s, p) => s + p.latitude, 0) / coords.length;
        const lon = coords.reduce((s, p) => s + p.longitude, 0) / coords.length;
        const est = getEstimatedSoil(lat, lon);
        setSoil({ ...est, source: 'estimated' });
      }
    } catch (e: any) {
      console.warn('GEE fetch failed, falling back to open-meteo/mock:', e.message);
      const lat = coords.reduce((s, p) => s + p.latitude, 0) / coords.length;
      const lon = coords.reduce((s, p) => s + p.longitude, 0) / coords.length;
      
      const est = getEstimatedSoil(lat, lon);
      setSoil({ ...est, source: 'estimated' });

      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=soil_moisture_0_to_7cm,soil_moisture_7_to_28cm`;
        const res = await Promise.race([
          fetch(url),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);
        const d = await res.json();
        const hourIndex = new Date().getHours();
        const raw0to7 = d?.hourly?.soil_moisture_0_to_7cm?.[hourIndex] ?? d?.hourly?.soil_moisture_0_to_7cm?.[0] ?? 0.35;
        const raw7to28 = d?.hourly?.soil_moisture_7_to_28cm?.[hourIndex] ?? d?.hourly?.soil_moisture_7_to_28cm?.[0] ?? 0.34;
        setWater({ moisture0to7: raw0to7 * 100, moisture7to28: raw7to28 * 100, source: 'open-meteo', loading: false, error: false });
      } catch {
        const seed = Math.sin(lat * 500 + lon * 2000);
        const val = Math.abs(Math.sin(seed));
        const mock0to7 = 20 + val * 22;
        const mock7to28 = mock0to7 - 2 + Math.abs(Math.sin(seed + 1)) * 4;
        setWater({ moisture0to7: mock0to7, moisture7to28: mock7to28, source: 'open-meteo', loading: false, error: false });
      }
    }
  };

  const overlappingField = useMemo(() => {
    if (sorted.length < 3 || existingFields.length === 0) return null;
    for (const ef of existingFields) {
      if (checkPolygonsOverlap(sorted, ef.boundaries)) {
        return ef;
      }
    }
    return null;
  }, [sorted, existingFields]);

  const goToDetails = () => {
    if (points.length < 3) { return; }
    if (overlappingField) {
      Alert.alert(
        '🚫 Overlapping Farm Area Detected',
        `Your new farm boundary overlaps with your existing mapped farm "${overlappingField.name}".\n\nYou cannot overlap two farms in the same area. Please adjust your corner pins or draw within unmapped land.`
      );
      return;
    }
    setStep('details');
  };

  const backToMap = () => {
    setStep('map');
    if (points.length > 0) {
      const latC = points.reduce((s, p) => s + p.latitude, 0) / points.length;
      const lonC = points.reduce((s, p) => s + p.longitude, 0) / points.length;
      const farmRegion = {
        latitude: latC,
        longitude: lonC,
        latitudeDelta: 0.0018,
        longitudeDelta: 0.0018,
      };
      setRegion(farmRegion);
      setTimeout(() => {
        mapRef.current?.animateToRegion(farmRegion, 800);
      }, 150);
    }
  };

  const save = async () => {
    console.log('Save triggered:', { fieldName, selectedCrop, kattha, isPlanted, pointsLength: points.length });
    if (!fieldName.trim()) {
      Alert.alert('Missing Field Name', 'Please enter a name for your field.');
      return;
    }
    if (!selectedCrop) {
      Alert.alert('Select a Crop', 'Please select a crop type for your field.');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) throw new Error('Not authenticated');
      
      console.log('Inserting field into Supabase...');
      const getStartDayOfWeek = (w: number): number => {
        switch (w) {
          case 1: return 1;
          case 2: return 8;
          case 3: return 15;
          case 4: default: return 22;
        }
      };
      const startDay = getStartDayOfWeek(plantWeek);

      const insertData = {
        name: fieldName.trim(),
        crop_type: selectedCrop,
        area: kattha,
        area_unit: 'Kattha',
        soil_type: soil.type || null,
        status: isPlanted ? 'healthy' : 'planned',
        health_score: soil.health_score ?? 88,
        boundaries: sorted as any,
        location_name: locationName.trim(),
        planting_date: `${plantYear}-${String(plantMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`,
        user_id: user.id,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      console.log('Payload:', insertData);

      await dataService.saveField(insertData);
      console.log('Insert success! Opening success modal.');
      setShowSuccessModal(true); // Open the custom Success Modal!
    } catch (e: any) {
      console.error('Save exception:', e);
      Alert.alert('Error Saving Field', e.message || 'An error occurred while saving the field.');
    } finally {
      setSaving(false);
    }
  };

  const calibratedWater = useMemo(() => {
    return {
      moisture0to7: calibrateWaterMoisture(water.moisture0to7, soil.clay, soil.sand, soil.silt),
      moisture7to28: calibrateWaterMoisture(water.moisture7to28, soil.clay, soil.sand, soil.silt),
    };
  }, [water.moisture0to7, water.moisture7to28, soil.clay, soil.sand, soil.silt]);

  const WEEKS_LABEL = ['1st Week', '2nd Week', '3rd Week', '4th Week'];
  const plantDateLabel = `${WEEKS_LABEL[plantWeek - 1]} of ${MONTHS[plantMonth]} ${plantYear}`;
  const currentYear = new Date().getFullYear();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {step === 'map' ? (
        <View style={{ flex: 1, position: 'relative' }}>
          {/* Full-Screen Interactive Map Canvas */}
          <MapView 
            ref={mapRef} 
            style={StyleSheet.absoluteFillObject} 
            initialRegion={region} 
            maxZoomLevel={20} 
            mapType="hybrid"
            onRegionChangeComplete={(r) => setMapCenter({ latitude: r.latitude, longitude: r.longitude })}
            onPress={(e) => {
              if (searchResults.length > 0) setSearchResults([]);
              if (isKeyboardOpen) {
                Keyboard.dismiss();
                return;
              }
              const coord = e.nativeEvent?.coordinate;
              if (coord && typeof coord.latitude === 'number' && typeof coord.longitude === 'number') {
                setPoints(prev => [...prev, { latitude: coord.latitude, longitude: coord.longitude }]);
              }
            }}
          >
            {/* ── Existing Mapped Farms (Shown clearly to prevent spatial overlap) ── */}
            {existingFields.map((field, idx) => (
              <React.Fragment key={`existing-farm-${field.id}-${idx}`}>
                <Polygon
                  coordinates={field.boundaries}
                  strokeColor="#2563EB"
                  fillColor="rgba(37, 99, 235, 0.28)"
                  strokeWidth={2.5}
                />
                {field.boundaries.length > 0 && (
                  <Marker
                    coordinate={{
                      latitude: field.boundaries.reduce((s, p) => s + p.latitude, 0) / field.boundaries.length,
                      longitude: field.boundaries.reduce((s, p) => s + p.longitude, 0) / field.boundaries.length
                    }}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={{
                      backgroundColor: 'rgba(30, 58, 138, 0.94)',
                      paddingHorizontal: 9,
                      paddingVertical: 5,
                      borderRadius: 10,
                      borderWidth: 1.5,
                      borderColor: '#60A5FA',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      elevation: 4,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.25,
                      shadowRadius: 3,
                    }}>
                      <Ionicons name="location-sharp" size={12} color="#60A5FA" />
                      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>
                        {field.name}
                      </Text>
                    </View>
                  </Marker>
                )}
              </React.Fragment>
            ))}

            {/* ── Newly Drawn Farm Boundary ── */}
            {points.map((pt, i) => (
              <Marker 
                key={`${i}-${pt.latitude}-${pt.longitude}`} 
                coordinate={pt} 
                anchor={{ x: 0.5, y: 0.5 }}
                draggable
                onDragEnd={(e) => {
                  const newCoord = e.nativeEvent?.coordinate;
                  if (newCoord) {
                    setPoints(prev => {
                      const copy = [...prev];
                      copy[i] = { latitude: newCoord.latitude, longitude: newCoord.longitude };
                      return copy;
                    });
                  }
                }}
              >
                <View style={[styles.pin, overlappingField && { backgroundColor: '#DC2626', borderColor: '#FEF2F2' }]}>
                  <Text style={styles.pinTxt}>{i + 1}</Text>
                </View>
              </Marker>
            ))}
            {sorted.length >= 3 && (
              <Polygon 
                coordinates={sorted} 
                strokeColor={overlappingField ? "#DC2626" : "#4CAF50"} 
                fillColor={overlappingField ? "rgba(239, 68, 68, 0.42)" : "rgba(76,175,80,0.3)"} 
                strokeWidth={3} 
              />
            )}
            {sorted.length >= 2 && (
              <Polyline 
                coordinates={[...sorted, sorted[0]]} 
                strokeColor={overlappingField ? "#DC2626" : "#4CAF50"} 
                strokeWidth={3} 
              />
            )}
          </MapView>

          {/* ── Real-Time Overlapping Farm Warning Banner ── */}
          {overlappingField && (
            <View style={{
              position: 'absolute',
              top: 72,
              left: 16,
              right: 16,
              backgroundColor: '#DC2626',
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              zIndex: 35,
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 5,
            }}>
              <Ionicons name="warning-sharp" size={24} color="#FFFFFF" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                  Overlapping Farm Area Detected!
                </Text>
                <Text style={{ color: '#FEE2E2', fontSize: 11, marginTop: 1, fontWeight: '500' }}>
                  Overlaps with "{overlappingField.name}". Please draw within unmapped land.
                </Text>
              </View>
            </View>
          )}

          {/* Floating Top Control Row (Back Button + Search Bar with Gap) */}
          <View style={{
            position: 'absolute',
            top: 16,
            left: 16,
            right: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            zIndex: 30
          }}>
            {/* Back Button */}
            <TouchableOpacity 
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: isDarkMode ? 'rgba(24,24,22,0.92)' : 'rgba(255,255,255,0.92)',
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 5,
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
              }}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="chevron-back" size={24} color={colors.text} style={{ marginLeft: -1 }} />
              </View>
            </TouchableOpacity>

            {/* Search Bar Container */}
            <View style={{ flex: 1, position: 'relative', zIndex: 40 }}>
              <View style={{
                height: 44,
                borderTopLeftRadius: 22,
                borderTopRightRadius: 22,
                borderBottomLeftRadius: searchResults.length > 0 ? 0 : 22,
                borderBottomRightRadius: searchResults.length > 0 ? 0 : 22,
                backgroundColor: isDarkMode ? 'rgba(24,24,22,0.95)' : 'rgba(255,255,255,0.95)',
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 14,
                gap: 10,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 5,
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
              }}>
                <Ionicons name="search" size={18} color={colors.secondaryText} />
                <TextInput 
                  style={{ flex: 1, fontSize: 14, fontWeight: '500', color: colors.text }}
                  placeholder="Search location or landmark…"
                  placeholderTextColor={colors.secondaryText}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchLoading ? (
                  <ActivityIndicator size="small" color={colors.brandGreen} />
                ) : searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color={colors.secondaryText} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Seamless Search Suggestions Dropdown attached to Search Box */}
              {searchResults.length > 0 && (
                <View style={{
                  position: 'absolute',
                  top: 43,
                  left: 0,
                  right: 0,
                  backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
                  borderBottomLeftRadius: 18,
                  borderBottomRightRadius: 18,
                  borderWidth: 1,
                  borderTopWidth: 1,
                  borderColor: colors.border,
                  borderTopColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.15,
                  shadowRadius: 10,
                  elevation: 10
                }}>
                  {searchResults.map((item, index) => {
                    const parts = item.display_name.split(',');
                    const primaryText = parts[0];
                    const secondaryText = parts.slice(1).join(',').trim();
                    const isLast = index === searchResults.length - 1;

                    return (
                      <TouchableOpacity 
                        key={item.place_id} 
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderBottomWidth: isLast ? 0 : 1,
                          borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f0f2f5'
                        }} 
                        onPress={() => pickSearchResult(item)}
                        activeOpacity={0.7}
                      >
                        <View style={{
                          width: 30,
                          height: 30,
                          borderRadius: 15,
                          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f4f6f8',
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}>
                          <Ionicons name="location-outline" size={16} color={colors.brandGreen} />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                            {primaryText}
                          </Text>
                          {secondaryText ? (
                            <Text style={{ fontSize: 11, fontWeight: '400', color: colors.secondaryText, marginTop: 1 }} numberOfLines={1}>
                              {secondaryText}
                            </Text>
                          ) : null}
                        </View>

                        <Ionicons name="arrow-back" size={14} color={colors.secondaryText} style={{ transform: [{ rotate: '135deg' }] }} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>

          {/* Floating Location GPS Button (above bottom navbar top right) */}
          <TouchableOpacity 
            style={{
              position: 'absolute',
              bottom: '20%',
              right: 16,
              marginBottom: 12,
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: colors.brandGreen,
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 35,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 6,
              elevation: 6
            }}
            onPress={getGPS}
            disabled={locationLoading}
            activeOpacity={0.85}
          >
            {locationLoading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="locate" size={22} color="#FFF" />
            )}
          </TouchableOpacity>

          {/* Bottom 20% White Overlay */}
          <View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '20%',
            minHeight: 140,
            backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 24,
            justifyContent: 'space-between',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.12,
            shadowRadius: 10,
            elevation: 8,
            borderTopWidth: 1,
            borderColor: colors.border,
            zIndex: 30
          }}>
            {/* 1. Area Display */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.secondaryText, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  LAND AREA
                </Text>
                <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 1 }}>
                  {kattha > 0 ? `${kattha} Kattha` : '—'}
                </Text>
                {kattha > 0 && (
                  <Text style={{ fontSize: 10.5, fontWeight: '500', color: colors.secondaryText, marginTop: 1 }}>
                    ≈ {(kattha * 338.63).toFixed(0)} m²
                  </Text>
                )}
              </View>

              <View style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 14,
                backgroundColor: isDarkMode ? 'rgba(76,175,80,0.18)' : '#eaf6f0',
                borderWidth: 1,
                borderColor: colors.brandGreen
              }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.brandGreen }}>
                  {points.length} {points.length === 1 ? 'Corner' : 'Corners'}
                </Text>
              </View>
            </View>

            {/* 2. Action Buttons Row: Continue (left, smaller flex) + Undo + Delete (right) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
              {/* Smaller Continue Button */}
              <TouchableOpacity 
                style={{
                  flex: 1,
                  height: 48,
                  backgroundColor: points.length >= 3 
                    ? (overlappingField ? '#DC2626' : colors.brandGreen) 
                    : colors.border,
                  borderRadius: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  shadowColor: overlappingField ? '#DC2626' : colors.brandGreen,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: points.length >= 3 ? 0.25 : 0,
                  shadowRadius: 6,
                  elevation: points.length >= 3 ? 3 : 0
                }}
                onPress={goToDetails}
                disabled={points.length < 3}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 }}>
                  {overlappingField ? 'Overlapping Farm' : 'Continue'}
                </Text>
                <Ionicons name={overlappingField ? "warning" : "arrow-forward"} size={16} color="#FFF" />
              </TouchableOpacity>

              {/* Undo Button */}
              <TouchableOpacity
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#f4f6f8',
                  borderWidth: 1,
                  borderColor: colors.border,
                  justifyContent: 'center',
                  alignItems: 'center',
                  opacity: points.length > 0 ? 1 : 0.4
                }}
                onPress={undo}
                disabled={points.length === 0}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-undo-outline" size={20} color={colors.text} />
              </TouchableOpacity>

              {/* Delete / Clear Button */}
              <TouchableOpacity
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: points.length > 0 ? 'rgba(232,93,93,0.12)' : (isDarkMode ? 'rgba(255,255,255,0.08)' : '#f4f6f8'),
                  borderWidth: 1,
                  borderColor: points.length > 0 ? 'rgba(232,93,93,0.3)' : colors.border,
                  justifyContent: 'center',
                  alignItems: 'center',
                  opacity: points.length > 0 ? 1 : 0.4
                }}
                onPress={clear}
                disabled={points.length === 0}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={20} color={points.length > 0 ? '#E85D5D' : colors.secondaryText} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        /* ────── STEP 2: DETAILS ────── */
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.topBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={backToMap} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.topTitle, { color: colors.text, flex: 1, textAlign: 'center' }]}>Field Details</Text>
            <View style={{ width: 26 }} />
          </View>

          <ScrollView 
            ref={detailsScrollRef} 
            contentContainerStyle={{ padding: 16, paddingBottom: showCropSearch ? 260 : 60 }} 
            keyboardShouldPersistTaps="handled" 
            showsVerticalScrollIndicator={false}
          >
            {/* Unified Land Area + Location Card Box */}
            <View style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.05,
              shadowRadius: 6,
              elevation: 2
            }}>
              {/* Top Row: Area Display + Layers Icon */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.secondaryText, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                    MAPPED LAND AREA
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 2 }}>
                    <Text style={{ fontSize: 19, fontWeight: '800', color: colors.brandGreen }}>
                      {kattha > 0 ? kattha : '0'}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                      Kattha
                    </Text>
                    {kattha > 0 && (
                      <Text style={{ fontSize: 11, fontWeight: '500', color: colors.secondaryText, marginLeft: 4 }}>
                        (≈ {(kattha * 338.63).toFixed(0)} m²)
                      </Text>
                    )}
                  </View>
                </View>

                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: isDarkMode ? 'rgba(76,175,80,0.15)' : '#eaf6f0',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <Ionicons name="layers-outline" size={18} color={colors.brandGreen} />
                </View>
              </View>

              {/* Bottom Row: Location Strip integrated inside the same box */}
              <View style={{
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8faf9',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#eef2f0'
              }}>
                <Ionicons name="location-sharp" size={14} color={colors.brandGreen} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, flex: 1 }} numberOfLines={1}>
                  {locationName || 'Nepal'}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.secondaryText }}>
                  {points.length} Corners
                </Text>
              </View>
            </View>

            {/* 2. Farm Name Section with Database Uniqueness Check */}
            <View style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              marginTop: 16,
              borderWidth: 1,
              borderColor: isDuplicateName ? '#E85D5D' : colors.border,
              gap: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.05,
              shadowRadius: 6,
              elevation: 2
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: 'rgba(107,143,94,0.12)',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    <Ionicons name="pricetag-outline" size={15} color={colors.brandGreen} />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                    Farm Name
                  </Text>
                </View>

                {isDuplicateName && (
                  <View style={{
                    backgroundColor: 'rgba(232,93,93,0.12)',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6
                  }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#E85D5D' }}>
                      Name Taken
                    </Text>
                  </View>
                )}
              </View>

              <TextInput 
                style={{
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8faf9',
                  borderWidth: 1,
                  borderColor: isDuplicateName ? '#E85D5D' : colors.border,
                  paddingHorizontal: 14,
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.text
                }}
                placeholder="Enter farm name…"
                placeholderTextColor={colors.secondaryText}
                value={fieldName}
                onChangeText={setFieldName}
              />

              {isDuplicateName && (
                <Text style={{ fontSize: 11, fontWeight: '500', color: '#E85D5D', marginTop: -4 }}>
                  ⚠️ You already have a farm named "{fieldName}". Please select a unique name.
                </Text>
              )}

              {/* Suggested Unique Names in a single horizontal scrollable row */}
              {suggestedNamesObj.options.length > 0 && (
                <View style={{ marginTop: 2 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.secondaryText, marginBottom: 8 }}>
                    Suggested Unique Names:
                  </Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {suggestedNamesObj.options.map((sugName) => (
                      <TouchableOpacity
                        key={sugName}
                        style={{
                          backgroundColor: fieldName === sugName ? 'rgba(76,175,80,0.15)' : (isDarkMode ? 'rgba(255,255,255,0.06)' : '#f0f4f1'),
                          borderWidth: 1,
                          borderColor: fieldName === sugName ? colors.brandGreen : colors.border,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 20
                        }}
                        onPress={() => setFieldName(sugName)}
                        activeOpacity={0.8}
                      >
                        <Text style={{
                          fontSize: 12,
                          fontWeight: fieldName === sugName ? '700' : '500',
                          color: fieldName === sugName ? colors.brandGreen : colors.text
                        }}>
                          {sugName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* 2.5. Planting Status & Date Selection (Modern Non-Card Layout) */}
            <View style={{ marginTop: 20, gap: 16 }}>
              {/* Question 1: Did you plant your crop? */}
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: 'rgba(76,175,80,0.12)',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    <Ionicons name="help-circle-outline" size={16} color={colors.brandGreen} />
                  </View>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.text }}>
                    Did you plant your crop?
                  </Text>
                </View>

                {/* Modern Segmented Pill Selector */}
                <View style={{
                  flexDirection: 'row',
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#edf2ee',
                  borderRadius: 14,
                  padding: 4,
                  gap: 4
                }}>
                  {/* Yes Option */}
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 9,
                      borderRadius: 11,
                      backgroundColor: isPlanted 
                        ? (isDarkMode ? colors.card : '#ffffff') 
                        : 'transparent',
                      shadowColor: isPlanted ? '#000' : 'transparent',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isPlanted ? 0.08 : 0,
                      shadowRadius: 4,
                      elevation: isPlanted ? 2 : 0
                    }}
                    onPress={() => {
                      setIsPlanted(true);
                      const now = new Date();
                      const nowYr = now.getFullYear();
                      const nowMo = now.getMonth();
                      const nowDy = now.getDate();
                      const curWeek = nowDy <= 7 ? 1 : nowDy <= 14 ? 2 : nowDy <= 21 ? 3 : 4;
                      const isFuture = plantYear > nowYr || (plantYear === nowYr && plantMonth > nowMo) || (plantYear === nowYr && plantMonth === nowMo && plantWeek > curWeek);
                      if (isFuture) {
                        setPlantYear(nowYr);
                        setPlantMonth(nowMo);
                        setPlantWeek(curWeek);
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons 
                      name={isPlanted ? "checkmark-circle" : "ellipse-outline"} 
                      size={16} 
                      color={isPlanted ? colors.brandGreen : colors.secondaryText} 
                    />
                    <Text style={{
                      fontSize: 13,
                      fontWeight: isPlanted ? '700' : '600',
                      color: isPlanted ? colors.brandGreen : colors.secondaryText
                    }}>
                      Yes (Already Planted)
                    </Text>
                  </TouchableOpacity>

                  {/* No Option */}
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 9,
                      borderRadius: 11,
                      backgroundColor: !isPlanted 
                        ? (isDarkMode ? colors.card : '#ffffff') 
                        : 'transparent',
                      shadowColor: !isPlanted ? '#000' : 'transparent',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: !isPlanted ? 0.08 : 0,
                      shadowRadius: 4,
                      elevation: !isPlanted ? 2 : 0
                    }}
                    onPress={() => {
                      setIsPlanted(false);
                      const now = new Date();
                      const nowYr = now.getFullYear();
                      const nowMo = now.getMonth();
                      const nowDy = now.getDate();
                      const curWeek = nowDy <= 7 ? 1 : nowDy <= 14 ? 2 : nowDy <= 21 ? 3 : 4;
                      const isPast = plantYear < nowYr || (plantYear === nowYr && plantMonth < nowMo) || (plantYear === nowYr && plantMonth === nowMo && plantWeek < curWeek);
                      if (isPast) {
                        setPlantYear(nowYr);
                        setPlantMonth(nowMo);
                        setPlantWeek(curWeek);
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons 
                      name={!isPlanted ? "checkmark-circle" : "ellipse-outline"} 
                      size={16} 
                      color={!isPlanted ? colors.brandGreen : colors.secondaryText} 
                    />
                    <Text style={{
                      fontSize: 13,
                      fontWeight: !isPlanted ? '700' : '600',
                      color: !isPlanted ? colors.brandGreen : colors.secondaryText
                    }}>
                      No (Planning)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Question 2: Custom Weekly Calendar Picker */}
              <View style={{ gap: 8 }}>
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  gap: 8,
                  flexWrap: 'wrap'
                }}>
                  <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: 'rgba(76,175,80,0.12)',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    <Ionicons name="calendar-outline" size={15} color={colors.brandGreen} />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                    {isPlanted ? 'Planting Date:' : 'Target Date:'}
                  </Text>

                  {/* Selected Full Date Pill */}
                  <View style={{
                    backgroundColor: isDarkMode ? 'rgba(76,175,80,0.2)' : '#eaf6f0',
                    paddingHorizontal: 9,
                    paddingVertical: 3,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(76,175,80,0.3)'
                  }}>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.brandGreen }}>
                      📅 {['1st Week', '2nd Week', '3rd Week', '4th Week'][plantWeek - 1]} of {MONTHS[plantMonth]} {plantYear}
                    </Text>
                  </View>
                </View>

                {/* Custom Weekly Calendar Card Grid */}
                {(() => {
                  const now = new Date();
                  const nowYr = now.getFullYear();
                  const nowMo = now.getMonth();
                  const nowDy = now.getDate();

                  const currentWeek = nowDy <= 7 ? 1 : nowDy <= 14 ? 2 : nowDy <= 21 ? 3 : 4;

                  // Arrow navigation validation
                  const canGoBack = isPlanted || (plantYear > nowYr || (plantYear === nowYr && plantMonth > nowMo));
                  const canGoForward = !isPlanted || (plantYear < nowYr || (plantYear === nowYr && plantMonth < nowMo));

                  const weekOptions = [
                    { weekNum: 1, label: '1st Week', range: `1 – 7 ${MONTHS[plantMonth]}` },
                    { weekNum: 2, label: '2nd Week', range: `8 – 14 ${MONTHS[plantMonth]}` },
                    { weekNum: 3, label: '3rd Week', range: `15 – 21 ${MONTHS[plantMonth]}` },
                    { weekNum: 4, label: '4th Week', range: `22 – End ${MONTHS[plantMonth]}` },
                  ];

                  return (
                    <View style={{
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#ffffff',
                      borderRadius: 18,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: colors.border,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.05,
                      shadowRadius: 8,
                      elevation: 3,
                      gap: 14
                    }}>
                      {/* Month Navigation Header */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
                        <TouchableOpacity
                          disabled={!canGoBack}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 17,
                            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f0f4f1',
                            justifyContent: 'center',
                            alignItems: 'center',
                            opacity: canGoBack ? 1 : 0.3
                          }}
                          onPress={() => {
                            if (!canGoBack) return;
                            if (plantMonth === 0) {
                              setPlantMonth(11);
                              setPlantYear(prev => prev - 1);
                            } else {
                              setPlantMonth(prev => prev - 1);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="chevron-back" size={18} color={colors.text} />
                        </TouchableOpacity>

                        <View style={{ alignItems: 'center' }}>
                          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                            {FULL_MONTH_NAMES[plantMonth]} {plantYear}
                          </Text>
                          <Text style={{ fontSize: 11, fontWeight: '500', color: colors.secondaryText, marginTop: 1 }}>
                            Select week of month
                          </Text>
                        </View>

                        <TouchableOpacity
                          disabled={!canGoForward}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 17,
                            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f0f4f1',
                            justifyContent: 'center',
                            alignItems: 'center',
                            opacity: canGoForward ? 1 : 0.3
                          }}
                          onPress={() => {
                            if (!canGoForward) return;
                            if (plantMonth === 11) {
                              setPlantMonth(0);
                              setPlantYear(prev => prev + 1);
                            } else {
                              setPlantMonth(prev => prev + 1);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="chevron-forward" size={18} color={colors.text} />
                        </TouchableOpacity>
                      </View>

                      {/* 2x2 Grid of Weekly Select Cards */}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
                        {weekOptions.map((opt) => {
                          const isSelected = plantWeek === opt.weekNum;

                          // Validation logic for each week
                          const isPastMonth = plantYear < nowYr || (plantYear === nowYr && plantMonth < nowMo);
                          const isFutureMonth = plantYear > nowYr || (plantYear === nowYr && plantMonth > nowMo);
                          const isCurrentMonth = plantYear === nowYr && plantMonth === nowMo;

                          let isWeekDisabled = false;
                          if (isPlanted) {
                            // Already planted: cannot select future weeks!
                            if (isFutureMonth) isWeekDisabled = true;
                            else if (isCurrentMonth && opt.weekNum > currentWeek) isWeekDisabled = true;
                          } else {
                            // Planning: cannot select past weeks!
                            if (isPastMonth) isWeekDisabled = true;
                            else if (isCurrentMonth && opt.weekNum < currentWeek) isWeekDisabled = true;
                          }

                          return (
                            <TouchableOpacity
                              key={opt.weekNum}
                              disabled={isWeekDisabled}
                              style={{
                                width: '48%',
                                padding: 12,
                                borderRadius: 14,
                                backgroundColor: isSelected 
                                  ? (isDarkMode ? 'rgba(76,175,80,0.22)' : 'rgba(76,175,80,0.12)') 
                                  : (isDarkMode ? 'rgba(255,255,255,0.04)' : '#f8faf9'),
                                borderWidth: 1.5,
                                borderColor: isSelected ? colors.brandGreen : (isDarkMode ? 'rgba(255,255,255,0.08)' : colors.border),
                                opacity: isWeekDisabled ? 0.35 : 1,
                                gap: 6
                              }}
                              onPress={() => {
                                if (!isWeekDisabled) setPlantWeek(opt.weekNum);
                              }}
                              activeOpacity={0.8}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <View style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 2,
                                  borderRadius: 6,
                                  backgroundColor: isSelected ? colors.brandGreen : (isDarkMode ? 'rgba(255,255,255,0.08)' : '#e5eae6')
                                }}>
                                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: isSelected ? '#fff' : colors.text }}>
                                    W{opt.weekNum}
                                  </Text>
                                </View>

                                {isSelected ? (
                                  <Ionicons name="checkmark-circle" size={18} color={colors.brandGreen} />
                                ) : (
                                  <Ionicons name="ellipse-outline" size={16} color={isWeekDisabled ? colors.secondaryText : colors.border} />
                                )}
                              </View>

                              <Text style={{ fontSize: 13, fontWeight: '700', color: isSelected ? colors.brandGreen : colors.text }}>
                                {opt.label}
                              </Text>
                              <Text style={{ fontSize: 11, fontWeight: '500', color: colors.secondaryText }}>
                                {opt.range}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })()}
              </View>
            </View>

            {/* 3. Crop Selection Section */}
            <View 
              onLayout={(e) => setCropCardY(e.nativeEvent.layout.y)}
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 16,
                marginTop: 16,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
                elevation: 2
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: 'rgba(107,143,94,0.12)',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    <Ionicons name="leaf-outline" size={15} color={colors.brandGreen} />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                    {isPlanted ? 'What did you plant?' : 'What are you planting?'}
                  </Text>
                </View>

                {/* Right Action Icons: Search Icon & Ask AI Icon (Conditional) */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {/* 1. Search Icon Button */}
                  <TouchableOpacity
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: showCropSearch ? 'rgba(76,175,80,0.18)' : (isDarkMode ? 'rgba(255,255,255,0.06)' : '#f0f4f1'),
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: showCropSearch ? colors.brandGreen : colors.border
                    }}
                    onPress={() => {
                      const next = !showCropSearch;
                      setShowCropSearch(next);
                      if (next) {
                        setTimeout(() => {
                          detailsScrollRef.current?.scrollTo({ y: Math.max(0, cropCardY - 10), animated: true });
                        }, 120);
                      } else {
                        setCropSearchQuery('');
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="search-outline" size={16} color={showCropSearch ? colors.brandGreen : colors.text} />
                  </TouchableOpacity>

                  {/* 2. Ask AI Icon Button -> Only shown when NOT yet planted (!isPlanted) */}
                  {!isPlanted && (
                    <TouchableOpacity
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: 'rgba(76,175,80,0.15)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: colors.brandGreen
                      }}
                      onPress={openAICropAssistant}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="sparkles" size={16} color={colors.brandGreen} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Inline Search Input Bar when Search Icon is active */}
              {showCropSearch && (
                <View style={{
                  height: 38,
                  borderRadius: 10,
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8faf9',
                  borderWidth: 1,
                  borderColor: colors.brandGreen,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  gap: 8
                }}>
                  <Ionicons name="search" size={15} color={colors.brandGreen} />
                  <TextInput 
                    style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.text }}
                    placeholder="Search crops by name…"
                    placeholderTextColor={colors.secondaryText}
                    value={cropSearchQuery}
                    onChangeText={setCropSearchQuery}
                    autoFocus
                  />
                  {cropSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setCropSearchQuery('')}>
                      <Ionicons name="close-circle" size={16} color={colors.secondaryText} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Single Horizontal Scrollable Row for Crop Options */}
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={{ gap: 10 }}
              >
                {filteredCrops.length > 0 ? (
                  filteredCrops.map((crop) => {
                    const isSelected = selectedCrop === crop.name;
                    return (
                      <TouchableOpacity
                        key={crop.name}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 12,
                          backgroundColor: isSelected 
                            ? (isDarkMode ? 'rgba(76,175,80,0.22)' : 'rgba(76,175,80,0.12)') 
                            : (isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8faf9'),
                          borderWidth: 1.5,
                          borderColor: isSelected ? colors.brandGreen : colors.border
                        }}
                        onPress={() => setSelectedCrop(crop.name)}
                        activeOpacity={0.85}
                      >
                        <Text style={{ fontSize: 18 }}>{crop.emoji}</Text>
                        <Text style={{
                          fontSize: 13,
                          fontWeight: isSelected ? '700' : '600',
                          color: isSelected ? colors.brandGreen : colors.text
                        }}>
                          {crop.name}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={16} color={colors.brandGreen} />
                        )}
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={{ paddingVertical: 8 }}>
                    <Text style={{ fontSize: 12, color: colors.secondaryText }}>No crops found matching "{cropSearchQuery}"</Text>
                  </View>
                )}
              </ScrollView>
            </View>

            {/* 4. Save Form Button */}
            <View style={{ marginTop: 24, marginBottom: 40 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.brandGreen,
                  borderRadius: 16,
                  height: 54,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  shadowColor: colors.brandGreen,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 5,
                  opacity: saving ? 0.7 : 1
                }}
                onPress={save}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done-circle" size={22} color="#ffffff" />
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff', letterSpacing: 0.3 }}>
                      Save Field
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
      {/* Compact & Ultra-Clean Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade" onRequestClose={() => setShowSuccessModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
          <View style={{
            width: '100%',
            maxWidth: 340,
            backgroundColor: colors.card,
            borderRadius: 20,
            padding: 18,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 8,
            gap: 12
          }}>
            {/* Header Icon & Title in one compact group */}
            <View style={{ alignItems: 'center', gap: 6 }}>
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: 'rgba(76,175,80,0.14)',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <Ionicons name="checkmark-circle" size={30} color={colors.brandGreen} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
                Field Saved!
              </Text>
            </View>

            {/* Compact 3-Row Data Summary */}
            <View style={{
              width: '100%',
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#f8faf9',
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 8
            }}>
              {/* Row 1: Field Name & Area */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                  {fieldName || 'My Field'}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryText }}>
                  {kattha} Kattha
                </Text>
              </View>

              <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.5 }} />

              {/* Row 2: Crop & Farming Status */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.text }}>
                  🌾 {selectedCrop || 'Crop'}
                </Text>
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: isPlanted ? colors.brandGreen : '#f57c00' }}>
                  {isPlanted ? '🌱 Already Planted' : '📅 Planning'}
                </Text>
              </View>

              <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.5 }} />

              {/* Row 3: Date */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 11.5, fontWeight: '500', color: colors.secondaryText }}>
                  {isPlanted ? 'Planted:' : 'Target:'}
                </Text>
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.brandGreen }}>
                  {['1st Wk', '2nd Wk', '3rd Wk', '4th Wk'][plantWeek - 1]} of {MONTHS[plantMonth]} {plantYear}
                </Text>
              </View>
            </View>

            {/* Compact Action Button */}
            <TouchableOpacity 
              style={{
                width: '100%',
                height: 44,
                borderRadius: 12,
                backgroundColor: colors.brandGreen,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                shadowColor: colors.brandGreen,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.2,
                shadowRadius: 6,
                elevation: 3
              }}
              onPress={() => {
                setShowSuccessModal(false);
                navigation.goBack();
              }}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>Go to Dashboard</Text>
              <Ionicons name="arrow-forward" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Dedicated AI Crop Advisor Chat Modal */}
      <Modal visible={showAICropModal} animationType="slide" transparent onRequestClose={() => setShowAICropModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            style={{ 
              height: '82%', 
              backgroundColor: colors.card, 
              borderTopLeftRadius: 24, 
              borderTopRightRadius: 24, 
              overflow: 'hidden' 
            }}
          >
            {/* Modal Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#f8faf9'
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: 'rgba(76,175,80,0.15)',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <Ionicons name="sparkles" size={18} color={colors.brandGreen} />
                </View>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                    Avani AI Crop Advisor
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '500', color: colors.secondaryText }}>
                    Personalized for {locationName || 'your farm'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity 
                onPress={() => setShowAICropModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Quick Prompt Chips */}
            <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {[
                  '🌾 Recommended Rice Varieties',
                  '🌽 Is Maize suitable here?',
                  '🧪 Fertilizer schedule for Ashadh',
                  '🥔 High yield vegetable options'
                ].map((chip) => (
                  <TouchableOpacity
                    key={chip}
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(76,175,80,0.15)' : '#eaf6f0',
                      borderWidth: 1,
                      borderColor: colors.brandGreen,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16
                    }}
                    onPress={() => handleSendAICropQuery(chip)}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.brandGreen }}>
                      {chip}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Chat Messages Feed */}
            <ScrollView 
              ref={aiChatScrollRef}
              style={{ flex: 1, paddingHorizontal: 16 }} 
              contentContainerStyle={{ paddingVertical: 12, gap: 12 }}
              onContentSizeChange={() => aiChatScrollRef.current?.scrollToEnd({ animated: true })}
            >
              {aiCropMessages.map((msg) => {
                const isUser = msg.sender === 'user';
                // AI bubbles need a fixed pixel width so Markdown text knows where to wrap.
                // ScrollView has paddingHorizontal:16 (32 total), bubble has paddingHorizontal:14 (28 total)
                const aiBubbleWidth = Math.floor(SW - 32 - 12);  // full width minus scroll padding minus small margin
                const aiContentWidth = aiBubbleWidth - 28;       // minus bubble padding
                return (
                <View
                  key={msg.id}
                  style={{
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    ...(isUser ? { maxWidth: '85%' } : { width: aiBubbleWidth }),
                    backgroundColor: isUser
                      ? colors.brandGreen 
                      : (isDarkMode ? 'rgba(255,255,255,0.06)' : '#f0f4f1'),
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderBottomRightRadius: isUser ? 4 : 16,
                    borderBottomLeftRadius: !isUser ? 4 : 16,
                    overflow: 'hidden',
                  }}
                >
                  {isUser ? (
                    <Text style={{
                      fontSize: 13.5,
                      lineHeight: 19,
                      color: '#fff',
                      fontWeight: '500'
                    }}>
                      {msg.text}
                    </Text>
                  ) : (
                    <View style={{ width: aiContentWidth }}>
                      <Markdown style={getChatMarkdownStyles(colors.text)}>
                        {msg.text}
                      </Markdown>
                    </View>
                  )}
                </View>
                );
              })}

              {aiCropLoading && (
                <View style={{
                  alignSelf: 'flex-start',
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f0f4f1',
                  borderRadius: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <ActivityIndicator size="small" color={colors.brandGreen} />
                  <Text style={{ fontSize: 12, color: colors.secondaryText }}>Avani AI is analyzing soil & season…</Text>
                </View>
              )}
            </ScrollView>

            {/* Chat Input Bar */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.card
            }}>
              <TextInput
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f4f6f8',
                  paddingHorizontal: 16,
                  fontSize: 13.5,
                  color: colors.text,
                  borderWidth: 1,
                  borderColor: colors.border
                }}
                placeholder="Ask Avani AI about crops…"
                placeholderTextColor={colors.secondaryText}
                value={aiCropInput}
                onChangeText={setAiCropInput}
                onSubmitEditing={() => handleSendAICropQuery()}
              />

              <TouchableOpacity
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: colors.brandGreen,
                  justifyContent: 'center',
                  alignItems: 'center',
                  opacity: aiCropInput.trim().length > 0 ? 1 : 0.5
                }}
                onPress={() => handleSendAICropQuery()}
                disabled={aiCropInput.trim().length === 0 || aiCropLoading}
              >
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  topTitle: { fontSize: 17, fontWeight: '700' },
  topSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },

  searchLayer: { position: 'absolute', top: 12, left: 16, right: 16, zIndex: 20 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, height: 48, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 5 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },
  resList: { marginTop: 6, borderRadius: 16, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  resRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  resDot: { width: 8, height: 8, borderRadius: 4 },
  resPri: { fontSize: 14, fontWeight: '600' },
  resSec: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  pin: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#4CAF50', borderWidth: 2, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
  pinTxt: { color: '#FFF', fontSize: 11, fontWeight: '800' },

  reticle: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  rH: { position: 'absolute', width: 40, height: 1.5, backgroundColor: '#4CAF50', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 1, shadowOffset: { width: 0, height: 0 } },
  rV: { position: 'absolute', width: 1.5, height: 40, backgroundColor: '#4CAF50', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 1, shadowOffset: { width: 0, height: 0 } },
  rDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50', borderWidth: 1, borderColor: '#FFF' },

  guidanceBannerWrapper: { position: 'absolute', top: 68, left: 16, right: 16, alignItems: 'center', zIndex: 10 },
  guidanceBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  guidanceText: { fontSize: 12.5, fontWeight: '700' },

  mapCtrls: { position: 'absolute', bottom: 18, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14, zIndex: 5 },
  ctrlIconButton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  undoBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3 },
  placeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#6B8F5E', paddingVertical: 14, paddingHorizontal: 26, borderRadius: 24, shadowColor: '#3A5A30', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  placeTxt: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  botBarContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1 },
  botBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1 },
  botLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  botVal: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  botSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  contBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 26, borderRadius: 16, shadowColor: '#3A5A30', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  contTxt: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // ── Step 2 ──
  formScroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 50 },

  progressBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepDot: { width: 8, height: 8, borderRadius: 4 },
  stepText: { fontSize: 12, fontWeight: '600' },

  heroCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 28, borderWidth: 1 },
  heroGradient: { backgroundColor: '#3A5A30', padding: 22 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start' },
  heroStat: { flex: 1, alignItems: 'center', gap: 6 },
  heroStatVal: { color: '#FFF', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  heroStatSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '500' },
  heroDivider: { width: 1, height: 50, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 16 },

  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  autoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  autoText: { fontSize: 11, fontWeight: '700' },

  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontWeight: '500' },

  statusToggleContainer: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, padding: 4, height: 48 },
  statusToggleBtn: { flex: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  statusToggleText: { fontSize: 13, fontWeight: '700' },

  cropGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cropTile: { width: (SW - 56) / 3, borderRadius: 14, paddingVertical: 18, alignItems: 'center', gap: 6, position: 'relative' },
  cropEmoji: { fontSize: 30 },
  cropName: { fontSize: 12, textAlign: 'center' },
  suggestedBadge: { position: 'absolute', top: 5, left: 5, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  suggestedText: { fontSize: 7.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.2 },
  checkBadge: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },

  dateCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  dateVal: { fontSize: 16, fontWeight: '700' },

  soilCard: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 16 },
  soilLoadText: { fontSize: 13, fontWeight: '500' },
  soilTypeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  soilTypeBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  soilTypeText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  soilPh: { fontSize: 13, fontWeight: '600' },
  compRow: { gap: 12 },
  compItem: { gap: 4 },
  compLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  compLabel: { fontSize: 12, fontWeight: '600' },
  compPct: { fontSize: 12, fontWeight: '700' },
  compBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  compBarFill: { height: '100%', borderRadius: 3 },
  organicRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 14 },
  organicText: { fontSize: 13, fontWeight: '500' },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 14, marginTop: 8, shadowColor: '#3A5A30', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  saveTxt: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 36 },
  modalHandle: { alignItems: 'center', paddingVertical: 12 },
  handleBar: { width: 36, height: 4, borderRadius: 2 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  pickerLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  yearRow: { flexDirection: 'row', gap: 12 },
  yearChip: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthChip: { width: (SW - 80) / 4, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  modalDone: { marginTop: 24, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },

  // Stitch MCP Map Screen Design Tokens
  stitchHeaderWrapper: { position: 'absolute', top: 12, left: 16, right: 16, zIndex: 30 },
  stitchGlassPanel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 30, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6 },
  stitchCircleBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  stitchHeaderTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.6 },
  stitchStepBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 2 },
  stitchStepBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },

  stitchSearchRow: { position: 'absolute', top: 74, left: 16, right: 16, flexDirection: 'row', gap: 8, zIndex: 25 },
  stitchSearchInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, height: 48, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  stitchGpsBtn: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 5 },
  stitchDropdown: { position: 'absolute', top: 128, left: 16, right: 16, zIndex: 40 },

  stitchGuidancePillWrapper: { position: 'absolute', bottom: 224, left: 0, right: 0, alignItems: 'center', zIndex: 20 },
  stitchGuidancePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  stitchGuidancePillText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 },

  stitchActionRow: { position: 'absolute', bottom: 144, left: 18, right: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 20 },
  stitchSquareActionBtn: { width: 54, height: 54, borderRadius: 18, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  stitchSquareBtnLabel: { fontSize: 8.5, fontWeight: '800', marginTop: 2, letterSpacing: 0.4 },
  stitchPrimaryPlaceBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 28, height: 56, borderRadius: 28, shadowColor: '#6B8F5E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 7 },
  stitchPrimaryPlaceBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.8 },

  stitchBottomCard: { position: 'absolute', bottom: 12, left: 14, right: 14, borderRadius: 24, borderWidth: 1, padding: 18, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8, zIndex: 30 },
  stitchBottomCardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  stitchLandAreaLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  stitchLandAreaVal: { fontSize: 28, fontWeight: '800' },
  stitchLandAreaUnit: { fontSize: 16, fontWeight: '700' },
  stitchLandAreaSub: { fontSize: 11.5, fontWeight: '500', marginTop: 2 },
  stitchRulerBadge: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  stitchContinueBtn: { height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  stitchContinueBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.8 },

  // Success modal styles
  successOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  successSheet: { width: '100%', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 15, elevation: 10 },
  successIconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  successSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  successSummaryBox: { width: '100%', borderRadius: 16, padding: 16, gap: 12, marginBottom: 24 },
  successSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabelText: { fontSize: 13, fontWeight: '600' },
  summaryValueText: { fontSize: 14, fontWeight: '700' },
  successDoneBtn: { width: '100%', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  successDoneBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
