import React, { useEffect, useState, useRef, useMemo } from 'react';
import MapView, { MapPolygon, PROVIDER_DEFAULT } from '../../components/MapViewWrapper';
import { 
  View, 
  Platform,
  Text, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  RefreshControl,
  Modal,
  Dimensions,
  Image,
  ImageBackground,
  Animated,
  PanResponder,
  StatusBar
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/ThemeContext';
import { useLanguage } from '../../lib/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { preFetchAllSoilTelemetry } from '../../services/soilApiService';
import Svg, {
  Polygon as SvgPolygon,
  Polyline as SvgPolyline,
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient as SvgRadialGradient,
  Stop,
  Rect,
  Ellipse,
  Path,
  G,
  Circle as SvgCircle,
  Line as SvgLine,
} from 'react-native-svg';

import { Asset } from 'expo-asset';

const { width: SW } = Dimensions.get('window');

// ── Top-Level Synchronous Asset Pre-Loading (Module Scope) ──
const EMPTY_FARM_MASCOT = require('../../../assets/images/empty_farm_mascot.png');
const AVATAR_PEEKING = require('../../../assets/images/avatar_peeking_cropped.png');
const AVATAR_WAVING = require('../../../assets/images/avatar_waving_happy.png');
const AVATAR_THINKING = require('../../../assets/images/avatar_thinking.png');
const MASTERCLASS_HIGH_YIELD_IMG = require('../../../assets/images/masterclass_high_yield.jpg');
const MASTERCLASS_CROP_ROTATION_IMG = require('../../../assets/images/masterclass_crop_rotation.jpg');
const MASTERCLASS_GRAIN_STORAGE_IMG = require('../../../assets/images/masterclass_grain_storage.jpg');
const MASTERCLASS_SMART_IRRIGATION_IMG = require('../../../assets/images/masterclass_smart_irrigation.jpg');
const BRAND_ICON = require('../../../assets/icon.png');

// Trigger immediate module-level asset pre-downloading into memory cache
Asset.fromModule(EMPTY_FARM_MASCOT).downloadAsync().catch(() => {});
Asset.fromModule(AVATAR_PEEKING).downloadAsync().catch(() => {});
Asset.fromModule(AVATAR_WAVING).downloadAsync().catch(() => {});
Asset.fromModule(AVATAR_THINKING).downloadAsync().catch(() => {});
Asset.fromModule(BRAND_ICON).downloadAsync().catch(() => {});
Asset.fromModule(MASTERCLASS_HIGH_YIELD_IMG).downloadAsync().catch(() => {});
Asset.fromModule(MASTERCLASS_CROP_ROTATION_IMG).downloadAsync().catch(() => {});
Asset.fromModule(MASTERCLASS_GRAIN_STORAGE_IMG).downloadAsync().catch(() => {});
Asset.fromModule(MASTERCLASS_SMART_IRRIGATION_IMG).downloadAsync().catch(() => {});

try {
  [
    EMPTY_FARM_MASCOT,
    MASTERCLASS_HIGH_YIELD_IMG,
    MASTERCLASS_CROP_ROTATION_IMG,
    MASTERCLASS_GRAIN_STORAGE_IMG,
    MASTERCLASS_SMART_IRRIGATION_IMG
  ].forEach(img => {
    const src = Image.resolveAssetSource(img);
    if (src?.uri) Image.prefetch(src.uri).catch(() => {});
  });
} catch (e) {}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Field {
  id: string;
  name: string;
  area: number;
  area_unit: string;
  crop_type: string;
  soil_type: string | null;
  status: string | null;
  health_score: number | null;
  location_name: string | null;
  boundaries: any; // Using any to match Supabase's Json definition
  planting_date: string | null;
}

type RootStackParamList = {
  Home: undefined;
  AddField: undefined;
  'AI Assistant': undefined;
  Farms: undefined;
  YieldAnalysis: undefined;
};



// ── Field-Personalized AI Smart Tip Generator (<20 words) ──
const generateSmartAITip = (field?: Field | null, language: string = 'en'): string => {
  if (!field) {
    return language === 'ne' 
      ? 'मोनसुन वर्षामा नयाँ बालीको लागि खेतको माटो र पानीको निकास तयारी राख्नुहोस्।'
      : 'Prepare land drainage and soil testing before planting monsoon crops this season.';
  }

  const crop = (field.crop_type || 'Rice').toLowerCase();
  const isPlanted = field.status !== 'planned';

  if (crop.includes('rice') || crop.includes('धान') || crop.includes('paddy')) {
    if (isPlanted) {
      return language === 'ne'
        ? 'धान खेतमा ३-५ सेमि पानी राख्नुहोस् र रोपेको २० दिनपछि युरिया मल हाल्नुहोस्।'
        : 'Maintain 3-5 cm standing water in paddy fields; top-dress urea 20 days post-transplanting.';
    } else {
      return language === 'ne'
        ? 'आगामी हप्ताको भारी वर्षा अघि ढिलो मनसुनी धानको ब्याड तयारी पूरा गर्नुहोस्।'
        : 'Prepare nursery beds for late monsoon rice transplanting before next week heavy rains.';
    }
  }

  if (crop.includes('maize') || crop.includes('मकै')) {
    return language === 'ne'
      ? 'मनसुनी वर्षामा जरै कुहिने रोगबाट जोगाउन मकै खेतमा पानी निकास सुनिश्चित गर्नुहोस्।'
      : 'Ensure proper field drainage to prevent waterlogging and root rot during monsoon showers.';
  }

  if (crop.includes('potato') || crop.includes('आलु') || crop.includes('vegetable')) {
    return language === 'ne'
      ? 'भारी वर्षापछि ढुसीजन्य रोगबाट जोगाउन पातको तल्लो भाग जाँच गरी निकास मिलाउनुहोस्।'
      : 'Inspect leaf undersides for fungal blight after heavy monsoon rains and improve drainage.';
  }

  // Fallback for other crop types
  if (isPlanted) {
    return language === 'ne'
      ? `${field.crop_type} बालीको लागि माटोको ओसिलोपन सन्तुलित राखी नाइट्रोजन मल प्रयोग गर्नुहोस्।`
      : `Keep soil moisture balanced for your ${field.crop_type} and inspect for early weed growth.`;
  } else {
    return language === 'ne'
      ? `${field.crop_type} रोप्न अघि माटोको pH र नाइट्रोजन मात्रा जाँच गरी ब्याड तयार गर्नुहोस्।`
      : `Test soil pH and prepare organic compost for your upcoming ${field.crop_type} planting.`;
  }
};

// ── Soil Physics & Pedotransfer Calibrations ──
const getSoilPercentages = (soilType: string | null) => {
  const type = soilType || 'Loam';
  if (type === 'Clay') return { clay: 50, sand: 20, silt: 30 };
  if (type === 'Sandy') return { clay: 10, sand: 85, silt: 5 };
  if (type === 'Sandy Loam') return { clay: 15, sand: 60, silt: 25 };
  if (type === 'Clay Loam') return { clay: 30, sand: 35, silt: 35 };
  if (type === 'Silt') return { clay: 10, sand: 10, silt: 80 };
  return { clay: 20, sand: 40, silt: 40 }; // Loam fallback
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

// ─── Satellite Preview (same MapView approach as AddFieldScreen) ───
const SatelliteLandBlock = ({ 
  boundaries,
  language = 'en'
}: { 
  boundaries?: any;
  language?: string;
}) => {
  const { colors, isDarkMode } = useTheme();

  const points: { latitude: number; longitude: number }[] = React.useMemo(() => {
    if (!boundaries) return [];
    try {
      const parsed = typeof boundaries === 'string' ? JSON.parse(boundaries) : boundaries;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [boundaries]);

  const region = React.useMemo(() => {
    if (points.length < 3) return null;
    const lats = points.map(p => p.latitude);
    const lons = points.map(p => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max(0.001, (maxLat - minLat) * 2),
      longitudeDelta: Math.max(0.001, (maxLon - minLon) * 2),
    };
  }, [points]);

  if (!region || points.length < 3) {
    return (
      <View style={{ height: 180, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#1a2e1a' : '#e3ecdc', borderRadius: 16, marginTop: 12 }}>
        <Ionicons name="map-outline" size={36} color="#6B8F5E" />
        <Text style={{ color: isDarkMode ? '#8aac7a' : '#4B6B3E', marginTop: 6, fontWeight: '700' }}>
          {language === 'ne' ? 'कुनै नक्सा सीमाङ्कन उपलब्ध छैन' : 'No map boundaries available'}
        </Text>
      </View>
    );
  }

  const mapWidth = SW - 80; // Account for modal padding (20) + card padding (20) on each side

  return (
    <View style={{ width: mapWidth, height: 190, borderRadius: 16, overflow: 'hidden', alignSelf: 'stretch', marginTop: 10 }}>
      <MapView
        style={{ width: mapWidth, height: 190 }}
        initialRegion={region}
        mapType="hybrid"
        maxZoomLevel={20}
        scrollEnabled={false}
        zoomEnabled={true}
        pitchEnabled={false}
        rotateEnabled={false}
        loadingEnabled={true}
        loadingIndicatorColor="#4CAF50"
      >
        <MapPolygon
          coordinates={points}
          strokeColor="#6B8F5E"
          fillColor="rgba(107,143,94,0.3)"
          strokeWidth={2.5}
        />
      </MapView>
      {/* Label badge */}
      <View style={{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 5 }}>
        <Ionicons name="earth-outline" size={13} color="#4CAF50" />
        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
          {language === 'ne' ? 'स्याटेलाइट दृश्य' : 'Satellite View'}
        </Text>
      </View>
    </View>
  );
};

const IsometricLandBlock = ({ 
  cropType, 
  isPlanted,
  boundaries,
  soilType
}: { 
  cropType: string, 
  isPlanted: boolean,
  boundaries?: any,
  soilType?: string | null
}) => {
  return <SatelliteLandBlock boundaries={boundaries} />;
};

const UnusedIsometricLandBlock = ({ 
  cropType, 
  isPlanted,
  boundaries,
  soilType
}: { 
  cropType: string, 
  isPlanted: boolean,
  boundaries?: any,
  soilType?: string | null
}) => {
  const { colors, isDarkMode } = useTheme();
  const W = SW - 40; // Full width minus padding
  const H = 280;

  const [moisture, setMoisture] = useState<number | null>(null);
  const [fetching, setFetching] = useState(true);

  // Centroid calculation
  const centroid = useMemo(() => {
    if (!boundaries || !Array.isArray(boundaries) || boundaries.length === 0) {
      return { latitude: 27.7172, longitude: 85.3240 };
    }
    const lat = boundaries.reduce((s: number, p: any) => s + (p.latitude || 0), 0) / boundaries.length;
    const lon = boundaries.reduce((s: number, p: any) => s + (p.longitude || 0), 0) / boundaries.length;
    return { latitude: lat, longitude: lon };
  }, [boundaries]);

  useEffect(() => {
    let active = true;
    const fetchMoisture = async () => {
      setFetching(true);
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${centroid.latitude}&longitude=${centroid.longitude}&hourly=soil_moisture_0_to_7cm`;
        const res = await Promise.race([
          fetch(url),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500))
        ]);
        const data = await res.json();
        if (!active) return;
        const hourIndex = new Date().getHours();
        const rawVwc = data?.hourly?.soil_moisture_0_to_7cm?.[hourIndex] ?? data?.hourly?.soil_moisture_0_to_7cm?.[0] ?? 0.35;
        
        const { clay, sand, silt } = getSoilPercentages(soilType || null);
        const calibrated = calibrateWaterMoisture(rawVwc * 100, clay, sand, silt);
        setMoisture(calibrated);
      } catch (err) {
        console.warn('WebGL visualizer moisture fetch error:', err);
        if (!active) return;
        const seed = Math.sin(centroid.latitude * 500 + centroid.longitude * 2000);
        const val = Math.abs(Math.sin(seed));
        const rawMock = 20 + val * 22;
        const { clay, sand, silt } = getSoilPercentages(soilType || null);
        const calibrated = calibrateWaterMoisture(rawMock, clay, sand, silt);
        setMoisture(calibrated);
      } finally {
        if (active) setFetching(false);
      }
    };

    fetchMoisture();
    return () => { active = false; };
  }, [centroid, soilType]);

  // Pure Canvas 2D 3D renderer — zero external dependencies
  const htmlSource = useMemo(() => {
    const currentMoisture = moisture !== null ? moisture : 35.0;
    const cropStr = cropType || '';
    const isWateryCrop = cropStr.toLowerCase().includes('rice') || cropStr.toLowerCase().includes('paddy') || cropStr.toLowerCase().includes('धान');
    const actuallyWatery = isWateryCrop && currentMoisture >= 22.0;

    let topColorA = '#7CB86A';
    let topColorB = '#4E9E3E';
    let plantStyle = 'sprout';

    if (currentMoisture < 22.0 && !isWateryCrop) {
      topColorA = '#8E8268';
      topColorB = '#70644E';
    }

    const cropLower = cropStr.toLowerCase();
    if (isWateryCrop) {
      topColorA = actuallyWatery ? '#508D9E' : '#7A6E5D';
      topColorB = actuallyWatery ? '#3A7080' : '#5C5042';
      plantStyle = 'rice';
    } else if (cropLower.includes('wheat') || cropLower.includes('गहुँ')) {
      topColorA = '#F4D068'; topColorB = '#D3A325'; plantStyle = 'wheat';
    } else if (cropLower.includes('maize') || cropLower.includes('corn') || cropLower.includes('मकै')) {
      topColorA = '#6E9E52'; topColorB = '#4C7A34'; plantStyle = 'maize';
    } else if (cropLower.includes('mustard') || cropLower.includes('तोरी')) {
      topColorA = '#EBD047'; topColorB = '#C4AE2B'; plantStyle = 'mustard';
    } else if (cropLower.includes('potato') || cropLower.includes('आलु')) {
      topColorA = '#A08060'; topColorB = '#7A6040'; plantStyle = 'potato';
    } else if (cropLower.includes('coffee') || cropLower.includes('tea') || cropLower.includes('चिया')) {
      topColorA = '#3D6B3A'; topColorB = '#264D24'; plantStyle = 'tea';
    }

    return `
<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>html,body{width:100%;height:100%;margin:0;padding:0;overflow:hidden;touch-action:none;background:#1E1938}
canvas{display:block;width:100%;height:100%}
#lbl{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);
font:700 7px/1 system-ui;color:rgba(255,255,255,0.4);background:rgba(0,0,0,0.35);
padding:4px 10px;border-radius:10px;letter-spacing:1.2px;text-transform:uppercase;pointer-events:none}</style>
</head><body>
<canvas id="c"></canvas>
<div id="lbl">Drag to rotate · Pinch to zoom</div>
<script>
// ===================================================================
// AVANI · HYPER-REALISTIC ISOMETRIC LAND-BLOCK RENDERER (Canvas 2D)
// Pure JS · zero dependencies · crash-proof
// ===================================================================

// ── Crash-proof Error Reporting ─────────────────────────────────────
window.onerror = function (msg, url, line, col, err) {
  try {
    var d = document.createElement('div');
    d.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(220,50,50,0.95);color:#fff;font:10px monospace;padding:12px;z-index:99999;overflow:auto;box-sizing:border-box';
    d.innerHTML = '<b>surveyor error:</b><br>' + msg + '<br>Line: ' + line + '<br>Stack: ' + (err ? err.stack : 'none');
    document.body.appendChild(d);
  } catch (e) {}
  return false;
};

// ── Canvas + Sizing (DPR-aware, but capped for perf) ────────────────
var c = document.getElementById('c');
var g = c.getContext('2d', { alpha: true });
var W = 0, H = 0, DPR = 1;
function sz() {
  var w = window.innerWidth || document.documentElement.clientWidth || 360;
  var h = window.innerHeight || document.documentElement.clientHeight || 280;
  if (w !== W || h !== H) {
    W = w; H = h;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(W * DPR);
    c.height = Math.round(H * DPR);
    c.style.width = W + 'px';
    c.style.height = H + 'px';
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildPatterns();
  }
}
sz();
addEventListener('resize', sz);

// ── Injected state ──────────────────────────────────────────────────
var coords = ${JSON.stringify(boundaries || [])};
var dk = ${isDarkMode}, pl = ${isPlanted}, ps = '${plantStyle}', wt = ${actuallyWatery};
var moist = ${currentMoisture.toFixed(2)};

// ── Safe coordinate parser (unchanged behaviour) ────────────────────
var pts2D = [];
try {
  if (coords && Array.isArray(coords) && coords.length >= 3) {
    var validCoords = [];
    for (var i = 0; i < coords.length; i++) {
      var p = coords[i];
      if (p && typeof p === 'object' && typeof p.latitude === 'number' && typeof p.longitude === 'number') {
        validCoords.push(p);
      }
    }
    if (validCoords.length >= 3) {
      var minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
      for (var i = 0; i < validCoords.length; i++) {
        var p = validCoords[i];
        if (p.latitude < minLat) minLat = p.latitude;
        if (p.latitude > maxLat) maxLat = p.latitude;
        if (p.longitude < minLon) minLon = p.longitude;
        if (p.longitude > maxLon) maxLon = p.longitude;
      }
      var latSpan = maxLat - minLat;
      var lonSpan = maxLon - minLon;
      var maxSpan = Math.max(latSpan, lonSpan) || 1;
      var scale = 205 / maxSpan;
      var cLat = (minLat + maxLat) / 2;
      var cLon = (minLon + maxLon) / 2;
      for (var i = 0; i < validCoords.length; i++) {
        var p = validCoords[i];
        var x = (p.longitude - cLon) * scale;
        var z = -(p.latitude - cLat) * scale;
        pts2D.push([x, z]);
      }
    }
  }
} catch (e) {
  console.error("Coords parsing error: ", e);
}
if (pts2D.length < 3) {
  pts2D = [[-100, 100], [100, 100], [100, -100], [-100, -100]];
}

// ── Block geometry ──────────────────────────────────────────────────
var BH = 45;                 // half extrusion height
var N = pts2D.length;
var V = [];
for (var i = 0; i < N; i++) V.push([pts2D[i][0],  BH, pts2D[i][1]]);
for (var i = 0; i < N; i++) V.push([pts2D[i][0], -BH, pts2D[i][1]]);

var faces = [];
var topIdx = [];
for (var i = 0; i < N; i++) topIdx.push(i);
faces.push({ i: topIdx, t: 'top' });

var botIdx = [];
for (var i = 2 * N - 1; i >= N; i--) botIdx.push(i);
faces.push({ i: botIdx, t: 'bot' });

// Pre-compute side face world normals (for Lambertian shading)
for (var i = 0; i < N; i++) {
  var next = (i + 1) % N;
  var a = pts2D[i], b = pts2D[next];
  var ex = b[0] - a[0], ez = b[1] - a[1];
  var len = Math.hypot(ex, ez) || 1;
  // Outward normal in XZ plane (points away from polygon interior).
  // Winding is CCW in pts2D (lat-z flipped), so normal = (ez, -ex)/len.
  var nrm = [ez / len, 0, -ex / len];
  faces.push({ i: [i, next, next + N, i + N], t: 'side', idx: i, normal: nrm });
}

// ── Camera (touch-drag rotate + pinch-zoom intact) ──────────────────
var rx = -0.44, ry = -0.58;
var zoom = 1.0, targetZoom = 1.0;
var drag = 0, lx = 0, ly = 0, pinchDist = 0;

function getPinchDist(t1, t2) {
  var dx = t1.clientX - t2.clientX;
  var dy = t1.clientY - t2.clientY;
  return Math.hypot(dx, dy);
}

c.addEventListener('touchstart', function (e) {
  if (e.touches.length === 2) {
    drag = 0;
    pinchDist = getPinchDist(e.touches[0], e.touches[1]);
  } else {
    drag = 1; lx = e.touches[0].clientX; ly = e.touches[0].clientY;
  }
  e.preventDefault();
}, { passive: false });

c.addEventListener('touchmove', function (e) {
  if (e.touches.length === 2) {
    var d = getPinchDist(e.touches[0], e.touches[1]);
    if (pinchDist > 0) targetZoom = Math.max(0.6, Math.min(2.2, zoom * (d / pinchDist)));
    pinchDist = d;
  } else if (drag) {
    var dx = e.touches[0].clientX - lx, dy = e.touches[0].clientY - ly;
    ry += dx * 0.007; rx -= dy * 0.007;
    rx = Math.max(-1.15, Math.min(-0.08, rx));
    lx = e.touches[0].clientX; ly = e.touches[0].clientY;
  }
  e.preventDefault();
}, { passive: false });

c.addEventListener('touchend', function () { drag = 0; pinchDist = 0; });

c.addEventListener('mousedown', function (e) { drag = 1; lx = e.clientX; ly = e.clientY; });
addEventListener('mousemove', function (e) {
  if (!drag) return;
  ry += (e.clientX - lx) * 0.007; rx -= (e.clientY - ly) * 0.007;
  rx = Math.max(-1.15, Math.min(-0.08, rx));
  lx = e.clientX; ly = e.clientY;
});
addEventListener('mouseup', function () { drag = 0; });

// Wheel zoom (desktop nicety, no-op on touch)
c.addEventListener('wheel', function (e) {
  targetZoom = Math.max(0.6, Math.min(2.2, targetZoom + (e.deltaY > 0 ? -0.08 : 0.08)));
  e.preventDefault();
}, { passive: false });

// ── 3D transform + projection (zoom-aware) ──────────────────────────
function r3(p) {
  var x = p[0], y = p[1], z = p[2];
  var x1 = x * Math.cos(ry) + z * Math.sin(ry);
  var z1 = -x * Math.sin(ry) + z * Math.cos(ry);
  var y1 = y * Math.cos(rx) - z1 * Math.sin(rx);
  var z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
  return [x1, y1, z2];
}
function pj(p) {
  var r = r3(p), d = 480;
  var s = (d / (d + r[2] + 220)) * zoom;
  return [W / 2 + r[0] * s, H / 2 - r[1] * s, r[2]];
}

// ── World-space bounds ──────────────────────────────────────────────
var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (var i = 0; i < N; i++) {
  var x = pts2D[i][0], z = pts2D[i][1];
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
}
var wSpan = maxX - minX, hSpan = maxZ - minZ;
var cxC = (minX + maxX) / 2, czC = (minZ + maxZ) / 2;

// ── Deterministic PRNG (mulberry32) for stable textures ─────────────
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed() {
  var s = 0;
  for (var i = 0; i < pts2D.length; i++) {
    s += (pts2D[i][0] * 73856093) ^ (pts2D[i][1] * 19349663);
  }
  return s >>> 0;
}
var seedNum = hashSeed() || 12345;

// ── Value-noise 2D (cheap, smooth) ──────────────────────────────────
function makeValueNoise(seed) {
  var rnd = mulberry32(seed);
  var size = 64, grid = new Float32Array(size * size);
  for (var i = 0; i < grid.length; i++) grid[i] = rnd();
  function get(x, y) {
    x = ((x % size) + size) % size;
    y = ((y % size) + size) % size;
    return grid[(y | 0) * size + (x | 0)];
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  return function (x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var v00 = get(xi, yi),     v10 = get(xi + 1, yi);
    var v01 = get(xi, yi + 1), v11 = get(xi + 1, yi + 1);
    var u = smooth(xf), v = smooth(yf);
    return (v00 * (1 - u) + v10 * u) * (1 - v) + (v01 * (1 - u) + v11 * u) * v;
  };
}
var noise2 = makeValueNoise(seedNum);

// ── Procedural patterns (built once per resize) ─────────────────────
var topPattern = null, sidePattern = null;
function buildPatterns() {
  // Top soil noise: organic clods, pebbles, micro-shadows
  var pw = 128, ph = 128;
  var cv = document.createElement('canvas');
  cv.width = pw; cv.height = ph;
  var pg = cv.getContext('2d');
  pg.fillStyle = 'rgba(0,0,0,0)';
  pg.fillRect(0, 0, pw, ph);
  var rnd = mulberry32(seedNum ^ 0x9E37);
  for (var i = 0; i < 600; i++) {
    var px = rnd() * pw, py = rnd() * ph;
    var dark = rnd() > 0.5;
    pg.fillStyle = dark ? 'rgba(20,12,6,' + (0.04 + rnd() * 0.10) + ')'
                        : 'rgba(255,240,210,' + (0.02 + rnd() * 0.06) + ')';
    pg.fillRect(px, py, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  topPattern = g.createPattern(cv, 'repeat');

  // Side soil strata noise (finer)
  var sw = 64, sh = 64;
  var sc2 = document.createElement('canvas');
  sc2.width = sw; sc2.height = sh;
  var sg = sc2.getContext('2d');
  var rnd2 = mulberry32(seedNum ^ 0x1234);
  for (var j = 0; j < 280; j++) {
    var dark = rnd2() > 0.5;
    sg.fillStyle = dark ? 'rgba(0,0,0,' + (0.06 + rnd2() * 0.12) + ')'
                        : 'rgba(255,220,180,' + (0.02 + rnd2() * 0.05) + ')';
    sg.fillRect(rnd2() * sw, rnd2() * sh, 1 + rnd2() * 2, 1 + rnd2() * 2);
  }
  sidePattern = g.createPattern(sc2, 'repeat');
}
buildPatterns();

// ── Lighting ────────────────────────────────────────────────────────
var LIGHT = [W * 0.8, H * 0.15, -150];
function lightDir() { return LIGHT; }
// Lambertian multiplier for a world-space face normal
function lambert(normal) {
  var L = lightDir();
  var lenL = Math.hypot(L[0], L[1], L[2]) || 1;
  // Light points FROM scene TO light source; n·L normalized
  var dot = (normal[0] * L[0] + normal[1] * L[1] + normal[2] * L[2]) / lenL;
  return 0.35 + 0.75 * Math.max(0, dot / (Math.hypot(normal[0], normal[1], normal[2]) || 1));
}
// Transform world normal by current rotation (x,z plane rotation mainly)
function rotatedNormal(n) {
  // Apply the same XZ->rotation as r3 (around Y then around X). y stays ~0 for side normals.
  return r3([n[0], n[1], n[2]]);
}

// ── Colour helpers ──────────────────────────────────────────────────
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function mix(a, b, t) { return a + (b - a) * t; }
function hexToRgb(hex) {
  var h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(rgb, a) { return 'rgba(' + (rgb[0] | 0) + ',' + (rgb[1] | 0) + ',' + (rgb[2] | 0) + ',' + a + ')'; }
function shadeRgb(rgb, m) { return [clamp(rgb[0] * m, 0, 255), clamp(rgb[1] * m, 0, 255), clamp(rgb[2] * m, 0, 255)]; }
function mixRgb(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; }

// Soil palette
var SOIL_LOAM  = hexToRgb('#6b4a35');
var SOIL_CLAY  = hexToRgb('#8a5a3a');
var SOIL_ROCK  = hexToRgb('#5a4a3e');
var SOIL_DEEP  = hexToRgb('#241008');

// Moisture-darkened top palette
var topA = hexToRgb('#${topColorA.replace('#','')}');
var topB = hexToRgb('#${topColorB.replace('#','')}');
var moistFactor = clamp(moist / 45, 0, 1);   // 0 dry .. 1 saturated
// Wet soil is darker & richer; dry is lighter, sandy
var dryA = mixRgb(topA, [180, 160, 120], 1 - moistFactor);
var dryB = mixRgb(topB, [150, 130, 95], 1 - moistFactor);
var wetMul = 0.62 + 0.38 * (1 - moistFactor); // wet->0.62 darkening, dry->1.0
var topA_wet = shadeRgb(dryA, wetMul);
var topB_wet = shadeRgb(dryB, wetMul);

// ── Polygon utils ───────────────────────────────────────────────────
function pathPolygon(pts) {
  if (!pts || pts.length < 2) return;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
}
function isPointInPoly(pt, poly) {
  var x = pt[0], y = pt[1], inside = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var xi = poly[i][0], yi = poly[i][1];
    var xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

// ── Plant positions (organic scatter within boundary) ───────────────
var plantPos = [];
var cols = 8, rows = 8;
var prng = mulberry32(seedNum ^ 0x7777);
for (var r = 0; r < rows; r++) {
  for (var cc = 0; cc < cols; cc++) {
    var px = minX + (cc / (cols - 1)) * wSpan + (prng() - 0.5) * (wSpan / cols) * 0.6;
    var pz = minZ + (r / (rows - 1)) * hSpan + (prng() - 0.5) * (hSpan / rows) * 0.6;
    if (isPointInPoly([px, pz], pts2D)) {
      plantPos.push([px, BH, pz, (prng() - 0.5) * 0.6, 0.85 + prng() * 0.4]); // x,y,z, phase, scale
    }
  }
}

// ── Atmospheric particles (dust/pollen) ─────────────────────────────
var parts = [];
var partsRnd = mulberry32(seedNum ^ 0x42);
for (var i = 0; i < 40; i++) {
  parts.push({
    x: (partsRnd() - 0.5) * wSpan,
    z: (partsRnd() - 0.5) * hSpan,
    y: BH + partsRnd() * 30,
    sp: 0.10 + partsRnd() * 0.18,
    sz: 0.8 + partsRnd() * 1.6,
    drift: partsRnd() * Math.PI * 2,
    driftSp: 0.4 + partsRnd() * 0.8,
    life: partsRnd()
  });
}

// ── Drawing primitives ──────────────────────────────────────────────
function drawQuad(pts, fill) {
  if (!pts || pts.length < 3) return;
  pathPolygon(pts);
  if (fill) { g.fillStyle = fill; g.fill(); }
}
function bbox2D(pts) {
  var mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
  for (var i = 0; i < pts.length; i++) {
    var x = pts[i][0], y = pts[i][1];
    if (x < mnX) mnX = x; if (x > mxX) mxX = x;
    if (y < mnY) mnY = y; if (y > mxY) mxY = y;
  }
  return { mnX: mnX, mxX: mxX, mnY: mnY, mxY: mxY, cx: (mnX + mxX) / 2, cy: (mnY + mxY) / 2 };
}

// ── SOFT GROUND SHADOW (screen-space radial, blurred) ───────────────
function drawGroundShadow() {
  var b = pj([cxC, -BH + 2, czC]);
  var radX = wSpan * 0.55 * zoom;
  var radY = hSpan * 0.18 * zoom;
  g.save();
  g.globalAlpha = dk ? 0.34 : 0.26;
  g.filter = 'blur(' + (6 * zoom) + 'px)';
  var grd = g.createRadialGradient(b[0], b[1] + 6, 0, b[0], b[1] + 6, radX);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.6, 'rgba(0,0,0,0.18)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(b[0], b[1] + 8, radX, radY, ry * 0.2, 0, Math.PI * 2);
  g.fill();
  g.filter = 'none';
  g.restore();
}

// ── TOP FACE: rich textured soil + wetness gradient + furrows ───────
function drawTopFace(pts, t) {
  var bb = bbox2D(pts);
  g.save();
  // Base gradient (radial wetness: darker wet centre when moist)
  var baseGrad = g.createLinearGradient(bb.mnX, bb.mnY, bb.mxX, bb.mxY);
  baseGrad.addColorStop(0, rgba(topA_wet, 1));
  baseGrad.addColorStop(1, rgba(topB_wet, 1));
  pathPolygon(pts);
  g.fillStyle = baseGrad;
  g.fill();
  g.clip();

  // Procedural texture overlay (clods, pebbles, micro-shadows)
  if (topPattern) {
    g.save();
    // translate pattern so it tracks the block
    var ox = bb.cx - 64, oy = bb.cy - 64;
    g.translate(ox, oy);
    g.globalAlpha = 0.9;
    g.fillStyle = topPattern;
    g.fillRect(bb.mnX - ox - 4, bb.mnY - oy - 4, (bb.mxX - bb.mnX) + 8, (bb.mxY - bb.mnY) + 8);
    g.restore();
  }

  // Moisture-driven overlay:
  //  - high moisture: darker rich loam blotches + faint sheen
  //  - low moisture: cracked lighter sandy patterns
  var m = moistFactor;
  if (m > 0.45) {
    // Wet richness — darker organic wet patches
    var wetG = g.createRadialGradient(bb.cx, bb.cy, 4, bb.cx, bb.cy, Math.max(8, (bb.mxX - bb.mnX) * 0.6));
    wetG.addColorStop(0, 'rgba(20,12,6,' + (0.22 * (m - 0.45) / 0.55) + ')');
    wetG.addColorStop(1, 'rgba(20,12,6,0)');
    g.fillStyle = wetG;
    g.fillRect(bb.mnX, bb.mnY, bb.mxX - bb.mnX, bb.mxY - bb.mnY);
  } else {
    // Dry cracks — network of fine polygonal lines
    g.save();
    g.strokeStyle = 'rgba(120,95,60,' + (0.25 * (0.45 - m) / 0.45 + 0.05) + ')';
    g.lineWidth = 0.6;
    var crk = mulberry32(seedNum ^ 0xC4A);
    for (var i = 0; i < 26; i++) {
      var sx = bb.mnX + crk() * (bb.mxX - bb.mnX);
      var sy = bb.mnY + crk() * (bb.mxY - bb.mnY);
      var ang = crk() * Math.PI * 2;
      var len = 8 + crk() * 16;
      g.beginPath();
      g.moveTo(sx, sy);
      var segs = 3;
      for (var k = 1; k <= segs; k++) {
        var jitter = (crk() - 0.5) * 0.5;
        var a = ang + jitter;
        g.lineTo(sx + Math.cos(a) * len * (k / segs), sy + Math.sin(a) * len * (k / segs));
      }
      g.stroke();
    }
    // Sandy speckle lightening
    g.fillStyle = 'rgba(220,200,160,0.06)';
    g.fillRect(bb.mnX, bb.mnY, bb.mxX - bb.mnX, bb.mxY - bb.mnY);
    g.restore();
  }

  // Furrows if field is unplanted
  if (!pl) drawFurrows(bb);

  // Soft top-light sheen
  var sheen = g.createRadialGradient(bb.cx - (bb.mxX - bb.mnX) * 0.2, bb.mnY, 0, bb.cx, bb.cy, Math.max(20, (bb.mxX - bb.mnX) * 0.7));
  sheen.addColorStop(0, 'rgba(255,250,230,0.08)');
  sheen.addColorStop(1, 'rgba(255,250,230,0)');
  g.fillStyle = sheen;
  g.fillRect(bb.mnX, bb.mnY, bb.mxX - bb.mnX, bb.mxY - bb.mnY);

  g.restore();

  // Top edge highlight
  pathPolygon(pts);
  g.strokeStyle = 'rgba(255,255,255,0.16)';
  g.lineWidth = 1;
  g.stroke();
}

// ── Furrows (parallel rows in world X) ──────────────────────────────
function drawFurrows(bb) {
  g.save();
  for (var fx = minX - 10; fx < maxX + 10; fx += 12) {
    var pa = pj([fx, BH, minZ - 10]);
    var pb = pj([fx, BH, maxZ + 10]);
    g.beginPath(); g.moveTo(pa[0], pa[1]); g.lineTo(pb[0], pb[1]);
    g.strokeStyle = 'rgba(0,0,0,0.20)';
    g.lineWidth = 2.0; g.stroke();
    // ridge highlight
    var pa2 = pj([fx + 2, BH, minZ - 10]);
    var pb2 = pj([fx + 2, BH, maxZ + 10]);
    g.beginPath(); g.moveTo(pa2[0], pa2[1]); g.lineTo(pb2[0], pb2[1]);
    g.strokeStyle = 'rgba(255,255,255,0.06)';
    g.lineWidth = 0.8; g.stroke();
  }
  g.restore();
}

// ── SIDE FACE: Lambertian shading + geological strata + roots ───────
function drawSideFace(f, pts, t) {
  var verts = f.i.map(function (vi) { return V[vi]; });
  var topV = [], botV = [];
  for (var i = 0; i < 4; i++) { (verts[i][1] > 0 ? topV : botV).push(pts[i]); }
  if (topV.length < 2 || botV.length < 2) return;

  // Lambertian shading from world normal, re-evaluated after rotation
  var rn = rotatedNormal(f.normal);
  // Light is defined in screen/camera-ish space; approximate view-space lambert:
  // since light at (W*0.8,H*0.15,-150) is roughly in front-top-right, use rotated normal.
  var L = lightDir();
  var nLen = Math.hypot(rn[0], rn[1], rn[2]) || 1;
  var dot = (rn[0] * L[0] + rn[1] * L[1] + rn[2] * L[2]) / (nLen * (Math.hypot(L[0], L[1], L[2]) || 1));
  var lam = 0.40 + 0.78 * clamp((dot + 1) / 2, 0, 1); // remap to [0.4,1.18]

  var tmx = (topV[0][0] + topV[1][0]) / 2, tmy = (topV[0][1] + topV[1][1]) / 2;
  var bmx = (botV[0][0] + botV[1][0]) / 2, bmy = (botV[0][1] + botV[1][1]) / 2;

  g.save();
  pathPolygon(pts);
  g.clip();

  // Multi-stop soil gradient (loam -> clay -> rock -> deep) scaled by light
  var gr = g.createLinearGradient(tmx, tmy, bmx, bmy);
  gr.addColorStop(0.00, rgba(shadeRgb(SOIL_LOAM, lam), 1));
  gr.addColorStop(0.12, rgba(shadeRgb(mixRgb(SOIL_LOAM, SOIL_CLAY, 0.5), lam), 1));
  gr.addColorStop(0.34, rgba(shadeRgb(SOIL_CLAY, lam), 1));
  gr.addColorStop(0.58, rgba(shadeRgb(mixRgb(SOIL_CLAY, SOIL_ROCK, 0.55), lam), 1));
  gr.addColorStop(0.80, rgba(shadeRgb(SOIL_ROCK, lam), 1));
  gr.addColorStop(1.00, rgba(shadeRgb(SOIL_DEEP, lam), 1));
  g.fillStyle = gr;
  g.fillRect(Math.min(tmx, bmx) - 8, Math.min(tmy, bmy) - 8,
             Math.abs(tmx - bmx) + 16, Math.abs(tmy - bmy) + 16);

  // Geological strata bands (warped sine waves along face height)
  drawStrata(topV, botV, lam);

  // Side soil noise pattern
  if (sidePattern) {
    g.save();
    g.globalAlpha = 0.5;
    g.fillStyle = sidePattern;
    var bx = Math.min(tmx, bmx) - 8, by = Math.min(tmy, bmy) - 8;
    g.fillRect(bx, by, Math.abs(tmx - bmx) + 16, Math.abs(tmy - bmy) + 16);
    g.restore();
  }

  // Root hairs descending from top edge
  drawRoots(topV, botV);

  g.restore();

  // Wetness border: darken the very top band where soil meets surface (more if wet)
  var wetEdge = clamp(moistFactor, 0, 1);
  if (wetEdge > 0.05) {
    var weg = g.createLinearGradient(tmx, tmy, tmx, tmy + 10);
    weg.addColorStop(0, 'rgba(10,6,3,' + (0.5 * wetEdge) + ')');
    weg.addColorStop(1, 'rgba(10,6,3,0)');
    g.save();
    pathPolygon(pts);
    g.clip();
    g.fillStyle = weg;
    g.fillRect(Math.min(tmx, bmx) - 8, tmy - 1, Math.abs(tmx - bmx) + 16, 12);
    g.restore();
  }

  // Edge stroke
  pathPolygon(pts);
  g.strokeStyle = 'rgba(0,0,0,0.28)';
  g.lineWidth = 0.8;
  g.stroke();
}

// ── Strata bands (organic warped layers) ────────────────────────────
function drawStrata(topV, botV, lam) {
  var sx0 = topV[0][0], sy0 = topV[0][1];
  var sx1 = topV[1][0], sy1 = topV[1][1];
  var bx0 = botV[0][0], by0 = botV[0][1];
  var bx1 = botV[1][0], by1 = botV[1][1];
  var faceLen = Math.hypot(sx1 - sx0, sy1 - sy0) || 1;
  var faceH = Math.hypot(bx0 - sx0, by0 - sy0) || 1;
  var bands = [
    { p: 0.30, col: mixRgb(SOIL_CLAY, [110, 80, 55], 0.4), thick: 0.06, amp: 2.2, freq: 0.05, ph: 0.2 },
    { p: 0.52, col: mixRgb(SOIL_ROCK, [70, 55, 45], 0.5), thick: 0.04, amp: 3.0, freq: 0.04, ph: 1.7 },
    { p: 0.74, col: mixRgb(SOIL_ROCK, [45, 35, 28], 0.5), thick: 0.05, amp: 1.8, freq: 0.06, ph: 3.1 }
  ];
  for (var bi = 0; bi < bands.length; bi++) {
    var bnd = bands[bi];
    var col = shadeRgb(bnd.col, lam);
    // build a warped ribbon along the face from top to bottom at param p
    var steps = 16;
    g.beginPath();
    for (var s = 0; s <= steps; s++) {
      var u = s / steps;
      // top edge point
      var tx = sx0 + (sx1 - sx0) * u;
      var ty = sy0 + (sy1 - sy0) * u;
      // bottom edge point
      var bxp = bx0 + (bx1 - bx0) * u;
      var byp = by0 + (by1 - by0) * u;
      // parametric height position with organic warp
      var warp = Math.sin(u * Math.PI * 2 * (faceLen * bnd.freq) + bnd.ph) * bnd.amp;
      var p = bnd.p + warp / Math.max(8, faceH);
      var x = tx + (bxp - tx) * p;
      var y = ty + (byp - ty) * p;
      if (s === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    // back along p+thick
    for (var s2 = steps; s2 >= 0; s2--) {
      var u2 = s2 / steps;
      var tx2 = sx0 + (sx1 - sx0) * u2;
      var ty2 = sy0 + (sy1 - sy0) * u2;
      var bxp2 = bx0 + (bx1 - bx0) * u2;
      var byp2 = by0 + (by1 - by0) * u2;
      var warp2 = Math.sin(u2 * Math.PI * 2 * (faceLen * bnd.freq) + bnd.ph) * bnd.amp;
      var p2 = clamp(bnd.p + bnd.thick + warp2 / Math.max(8, faceH), 0, 1);
      var x2 = tx2 + (bxp2 - tx2) * p2;
      var y2 = ty2 + (byp2 - ty2) * p2;
      g.lineTo(x2, y2);
    }
    g.closePath();
    g.fillStyle = rgba(col, 0.85);
    g.fill();
    // thin dark separator under band
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 0.5;
    g.stroke();
  }
}

// ── Root hair fibers ────────────────────────────────────────────────
function drawRoots(topV, botV) {
  var sx0 = topV[0][0], sy0 = topV[0][1];
  var sx1 = topV[1][0], sy1 = topV[1][1];
  var bx0 = botV[0][0], by0 = botV[0][1];
  var bx1 = botV[1][0], by1 = botV[1][1];
  var faceH = Math.hypot(bx0 - sx0, by0 - sy0) || 1;
  var rnd = mulberry32(seedNum ^ (Math.floor(sx0) * 31 + Math.floor(sy0)));
  var n = 7;
  g.save();
  g.strokeStyle = 'rgba(40,25,15,0.5)';
  for (var i = 0; i < n; i++) {
    var u = 0.1 + rnd() * 0.8;
    var tx = sx0 + (sx1 - sx0) * u, ty = sy0 + (sy1 - sy0) * u;
    var bxp = bx0 + (bx1 - bx0) * u, byp = by0 + (by1 - by0) * u;
    var depth = 0.15 + rnd() * 0.5;     // how far down root reaches
    var branches = 2 + (rnd() * 3 | 0);
    // main root
    var mx = tx + (bxp - tx) * depth;
    var my = ty + (byp - ty) * depth;
    g.beginPath();
    g.moveTo(tx, ty);
    g.quadraticCurveTo(tx + (mx - tx) * 0.5 + (rnd() - 0.5) * 4, ty + (my - ty) * 0.5, mx, my);
    g.lineWidth = 0.7;
    g.stroke();
    // micro branches
    for (var b = 0; b < branches; b++) {
      var bu = 0.4 + rnd() * 0.5;
      var ssx = tx + (mx - tx) * bu, ssy = ty + (my - ty) * bu;
      var ang = (rnd() - 0.5) * 1.2;
      var bl = 3 + rnd() * 6;
      g.beginPath();
      g.moveTo(ssx, ssy);
      g.lineTo(ssx + Math.cos(ang) * bl, ssy + Math.sin(ang) * bl + (rnd() * 2));
      g.lineWidth = 0.4;
      g.strokeStyle = 'rgba(40,25,15,0.35)';
      g.stroke();
    }
  }
  g.restore();
}

// ── Bottom face ─────────────────────────────────────────────────────
function drawBottomFace(pts) {
  drawQuad(pts, '#0c0604');
}

// ── Face dispatcher ─────────────────────────────────────────────────
function drawFace(f, t) {
  var pts = f.i.map(function (vi) { return pj(V[vi]); });
  if (!pts || pts.length < 3) return;
  if (f.t === 'bot') { drawBottomFace(pts); return; }
  if (f.t === 'top') { drawTopFace(pts, t); return; }
  if (f.t === 'side') { drawSideFace(f, pts, t); return; }
}

// ── Holographic top grid ────────────────────────────────────────────
function drawGrid() {
  var tp = topIdx.map(function (i) { return pj(V[i]); });
  if (!tp || tp.length < 3) return;
  g.save();
  g.globalAlpha = 0.16;
  g.strokeStyle = dk ? '#00e5ff' : '#1b8a99';
  g.lineWidth = 0.5;
  pathPolygon(tp);
  g.setLineDash([3, 3]);
  g.stroke();
  g.setLineDash([]);
  g.restore();
}

// ── Wind field: unified propagating wave across the field ───────────
function windOffset(worldX, worldZ, t) {
  // Primary wave propagates along +X; secondary cross wave adds variety
  var speed = 0.0009;
  var wave1 = Math.sin(worldX * 0.018 - t * speed * 1.0) * 1.0;
  var wave2 = Math.sin(worldX * 0.009 + worldZ * 0.012 - t * speed * 0.7) * 0.5;
  var gust = noise2(worldX * 0.01 + t * 0.0002, worldZ * 0.01) * 0.6;
  return (wave1 + wave2 + gust) * 1.2;
}

// ── Plant shadow on soil ────────────────────────────────────────────
function drawPlantShadow(pos, s) {
  var base = pj(pos);
  g.save();
  g.globalAlpha = 0.22;
  var rad = 6 * s * zoom;
  var grd = g.createRadialGradient(base[0] + 3 * s, base[1] + 1, 0, base[0] + 3 * s, base[1] + 1, rad);
  grd.addColorStop(0, 'rgba(0,0,0,0.5)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(base[0] + 3 * s, base[1] + 1, rad, rad * 0.45, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// ── Plant renderers ─────────────────────────────────────────────────
function drawPlant(pos, t, idx) {
  var pp = pj(pos);
  var d = 480, s = (d / (d + pp[2] + 220)) * zoom * (pos[4] || 1);
  var px = pp[0], py = pp[1];
  var h = 30 * s;
  // Unified wind sway based on world position
  var sway = windOffset(pos[0], pos[2], t) * 3.2 * s;

  if (ps === 'rice') drawRice(px, py, h, s, sway, t, pos);
  else if (ps === 'wheat') drawWheat(px, py, h, s, sway, t, pos);
  else if (ps === 'maize') drawMaize(px, py, h, s, sway, t, pos);
  else if (ps === 'mustard') drawMustard(px, py, h, s, sway, t, pos);
  else if (ps === 'potato') drawPotato(px, py, h, s, sway, t, pos);
  else drawSprout(px, py, h, s, sway, t, pos);
}

// Rice: multi-shoot stalks, tapering blades, drooping golden panicles
function drawRice(px, py, h, s, sway, t, pos) {
  var shoots = [-1, 0, 1];
  for (var si = 0; si < shoots.length; si++) {
    var i = shoots[si];
    var ox = i * 3.5 * s;
    var localSway = sway * (0.8 + Math.abs(i) * 0.35);
    var topX = px + ox + localSway;
    var topY = py - h;
    // blade (tapered via two quadratic curves forming a slim leaf)
    g.beginPath();
    g.moveTo(px + ox - 1.0 * s, py);
    g.quadraticCurveTo(px + ox + localSway * 0.5 - 0.8 * s, py - h * 0.5, topX - 0.4 * s, topY);
    g.quadraticCurveTo(px + ox + localSway * 0.5 + 0.8 * s, py - h * 0.5, px + ox + 1.0 * s, py);
    g.closePath();
    var lg = g.createLinearGradient(px + ox, py, topX, topY);
    lg.addColorStop(0, '#2e7d32'); lg.addColorStop(1, '#aed581');
    g.fillStyle = lg; g.fill();
    g.strokeStyle = '#1b5e20'; g.lineWidth = 0.4; g.stroke();

    // Drooping golden panicle at tip
    var panX = topX + localSway * 0.4 + 2 * s;
    var panY = topY + 4 * s;
    g.strokeStyle = '#b8860b'; g.lineWidth = Math.max(0.6, 1.0 * s);
    g.beginPath(); g.moveTo(topX, topY); g.quadraticCurveTo(topX + 2 * s, topY + 2 * s, panX, panY); g.stroke();
    var grains = 6;
    for (var gi = 0; gi < grains; gi++) {
      var gu = gi / (grains - 1);
      var gx = topX + (panX - topX) * gu;
      var gy = topY + (panY - topY) * gu;
      var off = (gi % 2 === 0 ? 1 : -1) * (1.4 + gu * 0.6) * s;
      g.beginPath();
      g.ellipse(gx + off, gy + 0.6 * s, 1.0 * s, 1.8 * s, 0.3, 0, Math.PI * 2);
      g.fillStyle = gi % 2 ? '#f0c419' : '#d4af37';
      g.fill();
    }
  }
}

// Wheat: segmented golden stem + bearded ear pointing up
function drawWheat(px, py, h, s, sway, t, pos) {
  var topX = px + sway, topY = py - h * 1.15;
  // stem with subtle segmentation
  var segs = 4;
  g.beginPath(); g.moveTo(px, py);
  for (var i = 1; i <= segs; i++) {
    var u = i / segs;
    g.lineTo(px + sway * u, py - h * 1.15 * u);
  }
  var stemG = g.createLinearGradient(px, py, topX, topY);
  stemG.addColorStop(0, '#a98a4a'); stemG.addColorStop(1, '#e6c46b');
  g.strokeStyle = stemG; g.lineWidth = Math.max(0.8, 1.4 * s); g.stroke();

  // awns (beard) radiating up
  g.strokeStyle = '#e3c77a'; g.lineWidth = Math.max(0.4, 0.7 * s);
  var awnN = 6;
  for (var a = 0; a < awnN; a++) {
    var au = a / (awnN - 1) - 0.5;
    g.beginPath();
    g.moveTo(topX, topY + h * 0.05);
    g.quadraticCurveTo(topX + au * 8 * s, topY - h * 0.12, topX + au * 11 * s, topY - h * 0.22);
    g.stroke();
  }
  // ear grains (overlapping ellipses)
  var earN = 5;
  for (var e = 0; e < earN; e++) {
    var eu = e / (earN - 1);
    var ey = topY + h * 0.02 + eu * h * 0.18;
    var gcol = e % 2 ? '#d4af37' : '#c9a227';
    g.beginPath();
    g.ellipse(topX - 1.4 * s, ey, 1.2 * s, 2.4 * s, -0.3, 0, Math.PI * 2);
    g.fillStyle = gcol; g.fill();
    g.beginPath();
    g.ellipse(topX + 1.4 * s, ey, 1.2 * s, 2.4 * s, 0.3, 0, Math.PI * 2);
    g.fillStyle = e % 2 ? '#c9a227' : '#d4af37'; g.fill();
  }
  // tip
  g.beginPath(); g.ellipse(topX, topY - h * 0.02, 1.4 * s, 2.6 * s, 0, 0, Math.PI * 2);
  g.fillStyle = '#b8860b'; g.fill();
}

// Maize: thick stalk + broad leaves + cob
function drawMaize(px, py, h, s, sway, t, pos) {
  var topX = px + sway * 0.3, topY = py - h * 1.3;
  g.beginPath(); g.moveTo(px, py); g.lineTo(topX, topY);
  var sg = g.createLinearGradient(px, py, topX, topY);
  sg.addColorStop(0, '#33691e'); sg.addColorStop(1, '#558b2f');
  g.strokeStyle = sg; g.lineWidth = Math.max(1.2, 3 * s); g.stroke();
  // leaves
  function leaf(bx, by, dir) {
    g.beginPath();
    g.moveTo(bx, by);
    g.quadraticCurveTo(bx + dir * 16 * s, by - h * 0.1, bx + dir * 20 * s, by + h * 0.02);
    g.quadraticCurveTo(bx + dir * 16 * s, by - h * 0.04, bx, by + 2 * s);
    g.closePath();
    var lg = g.createLinearGradient(bx, by, bx + dir * 20 * s, by);
    lg.addColorStop(0, '#558b2f'); lg.addColorStop(1, '#7cb342');
    g.fillStyle = lg; g.fill();
    g.strokeStyle = '#33691e'; g.lineWidth = 0.4; g.stroke();
  }
  leaf(px + sway * 0.2, py - h * 0.5, -1);
  leaf(px + sway * 0.25, py - h * 0.75, 1);
  // cob
  g.save();
  g.translate(px + 5 * s + sway * 0.15, py - h * 0.55);
  g.rotate(0.4);
  g.beginPath(); g.ellipse(0, 0, 2.8 * s, 6 * s, 0, 0, Math.PI * 2);
  var cg = g.createLinearGradient(-3 * s, 0, 3 * s, 0);
  cg.addColorStop(0, '#f0c419'); cg.addColorStop(1, '#c79b00');
  g.fillStyle = cg; g.fill();
  // kernels
  g.fillStyle = '#fbc02d';
  for (var k = 0; k < 5; k++) {
    for (var kk = 0; kk < 3; kk++) {
      g.beginPath(); g.arc((-2 + kk * 2) * s, (-4 + k * 2) * s, 0.7 * s, 0, Math.PI * 2); g.fill();
    }
  }
  g.restore();
  // husk leaves atop cob
  g.strokeStyle = '#7cb342'; g.lineWidth = Math.max(0.5, 1 * s);
  g.beginPath(); g.moveTo(px + 5 * s + sway * 0.15, py - h * 0.55 - 6 * s);
  g.quadraticCurveTo(px + 5 * s + sway * 0.15 + 6 * s, py - h * 0.7, px + 12 * s + sway * 0.15, py - h * 0.78);
  g.stroke();
}

// Mustard: stem + clusters of yellow flowers
function drawMustard(px, py, h, s, sway, t, pos) {
  var topX = px + sway, topY = py - h;
  g.beginPath(); g.moveTo(px, py);
  g.quadraticCurveTo(px + sway * 0.5, py - h * 0.5, topX, topY);
  var stg = g.createLinearGradient(px, py, topX, topY);
  stg.addColorStop(0, '#33691e'); stg.addColorStop(1, '#558b2f');
  g.strokeStyle = stg; g.lineWidth = Math.max(0.8, 1.4 * s); g.stroke();
  // leaves
  g.fillStyle = '#558b2f';
  g.beginPath(); g.ellipse(px + sway * 0.3 - 4 * s, py - h * 0.4, 3 * s, 1.6 * s, -0.4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(px + sway * 0.3 + 4 * s, py - h * 0.6, 3 * s, 1.6 * s, 0.4, 0, Math.PI * 2); g.fill();
  // flower clusters
  var cs = [[0, -1], [3 * s, -4 * s], [-3 * s, -3 * s], [2 * s, -7 * s], [-2 * s, -6 * s]];
  for (var i = 0; i < cs.length; i++) {
    var fx = topX + cs[i][0], fy = topY + cs[i][1];
    g.beginPath(); g.arc(fx, fy, 2.2 * s, 0, Math.PI * 2);
    g.fillStyle = '#fff176'; g.fill();
    g.beginPath(); g.arc(fx, fy, 1.1 * s, 0, Math.PI * 2);
    g.fillStyle = '#fbc02d'; g.fill();
  }
}

// Potato: low bushy mound
function drawPotato(px, py, h, s, sway, t, pos) {
  var cy = py - 7 * s;
  g.beginPath(); g.ellipse(px, cy, 12 * s, 8 * s, 0, 0, Math.PI * 2);
  var mg = g.createRadialGradient(px - 3 * s, cy - 3 * s, 1, px, cy, 12 * s);
  mg.addColorStop(0, '#558b2f'); mg.addColorStop(1, '#33691e');
  g.fillStyle = mg; g.fill();
  // leafy tufts
  for (var i = 0; i < 6; i++) {
    var a = (i / 6) * Math.PI * 2;
    g.beginPath();
    g.ellipse(px + Math.cos(a) * 8 * s, cy + Math.sin(a) * 5 * s - 2 * s, 3 * s, 2 * s, a, 0, Math.PI * 2);
    g.fillStyle = '#7cb342'; g.fill();
  }
  // tiny white flowers
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(px - 3 * s, cy - 4 * s, 1.2 * s, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(px + 4 * s, cy - 3 * s, 1.2 * s, 0, Math.PI * 2); g.fill();
}

// Sprout (default young seedling)
function drawSprout(px, py, h, s, sway, t, pos) {
  // two tapered leaves
  function seedLeaf(dir) {
    g.beginPath();
    g.moveTo(px, py);
    g.quadraticCurveTo(px + dir * 6 * s + sway * 0.5, py - h * 0.55, px + dir * 7 * s + sway, py - h * 0.8);
    g.quadraticCurveTo(px + dir * 4 * s + sway * 0.5, py - h * 0.6, px, py);
    g.closePath();
    var lg = g.createLinearGradient(px, py, px + dir * 7 * s, py - h * 0.8);
    lg.addColorStop(0, '#2e7d32'); lg.addColorStop(1, '#9ccc65');
    g.fillStyle = lg; g.fill();
    g.strokeStyle = '#1b5e20'; g.lineWidth = 0.4; g.stroke();
  }
  seedLeaf(-1); seedLeaf(1);
}

// ── Volumetric water layer ──────────────────────────────────────────
function drawWater(t) {
  // Slightly above top face (y = BH + 2). Underwater top soil gets a subtle
  // refraction displacement drawn as a warped re-shade of the top quad.
  var wV = pts2D.map(function (pt) { return [pt[0], BH + 2, pt[1]]; });
  var pts = wV.map(function (v) { return pj(v); });
  if (!pts || pts.length < 3) return;
  var bb = bbox2D(pts);

  // Refraction: re-draw a faint warped copy of soil tint beneath the water
  g.save();
  pathPolygon(pts);
  g.clip();
  var refractAmp = 1.2;
  for (var yy = bb.mnY; yy < bb.mxY; yy += 6) {
    var dx = Math.sin(t * 0.003 + yy * 0.05) * refractAmp;
    g.fillStyle = 'rgba(' + ((topA_wet[0] * 0.5) | 0) + ',' + ((topA_wet[1] * 0.5) | 0) + ',' + ((topA_wet[2] * 0.5) | 0) + ',0.10)';
    g.fillRect(bb.mnX + dx, yy, bb.mxX - bb.mnX, 3);
  }
  g.restore();

  // Water surface — animated opacity
  var op = 0.45 + Math.sin(t * 0.0018) * 0.06;
  g.save();
  g.globalAlpha = op;
  var wg = g.createLinearGradient(bb.cx, bb.mnY, bb.cx, bb.mxY);
  wg.addColorStop(0, 'rgba(20,90,160,0.55)');
  wg.addColorStop(1, 'rgba(10,60,120,0.62)');
  drawQuad(pts, null);
  pathPolygon(pts);
  g.fillStyle = wg;
  g.fill();
  g.clip();

  // Double-layer ripple system
  drawRipples(bb, t, 0);
  drawRipples(bb, t, Math.PI / 2);

  // Moving specular glints
  var glints = 5;
  for (var i = 0; i < glints; i++) {
    var gx = bb.cx + Math.sin(t * 0.0008 + i * 1.7) * (bb.mxX - bb.mnX) * 0.32;
    var gy = bb.cy + Math.cos(t * 0.0011 + i * 2.3) * (bb.mxY - bb.mnY) * 0.32;
    var gr = (6 + (i % 3) * 3) * zoom;
    var rg = g.createRadialGradient(gx, gy, 0, gx, gy, gr);
    rg.addColorStop(0, 'rgba(255,255,255,' + (0.4 * (0.5 + 0.5 * Math.sin(t * 0.002 + i))) + ')');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  }
  g.restore();

  // Wetness border at water/soil intersection
  g.save();
  pathPolygon(pts);
  g.strokeStyle = 'rgba(5,20,40,0.5)';
  g.lineWidth = 2.2;
  g.stroke();
  // inner soft highlight
  pathPolygon(pts);
  g.strokeStyle = 'rgba(180,220,255,0.25)';
  g.lineWidth = 0.8;
  g.stroke();
  g.restore();
}

// Ripple layer
function drawRipples(bb, t, phase) {
  var spacing = 11, amp = 1.6, freq = 0.05;
  g.beginPath();
  for (var y = bb.mnY - 8; y < bb.mxY + 8; y += 4) {
    var started = false;
    for (var x = bb.mnX - 8; x < bb.mxX + 8; x += 6) {
      var dy = Math.sin(t * 0.0025 + x * freq + y * 0.06 + phase) * amp;
      if (!started) { g.moveTo(x, y + dy); started = true; }
      else g.lineTo(x, y + dy);
    }
  }
  g.strokeStyle = 'rgba(220,240,255,' + (0.18 + Math.sin(t * 0.002 + phase) * 0.06) + ')';
  g.lineWidth = 0.7;
  g.stroke();
}

// ── Atmospheric particles ───────────────────────────────────────────
function drawParticles(t) {
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    p.y += p.sp;
    if (p.y > BH + 40) { p.y = BH - 10; p.life = 0; p.x = (partsRnd() - 0.5) * wSpan; p.z = (partsRnd() - 0.5) * hSpan; }
    p.life = Math.min(1, p.life + 0.005);
    var drift = Math.sin(t * 0.001 * p.driftSp + p.drift) * 6;
    var wp = pj([cxC + p.x + drift, p.y, czC + p.z]);
    var depth = wp[2];
    var s = (480 / (480 + depth + 220)) * zoom * p.sz;
    var alpha = 0.5 * Math.sin(p.life * Math.PI);
    if (alpha <= 0) continue;
    var glow = g.createRadialGradient(wp[0], wp[1], 0, wp[0], wp[1], Math.max(1, s * 2.4));
    glow.addColorStop(0, dk ? 'rgba(180,220,255,' + alpha + ')' : 'rgba(255,240,180,' + alpha + ')');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow;
    g.beginPath();
    g.arc(wp[0], wp[1], Math.max(1, s * 2.4), 0, Math.PI * 2);
    g.fill();
  }
}

// ── Sky + celestial body ────────────────────────────────────────────
function drawSky() {
  var bg;

  // Water layer (if watery crop)
  if (wt) drawWater(t);

  // Plants (depth sorted) with shadows
  if (pl && plantPos.length > 0) {
    var sortedPlants = plantPos.map(function (p, i) {
      return { p: p, d: r3([p[0], p[1], p[2]])[2], i: i };
    }).sort(function (a, b) { return a.d - b.d; });
    // shadows first (all), then plants
    for (var i = 0; i < sortedPlants.length; i++) {
      var sp = sortedPlants[i].p;
      drawPlantShadow([sp[0], BH, sp[2]], (sp[4] || 1));
    }
    for (var i = 0; i < sortedPlants.length; i++) drawPlant(sortedPlants[i].p, t, sortedPlants[i].i);
  }

  drawParticles(t);

  if (!drag) ry += 0.003;
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
</script></body></html>
    `;
  }, [cropType, isPlanted, isDarkMode, moisture, boundaries]);


  // Dimensions
  const midY = 120; // for HUD position matching

  return (
    <View style={styles.isoContainer}>
      <View style={[
        styles.skyDomeCard,
        {
          borderColor: colors.border,
          backgroundColor: isDarkMode ? '#171424' : '#E0F2F1',
          width: W,
          height: 260,
        }
      ]}>
        {fetching ? (
          <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.brandGreen} />
            <Text style={{ marginTop: 14, color: isDarkMode ? '#8E9A9B' : '#5C7072', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 }}>
              SCANNING SOIL STRATA...
            </Text>
          </View>
        ) : (
          /* Real-time 3D Canvas Renderer (zero external deps) */
          <View style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: 22 }}>
            <WebView 
              originWhitelist={['*']}
              source={{ html: htmlSource, baseUrl: '' }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              style={{ flex: 1, backgroundColor: 'transparent' }}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
            />
          </View>
        )}

      </View>
    </View>
  );
};

// â”€â”€ Mini 2D Map Polygon Visualizer Component â”€â”€
const MiniMapPolygon = ({ points }: { points: { latitude: number; longitude: number; }[] }) => {
  if (!points || points.length < 3) return null;

  const width = 160;
  const height = 110;

  // Normalize points to fit bounding box (10 to width-10, 10 to height-10)
  const lats = points.map(p => p.latitude);
  const lons = points.map(p => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);

  const latSpan = maxLat - minLat || 0.0001;
  const lonSpan = maxLon - minLon || 0.0001;

  const svgPoints = points.map(p => {
    // Flip Y because SVG coordinates start top-left
    const x = 15 + ((p.longitude - minLon) / lonSpan) * (width - 30);
    const y = (height - 15) - ((p.latitude - minLat) / latSpan) * (height - 30);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <View style={styles.miniMapContainer}>
      <Svg width={width} height={height}>
        <SvgPolygon 
          points={svgPoints} 
          fill="rgba(107, 143, 94, 0.2)" 
          stroke="#6B8F5E" 
          strokeWidth={2}
        />
        {/* Draw vertices */}
        {points.map((_, idx) => {
          const [x, y] = svgPoints.split(' ')[idx].split(',');
          return (
            <SvgPolygon 
              key={idx}
              points={`${parseFloat(x)-2},${parseFloat(y)-2} ${parseFloat(x)+2},${parseFloat(y)-2} ${parseFloat(x)+2},${parseFloat(y)+2} ${parseFloat(x)-2},${parseFloat(y)+2}`}
              fill="#FFFFFF"
            />
          );
        })}
      </Svg>
    </View>
  );
};

const parseLocalDate = (dateStr: string | null | undefined): Date => {
  if (!dateStr) return new Date();
  const cleanStr = dateStr.split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day);
    }
  }
  return new Date(dateStr);
};

const calculateDynamicHealthScore = (field: Field): number => {
  const baseScore = field.health_score ?? (field.status === 'planned' ? 86 : 88);
  if (!field.crop_type) return baseScore;

  const crop = field.crop_type.toLowerCase();
  const dateStr = field.planting_date || null;
  if (!dateStr) return baseScore;

  const month = parseLocalDate(dateStr).getMonth(); // 0 = Jan, 11 = Dec
  let seasonAdjustment = 0;

  if (crop.includes('rice') || crop.includes('paddy') || crop.includes('धान')) {
    if (month === 5 || month === 6) seasonAdjustment = 4; // Jun-Jul (Optimal Monsoon)
    else if (month === 4 || month === 7) seasonAdjustment = -8;
    else seasonAdjustment = -22; // Off-season planting
  } else if (crop.includes('wheat') || crop.includes('गहुँ')) {
    if (month === 10) seasonAdjustment = 5; // Nov (Optimal Winter)
    else if (month === 9 || month === 11) seasonAdjustment = -5;
    else if (month === 0) seasonAdjustment = -18; // Late Jan heat stress
    else seasonAdjustment = -28; // Off-season
  } else if (crop.includes('maize') || crop.includes('corn') || crop.includes('मकै')) {
    if (month >= 2 && month <= 4) seasonAdjustment = 4; // Mar-May (Optimal Spring)
    else if (month === 5 || month === 6) seasonAdjustment = 0; // Summer Monsoon
    else seasonAdjustment = -20; // Off-season
  } else if (crop.includes('potato') || crop.includes('आलु')) {
    if (month === 9 || month === 10) seasonAdjustment = 5; // Oct-Nov (Optimal Winter)
    else if (month === 8 || month === 11) seasonAdjustment = -6;
    else seasonAdjustment = -24; // Off-season heat
  } else if (crop.includes('mustard') || crop.includes('तोरी')) {
    if (month === 9 || month === 10) seasonAdjustment = 5; // Oct-Nov (Optimal Autumn)
    else if (month === 8 || month === 11) seasonAdjustment = -8;
    else seasonAdjustment = -25; // Off-season aphid & heat risk
  }

  return Math.max(35, Math.min(98, baseScore + seasonAdjustment));
};

const generateConciseAIAdvisorTip = (field: Field | undefined | null, language: string): string => {
  if (!field) {
    return language === 'ne' 
      ? 'नक्सामा आफ्नो नयाँ खेत थप्नुहोस् र अवनि AI सँग बाली स्वास्थ्य तथा उत्पादन विश्लेषण सुरु गर्नुहोस्।' 
      : 'Map your field to receive AI recommendations on crop stages, weather impact, and harvest yields.';
  }

  const crop = field.crop_type || 'Rice';
  const stageInfo = calculateGrowthStage(crop, field.planting_date, field.status, language);
  const stageName = stageInfo.stageName;
  const healthScore = calculateDynamicHealthScore(field);
  const isPlanned = field.status === 'planned';

  const cropLower = crop.toLowerCase();
  let cropName = 'Rice';
  let nepaliCrop = 'धान';
  if (cropLower.includes('maize') || cropLower.includes('corn') || cropLower.includes('मकै')) { cropName = 'Maize'; nepaliCrop = 'मकै'; }
  else if (cropLower.includes('wheat') || cropLower.includes('गहुँ')) { cropName = 'Wheat'; nepaliCrop = 'गहुँ'; }
  else if (cropLower.includes('potato') || cropLower.includes('आलु')) { cropName = 'Potato'; nepaliCrop = 'आलु'; }
  else if (cropLower.includes('mustard') || cropLower.includes('तोरी')) { cropName = 'Mustard'; nepaliCrop = 'तोरी'; }

  const month = field.planting_date ? new Date(field.planting_date).getMonth() : new Date().getMonth();
  let seasonNoteEn = '';
  let seasonNoteNe = '';
  if (cropName === 'Wheat' && month === 0) {
    seasonNoteEn = ' • Late sowing heat risk';
    seasonNoteNe = ' • ढिलो रोपाई जोखिम';
  } else if (cropName === 'Rice' && (month === 5 || month === 6)) {
    seasonNoteEn = ' • Monsoon optimal';
    seasonNoteNe = ' • मनसुन उपयुक्त';
  }

  if (isPlanned) {
    return language === 'ne'
      ? `${field.name} (${nepaliCrop}): योजना चरण। बीउ रोप्नु अघि माटो परीक्षण र कम्पोस्ट मल तयार गर्नुहोस्।`
      : `${field.name} (${cropName}): Planning Stage. Test soil NPK and prepare compost before sowing.`;
  }

  const dayStr = stageInfo.daysPassed > 0 ? ` - Day ${stageInfo.daysPassed}` : '';
  const tip = stageInfo.recommendations[0] || 'Maintain proper irrigation and weeding.';

  if (language === 'ne') {
    return `${field.name} • ${nepaliCrop} (${stageName}${dayStr}${seasonNoteNe}) — स्वास्थ्य: ${healthScore}%। 💡 ${tip}`;
  } else {
    return `${field.name} • ${cropName} (${stageName}${dayStr}${seasonNoteEn}) — Health: ${healthScore}%. 💡 ${tip}`;
  }
};

const getStageAwareWaterAdvice = (cropName: string, stageName: string, moisture: number, language: string): { statusLabel: string; adviceText: string; color: string } => {
  const c = (cropName || 'Rice').toLowerCase();
  const s = (stageName || 'Vegetative').toLowerCase();

  const isRice = c.includes('rice') || c.includes('paddy') || c.includes('धान');

  if (isRice) {
    if (s.includes('vegetative') || s.includes('reproductive') || s.includes('flowering')) {
      if (moisture < 45) {
        return {
          statusLabel: language === 'ne' ? 'सिंचाई आवश्यक (धान)' : 'Low for Paddy (Requires Water)',
          adviceText: language === 'ne' 
            ? `धानको ${stageName} चरणका लागि ५०% भन्दा माथि (३-५ से.मी. पानी) आवश्यक छ। तत्काल सिंचाइ गर्नुहोस्।`
            : `Paddy in ${stageName} stage requires 3-5 cm standing water (50%+ moisture). Please irrigate.`,
          color: '#cf6a28'
        };
      }
      return {
        statusLabel: language === 'ne' ? 'उत्कृष्ट जलस्तर' : 'Flooded (Ideal for Paddy)',
        adviceText: language === 'ne'
          ? `उत्कृष्ट अवस्था: धानको ${stageName} चरणका लागि आवश्यक जलस्तर स्थिर छ। कुनै कदम आवश्यक छैन।`
          : `Ideal condition: Standing water is correctly maintained for Paddy during ${stageName}. No action needed.`,
        color: '#3b855e'
      };
    }
    if (s.includes('maturity')) {
      return {
        statusLabel: language === 'ne' ? 'सुकाउने अवस्था' : 'Draining Stage (Pre-Harvest)',
        adviceText: language === 'ne'
          ? `उत्कृष्ट अवस्था: कटानी अघि माटो सुकाउन २५-३५% ओसिलोपन उपयुक्त हुन्छ। सिंचाइ नगर्नुहोस्।`
          : `Optimal condition: 25-35% moisture is ideal for field drainage prior to harvesting. No action needed.`,
        color: '#3b855e'
      };
    }
  }

  // Wheat, Maize, Potato, Mustard (Non-flooded crops)
  if (moisture < 18) {
    return {
      statusLabel: language === 'ne' ? 'न्यून ओसिलोपन' : 'Low Soil Moisture',
      adviceText: language === 'ne'
        ? `${cropName} को लागि माटो सुक्खा छ। जरासम्म पानी पुग्ने गरी हल्का सिंचाइ गर्नुहोस्।`
        : `Soil is dry for ${cropName}. Apply light irrigation to prevent moisture stress.`,
      color: '#cf6a28'
    };
  }

  if (moisture >= 18 && moisture <= 48) {
    return {
      statusLabel: language === 'ne' ? 'उत्कृष्ट ओसिलोपन' : 'Optimal Moisture',
      adviceText: language === 'ne'
        ? `उत्कृष्ट अवस्था: ${moisture}% ओसिलोपन ${cropName} को ${stageName} चरणको जरा प्रणालीका लागि पूर्ण रूपमा उपयुक्त छ। कुनै कदम आवश्यक छैन।`
        : `Optimal condition: ${moisture}% soil moisture is in the ideal root absorption zone for ${cropName} during ${stageName}. No action needed.`,
      color: '#3b855e'
    };
  }

  return {
    statusLabel: language === 'ne' ? 'अत्यधिक ओसिलोपन' : 'High Moisture / Saturated',
    adviceText: language === 'ne'
      ? `${cropName} को लागि माटोमा बढी पानी छ। जरा कुहिने रोगबाट बचाउन निकास मिलाउनुहोस्।`
      : `High moisture detected for ${cropName}. Ensure proper drainage to avoid root rot.`,
    color: '#2d7bb6'
  };
};

const getPersonalizedAgronomicAnalysis = (field: Field, healthScore: number, language: string): string => {
  const crop = field.crop_type || 'Rice';
  const stageInfo = calculateGrowthStage(crop, field.planting_date, field.status, language);
  const stageName = stageInfo.stageName;
  const soil = field.soil_type || 'Loam';
  const isPlanned = field.status === 'planned';

  const cropLower = crop.toLowerCase();
  let cropName = 'Rice';
  let nepaliCrop = 'धान';
  if (cropLower.includes('maize') || cropLower.includes('corn') || cropLower.includes('मकै')) { cropName = 'Maize'; nepaliCrop = 'मकै'; }
  else if (cropLower.includes('wheat') || cropLower.includes('गहुँ')) { cropName = 'Wheat'; nepaliCrop = 'गहुँ'; }
  else if (cropLower.includes('potato') || cropLower.includes('आलु')) { cropName = 'Potato'; nepaliCrop = 'आलु'; }
  else if (cropLower.includes('mustard') || cropLower.includes('तोरी')) { cropName = 'Mustard'; nepaliCrop = 'तोरी'; }

  if (isPlanned) {
    return language === 'ne'
      ? `${field.name} (${nepaliCrop}) को लागि ${soil} माटो संरचना उपयुक्त छ। बीउ छर्नु अघि जैविक मल मिलाएर स्वास्थ्य सूचक ${healthScore}% सम्म पुर्याउन सकिन्छ।`
      : `${field.name} (${cropName}) planning stage: Soil texture (${soil}) shows high baseline compatibility (${healthScore}% viability) for upcoming sowing.`;
  }

  const dayStr = stageInfo.daysPassed > 0 ? ` (Day ${stageInfo.daysPassed})` : '';

  if (language === 'ne') {
    return `${field.name} मा लगाइएको ${nepaliCrop} हाल ${stageName}${dayStr} मा छ। ${soil} माटो र मौसम स्थिति अनुसार ${healthScore}% स्वास्थ्य सूचक प्राप्त भएको छ। मुख्य प्राथमिकता: ${stageInfo.recommendations[0]}`;
  } else {
    return `${field.name}'s ${cropName} crop is currently active in the ${stageName}${dayStr}. ${soil} soil composition and environmental data yield a ${healthScore}% overall health index. Key priority: ${stageInfo.recommendations[0]}`;
  }
};

interface GrowthStageInfo {
  stageName: string;
  daysPassed: number;
  recommendations: string[];
  stages: { name: string; range: string; isActive: boolean; isCompleted: boolean }[];
}

const calculateGrowthStage = (cropType: string, plantingDateStr: string | null, status: string | null, lang: string = 'en'): GrowthStageInfo => {
  const isNe = lang === 'ne';

  const translateStageName = (name: string): string => {
    if (!isNe) return name;
    switch (name) {
      case 'Planning / Pre-Sowing': return 'योजना तथा पूर्व-तैयारी';
      case 'Planning': return 'पूर्व-तैयारी';
      case 'Sowing': return 'बीउ रोप्ने';
      case 'Seedling': return 'ब्याड तयारी';
      case 'Vegetative': return 'वनस्पतिक वृद्धि';
      case 'Reproductive': return 'बाला निर्माण';
      case 'Flowering': return 'फूल फूल्ने';
      case 'Maturity': return 'पाक्ने चरण';
      case 'Tasseling': return 'घोंगा आउने';
      case 'Grain Fill': return 'दाना भर्ने';
      case 'Germination': return 'अङ्कुरण';
      case 'Tillering': return 'गछ्यान हाल्ने';
      case 'Heading': return 'बाला आउने';
      case 'Sprouting': return 'अङ्कुरण';
      case 'Tuber Init': return 'दाना बन्ने';
      case 'Bulking': return 'दाना वृद्धि';
      case 'Rosette': return 'पात वृद्धि';
      case 'Pod Dev': return 'कोसा लाग्ने';
      case 'Ripening': return 'पाक्ने';
      default: return name;
    }
  };

  const defaultStages = [
    { name: translateStageName('Sowing'), range: 'D.1-15', isActive: false, isCompleted: false },
    { name: translateStageName('Vegetative'), range: 'D.16-50', isActive: false, isCompleted: false },
    { name: translateStageName('Flowering'), range: 'D.51-85', isActive: false, isCompleted: false },
    { name: translateStageName('Maturity'), range: 'D.86-120', isActive: false, isCompleted: false },
  ];

  if (!plantingDateStr || status === 'planned') {
    return {
      stageName: isNe ? 'योजना तथा पूर्व-तैयारी' : 'Planning / Pre-Sowing',
      daysPassed: 0,
      recommendations: isNe ? [
        'माटोको NPK र pH मात्रा परीक्षण गर्नुहोस्।',
        'खेतको माटो जोतेर प्राङ्गारिक कम्पोष्ट मल हाल्नुहोस्।',
        'उच्च उत्पादन दिने NARC प्रमाणित बीउ छनोट गर्नुहोस्।',
      ] : [
        'Perform soil test to check NPK levels and pH.',
        'Prepare the field seedbed and apply organic compost.',
        'Select certified seeds of high-yielding crop variety.',
      ],
      stages: [
        { name: translateStageName('Planning'), range: 'सुरुवात', isActive: true, isCompleted: false },
        ...defaultStages.map(s => ({ ...s, isActive: false, isCompleted: false }))
      ],
    };
  }

  // Calculate days passed from planting_date to actual current date
  const plantingDate = parseLocalDate(plantingDateStr);
  const currentDate = new Date(); // Real current date
  const diffTime = currentDate.getTime() - plantingDate.getTime();
  const daysPassed = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  const crop = (cropType || 'Rice').toLowerCase();

  let stagesDef = [
    { name: 'Sowing', start: 0, end: 15 },
    { name: 'Vegetative', start: 16, end: 50 },
    { name: 'Flowering', start: 51, end: 85 },
    { name: 'Maturity', start: 86, end: 120 },
  ];
  let recommendationsMap: string[][] = isNe ? [
    ['बीउ उम्रन माटोमा पर्याप्त ओसिलोपन सुनिश्चित गर्नुहोस्।', 'अङ्कुरण जाँच गर्नुहोस्।'],
    ['मुख्य नाइट्रोजन मलको टप-ड्रेस प्रयोग गर्नुहोस्।', 'झारपात गोडमेल गर्नुहोस्।'],
    ['फूल फूल्ने समयमा सिंचाइ नियमित गर्नुहोस्।', 'कीराको प्रकोप जाँच गर्नुहोस्।'],
    ['बाली सुक्न सिंचाइ बन्द गर्नुहोस्।', 'कटानीको तयारी गर्नुहोस्।']
  ] : [
    ['Ensure soil has adequate moisture for seed germination.', 'Check seedling emergence.'],
    ['Apply primary fertilizer top-dress.', 'Weed the rows to reduce competition.'],
    ['Perform moisture checks during flowering.', 'Inspect for pest damage.'],
    ['Stop watering to allow crop drying.', 'Prepare for harvest.']
  ];

  if (crop.includes('rice') || crop.includes('paddy') || crop.includes('धान')) {
    stagesDef = [
      { name: 'Seedling', start: 0, end: 20 },
      { name: 'Vegetative', start: 21, end: 50 },
      { name: 'Reproductive', start: 51, end: 80 },
      { name: 'Flowering', start: 81, end: 100 },
      { name: 'Maturity', start: 101, end: 130 },
    ];
    recommendationsMap = isNe ? [
      ['ब्याडमा १-२ सेमि पानी जमाइराख्नुहोस्।', 'जरा कुहिने रोग रोक्न बीउ उपचार गर्नुहोस्।', 'रोपाइँ अघि खेत सम्म बनाउनुहोस्।'],
      ['खेतमा ३-५ सेमि पानी जमाइराख्नुहोस्।', 'युरिया मलको पहिलो किस्ता प्रयोग गर्नुहोस्।', 'धानको डढुवा रोग जाँच गर्नुहोस्।'],
      ['बाला आउने बेला ५ सेमि सिंचाइ कायम राख्नुहोस्।', 'पोटाश र यूरिया मलको दोस्रो किस्ता दिनुहोस्।', 'गबो कीरा नियन्त्रणका लागि निम तेल छर्कनुहोस्।'],
      ['फूल फूल्ने समयमा खेत सुख्खा हुन नदिनुहोस्।', 'गँधिया कीराको प्रकोप निरीक्षण गर्नुहोस्।', 'फूल फुलेको बेला रासायनिक विषादी नछर्कनुहोस्।'],
      ['काट्नु १०-१४ दिन अघि खेतको पानी सुकाउनुहोस्।', '८०-८५% बाला पहेँलो भएपछि धान काट्नुहोस्।', 'सुकाएर १२-१४% ओसिलोपनमा भण्डारण गर्नुहोस्।']
    ] : [
      ['Maintain 1-2 cm water in nursery bed.', 'Apply seed treatment for root rot.', 'Level land before transplanting.'],
      ['Keep standing water at 3-5 cm.', 'Apply Nitrogen urea top-dress.', 'Inspect for Rice Blast & Blight.'],
      ['Flooded at 5 cm depth. Avoid drying during panicle initiation.', 'Apply Nitrogen/Potassium top-dress.', 'Spray organic neem oil for stem borers.'],
      ['Maintain standing water depth.', 'Inspect crop heads for stink bugs.', 'Avoid chemical sprays during peak flowering.'],
      ['Drain water 10-14 days before harvest.', 'Harvest when 80-85% grains turn golden.', 'Thresh and dry to 14% moisture.']
    ];
  } else if (crop.includes('maize') || crop.includes('corn') || crop.includes('मकै')) {
    stagesDef = [
      { name: 'Sowing', start: 0, end: 15 },
      { name: 'Vegetative', start: 16, end: 45 },
      { name: 'Tasseling', start: 46, end: 70 },
      { name: 'Grain Fill', start: 71, end: 95 },
      { name: 'Maturity', start: 96, end: 115 },
    ];
    recommendationsMap = isNe ? [
      ['हाइब्रिड मकैको बीउ ५ सेमि गहिराइमा रोप्नुहोस्।', 'माटो ओसिलो राख्नुहोस्।'],
      ['घँडासम्म आउँदा युरिया र DAP मल दिनुहोस्।', 'फौजी कीरा नियन्त्रण गर्नुहोस्।', 'माटो उकास्नुहोस्।'],
      ['घोंगा र जुँगा आउने मुख्य सिंचाइ चरण! ओसिलोपन जोगाउनुहोस्।', 'कीराको प्रकोप रोक्नुहोस्।'],
      ['दानाको तौल बढाउन माटोमा ओसिलोपन कायम राख्नुहोस्।', 'बोट सुक्ने रोग जाँच गर्नुहोस्।'],
      ['दानाको जरामा कालो दाग देखिएपछि मकै घोगा भाँच्नुहोस्।', '१३% ओसिलोपनसम्म सुकाउनुहोस्।']
    ] : [
      ['Plant hybrid seeds at 5cm depth.', 'Ensure moist seedbed.', 'Watch for bird damage.'],
      ['Apply DAP/Urea top-dress at knee-high stage.', 'Control Fall Armyworm larvae.', 'Perform earthing up.'],
      ['Critical irrigation stage! Maintain soil moisture.', 'Inspect silks for corn earworms.', 'Avoid water stress.'],
      ['Ensure adequate soil moisture for grain weight.', 'Monitor stalk rot indicators.'],
      ['Harvest when black layer forms at kernel base.', 'Dry cobs to 13% moisture before shelling.']
    ];
  } else if (crop.includes('wheat') || crop.includes('गहुँ')) {
    stagesDef = [
      { name: 'Germination', start: 0, end: 20 },
      { name: 'Tillering', start: 21, end: 45 },
      { name: 'Heading', start: 46, end: 75 },
      { name: 'Grain Fill', start: 76, end: 105 },
      { name: 'Maturity', start: 106, end: 120 },
    ];
    recommendationsMap = isNe ? [
      ['२१ दिनमा पहिलो सिँचाइ (CRI stage) दिनुहोस्।', 'बीउ समान रूपमा उम्रेको जाँच गर्नुहोस्।'],
      ['नाइट्रोजन मलको दोस्रो किस्ता प्रयोग गर्नुहोस्।', 'चौडा पात झारपात गोड्नुहोस्।'],
      ['बाला आउने बेला दोस्रो सिँचाइ गर्नुहोस्।', 'पहेँलो सिन्दुरे रोगको प्रकोप जाँच गर्नुहोस्।'],
      ['दाना भर्ने बेला माटो ओसिलो राख्नुहोस्।', 'लाही कीराको टोकाइ नियन्त्रण गर्नुहोस्।'],
      ['बोट सुकेपछि काट्नुहोस्।', 'सुकाएर १२% भन्दा कम ओसिलोपनमा भण्डार गर्नुहोस्।']
    ] : [
      ['First irrigation at Crown Root Initiation (21 days).', 'Ensure uniform seedling emergence.'],
      ['Apply second dose of Nitrogen fertilizer.', 'Perform weed control (Phalaris minor).'],
      ['Irrigate at boot/heading stage.', 'Inspect leaves for Yellow/Brown Rust spots.'],
      ['Maintain soil moisture to prevent terminal heat stress.', 'Monitor for aphids.'],
      ['Harvest when straw is dry and brittle.', 'Thresh and store under 12% moisture.']
    ];
  } else if (crop.includes('potato') || crop.includes('आलु')) {
    stagesDef = [
      { name: 'Sprouting', start: 0, end: 20 },
      { name: 'Vegetative', start: 21, end: 45 },
      { name: 'Tuber Init', start: 46, end: 70 },
      { name: 'Bulking', start: 71, end: 100 },
      { name: 'Maturity', start: 101, end: 115 },
    ];
    recommendationsMap = isNe ? [
      ['टुसा उम्रिएको निरोगी आलु बीउ रोप्नुहोस्।', 'माटो ओसिलो राख्नुहोस्।'],
      ['पहिलो पटक माटो उकास्नुहोस् र मल दिनुहोस्।', 'डढुवा रोग रोकथामको विषादी छर्कनुहोस्।'],
      ['आलु दाना बन्ने बेला नियमित हल्का सिंचाइ गर्नुहोस्।', 'माटो फुट्न नदिनुहोस्।'],
      ['आलु दाना वृद्धि हुने मुख्य समय! नियमित हल्का सिंचाइ गर्नुहोस्।', 'लाही कीरा नियन्त्रण गर्नुहोस्।'],
      ['खन्ने १०-१४ दिन अघि आलुको बोट काट्नुहोस्।', 'छहारीमा आलु ओथाएर भण्डार गर्नुहोस्।']
    ] : [
      ['Plant well-chitted seed tubers.', 'Maintain moist soil.', 'Avoid deep planting.'],
      ['First earthing up and NPK top-dress.', 'Apply preventive spray for Late Blight.'],
      ['Keep uniform moisture for tuber set.', 'Do not allow soil to crack.'],
      ['Main tuber expansion phase! Light, frequent irrigation.', 'Monitor for aphids and late blight.'],
      ['Cut haulms (vines) 10-14 days before harvest.', 'Cure harvested potatoes in shade.']
    ];
  } else if (crop.includes('mustard') || crop.includes('तोरी')) {
    stagesDef = [
      { name: 'Germination', start: 0, end: 12 },
      { name: 'Rosette', start: 13, end: 35 },
      { name: 'Flowering', start: 36, end: 60 },
      { name: 'Pod Dev', start: 61, end: 85 },
      { name: 'Ripening', start: 86, end: 105 },
    ];
    recommendationsMap = isNe ? [
      ['३० सेमि दूरीमा हार मिलाएर तोरी छर्नुहोस्।', 'घाटा बिरुवा उखेलेर पातलो बनाउनुहोस्।'],
      ['युरिया मलको टप-ड्रेस प्रयोग गर्नुहोस्।', 'तोरीको लाही कीरा नियन्त्रण गर्नुहोस्।'],
      ['फूल फूल्ने बेला एकपटक सिँचाइ गर्नुहोस्।', 'लाही कीराको प्रकोप बढेमा निम तेल छर्कनुहोस्।'],
      ['खेत झारपात मुक्त राख्नुहोस्।', 'जैविक कीटनाशक छर्कनुहोस्।'],
      ['७५% कोसा पहेँलो भएपछि तोरी काट्नुहोस्।', 'घाममा सुकाएर चुट्नुहोस्।']
    ] : [
      ['Maintain line sowing at 30cm spacing.', 'Thin out dense seedlings.'],
      ['Apply Nitrogen top-dress.', 'Control mustard sawfly & flea beetles.'],
      ['Single irrigation at flowering stage.', 'Monitor closely for mustard aphid infestation.'],
      ['Keep field weed-free.', 'Spray bio-pesticides if aphid count > 20/plant.'],
      ['Harvest when 75% pods turn golden-yellow.', 'Dry pods on canvas before threshing.']
    ];
  }

  let activeIdx = 0;
  stagesDef.forEach((st, idx) => {
    if (daysPassed >= st.start && daysPassed <= st.end) {
      activeIdx = idx;
    }
  });
  const maxEnd = stagesDef[stagesDef.length - 1].end;
  if (daysPassed > maxEnd) activeIdx = stagesDef.length - 1;

  const stagesList = stagesDef.map((st, idx) => ({
    name: translateStageName(st.name),
    range: `D.${st.start}-${st.end}`,
    isActive: idx === activeIdx,
    isCompleted: daysPassed > st.end,
  }));

  const activeStageTranslated = translateStageName(stagesDef[activeIdx].name);

  return {
    stageName: isNe ? `${activeStageTranslated} चरण` : `${stagesDef[activeIdx].name} Stage`,
    daysPassed,
    recommendations: recommendationsMap[activeIdx] || recommendationsMap[0],
    stages: stagesList,
  };
};



import { Easing } from 'react-native';

type FieldStatus = 'Healthy' | 'Needs Attention' | 'Very Healthy';

const COLORS = {
  paper: '#f4f2ec',
  ink: '#1c231b',
  inkSoft: '#5b6357',
  inkFaint: '#8b9184',
  line: '#e2ded2',
  forest900: '#16281c',
  forest800: '#1d3323',
  forest700: '#274430',
  forest600: '#33562f',
  forest500: '#4a7346',
  clay: '#c9622a',
  clayBg: '#fbe9dd',
  amber: '#c98a2c',
  amberBg: '#fbeed9',
  goodBg: '#e3ecdc',
  white: '#ffffff',
};

const STATUS_STYLES: Record<FieldStatus, { bg: string; dot: string; text: string }> = {
  Healthy: { bg: COLORS.goodBg, dot: COLORS.forest500, text: COLORS.forest700 },
  'Needs Attention': { bg: COLORS.amberBg, dot: COLORS.amber, text: '#8a5a17' },
  'Very Healthy': { bg: COLORS.goodBg, dot: COLORS.forest700, text: COLORS.forest800 },
};

const getSoilTypeTranslation = (soilType: string | null | undefined, lang: string = 'en') => {
  if (!soilType) return lang === 'ne' ? 'दोमट माटो' : 'Loam';
  if (lang !== 'ne') return soilType;
  const s = soilType.toLowerCase();
  if (s.includes('clay loam')) return 'चिम्साइलो दोमट';
  if (s.includes('sandy loam')) return 'बलौटे दोमट';
  if (s.includes('silty loam') || s.includes('silt loam')) return 'पाँगो दोमट';
  if (s.includes('clay')) return 'चिम्साइलो माटो';
  if (s.includes('sandy')) return 'बलौटे माटो';
  if (s.includes('silt')) return 'पाँगो माटो';
  if (s.includes('loam')) return 'दोमट माटो';
  return soilType;
};

const getFieldNameTranslation = (name: string | null | undefined, lang: string = 'en') => {
  if (!name) return lang === 'ne' ? 'मेरो खेत' : 'My Farm';
  if (lang !== 'ne') return name;
  let translated = name;
  translated = translated.replace(/Main Rice Field/gi, 'मुख्य धान खेत');
  translated = translated.replace(/Rice Field/gi, 'धान खेत');
  translated = translated.replace(/Paddy Field/gi, 'धान खेत');
  translated = translated.replace(/Rice Farm/gi, 'धान फार्म');
  translated = translated.replace(/Maize Field/gi, 'मकै खेत');
  translated = translated.replace(/Maize Farm/gi, 'मकै फार्म');
  translated = translated.replace(/Corn Field/gi, 'मकै खेत');
  translated = translated.replace(/Wheat Field/gi, 'गहुँ खेत');
  translated = translated.replace(/Potato Field/gi, 'आलु खेत');
  translated = translated.replace(/Mustard Field/gi, 'तोरी खेत');
  translated = translated.replace(/Farm/gi, 'फार्म');
  translated = translated.replace(/Plot/gi, 'कित्ता');
  translated = translated.replace(/Field/gi, 'खेत');
  return translated;
};

const getCropTypeTranslation = (cropType: string | null | undefined, lang: string = 'en') => {
  if (!cropType) return lang === 'ne' ? 'धान' : 'Rice';
  if (lang !== 'ne') return cropType;
  const c = cropType.toLowerCase();
  if (c.includes('rice') || c.includes('paddy') || c.includes('धान')) return 'धान';
  if (c.includes('maize') || c.includes('corn') || c.includes('मकै')) return 'मकै';
  if (c.includes('potato') || c.includes('आलु')) return 'आलु';
  if (c.includes('wheat') || c.includes('गहुँ')) return 'गहुँ';
  if (c.includes('mustard') || c.includes('तोरी')) return 'तोरी';
  if (c.includes('lentil') || c.includes('मसुरो')) return 'मसुरो';
  if (c.includes('mung') || c.includes('मुङ')) return 'मुङ';
  return cropType;
};

const RING_SIZE = 46;
const RING_STROKE = 4;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);

const SoilRing: React.FC<{ score: number; color: string }> = ({ score, color }) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: score,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [score]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 100],
    outputRange: [RING_CIRC, 0],
  });

  return (
    <Svg width={RING_SIZE} height={RING_SIZE}>
      <SvgCircle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        stroke={COLORS.line}
        strokeWidth={RING_STROKE}
        fill="none"
      />
      <AnimatedCircle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        stroke={color}
        strokeWidth={RING_STROKE}
        fill="none"
        strokeDasharray={RING_CIRC}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        rotation="-90"
        origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
      />
    </Svg>
  );
};

const TinderCardDeck: React.FC<{
  fields: Field[];
  onSelect: (field: Field) => void;
  onDelete: (field: Field) => void;
  language: string;
  localT: any;
  setScrollEnabled: (enabled: boolean) => void;
}> = ({ fields, onSelect, onDelete, language, localT, setScrollEnabled }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const panX = useRef(new Animated.Value(0)).current;

  // Make sure currentIndex stays valid if fields array changes
  useEffect(() => {
    if (currentIndex >= fields.length) {
      setCurrentIndex(0);
    }
  }, [fields.length]);

  const goToNext = () => {
    if (fields.length <= 1) return;
    Animated.timing(panX, {
      toValue: -500,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex((prev) => (prev + 1) % fields.length);
      panX.setValue(0);
    });
  };

  const goToPrev = () => {
    if (fields.length <= 1) return;
    Animated.timing(panX, {
      toValue: 500,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex((prev) => (prev - 1 + fields.length) % fields.length);
      panX.setValue(0);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 3;
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 3;
      },
      onPanResponderGrant: () => {
        setScrollEnabled(false);
      },
      onPanResponderMove: (evt, gestureState) => {
        panX.setValue(gestureState.dx);
      },
      onPanResponderTerminationRequest: () => false, // Prevent parent ScrollView from stealing gesture mid-swipe
      onPanResponderRelease: (e, gestureState) => {
        setScrollEnabled(true);
        const isSwipeRight = gestureState.dx > 40 || (gestureState.dx > 20 && gestureState.vx > 0.3);
        const isSwipeLeft = gestureState.dx < -40 || (gestureState.dx < -20 && gestureState.vx < -0.3);
        if (isSwipeRight) {
          // Swipe Right -> Previous Farm
          goToPrev();
        } else if (isSwipeLeft) {
          // Swipe Left -> Next Farm
          goToNext();
        } else {
          Animated.spring(panX, {
            toValue: 0,
            friction: 5,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        setScrollEnabled(true);
        Animated.spring(panX, {
          toValue: 0,
          friction: 5,
          useNativeDriver: true,
        }).start();
      }
    })
  ).current;

  if (!fields || fields.length === 0) return null;

  const currentField = fields[currentIndex] || fields[0];
  const nextIndex = (currentIndex + 1) % fields.length;
  const nextField = fields[nextIndex];

  const rotate = panX.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: ['-8deg', '0deg', '8deg'],
    extrapolate: 'clamp',
  });

  const animatedCardStyle = {
    transform: [
      { translateX: panX },
      { rotate: rotate },
    ],
  };

  const nextCardScale = panX.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: [1, 0.95, 1],
    extrapolate: 'clamp',
  });

  const nextCardOpacity = panX.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: [0.95, 0.8, 0.95],
    extrapolate: 'clamp',
  });

  const renderCardContent = (field: Field, isActive: boolean) => {
    const score = calculateDynamicHealthScore(field);
    let healthColor = COLORS.forest700;
    if (score < 70) {
      healthColor = COLORS.clay;
    } else if (score < 85) {
      healthColor = COLORS.amber;
    }

    return (
      <View style={styles.tinderCardInner}>
        {/* Top Section: Header */}
        <View style={styles.tinderCardHeader}>
          <View style={[styles.tinderCropIconContainer, { backgroundColor: healthColor + '15' }]}>
            <Text style={styles.tinderCropEmoji}>
              {field.crop_type?.toLowerCase().includes('rice') || field.crop_type?.toLowerCase().includes('धान') ? '🌾' : '🌱'}
            </Text>
          </View>
          <View style={styles.tinderCardTitleCol}>
            <Text style={styles.tinderCardName}>{getFieldNameTranslation(field.name, language)}</Text>
            <View style={styles.tinderLocationRow}>
              <Ionicons name="location-outline" size={13} color={COLORS.inkSoft} />
              <Text style={styles.tinderLocationText}>{field.location_name}</Text>
            </View>
          </View>
          {isActive && (
            <TouchableOpacity 
              style={styles.tinderDeleteBtn} 
              activeOpacity={0.7}
              onPress={() => onDelete(field)}
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.clay} />
            </TouchableOpacity>
          )}
        </View>

        {/* Middle Section: Big Health Indicator */}
        <View style={styles.tinderHealthSection}>
          <View style={styles.tinderHealthRow}>
            {/* Left part: Score number */}
            <View style={styles.tinderScoreCol}>
              <Text style={[styles.tinderScoreNumber, { color: healthColor }]}>
                {score}%
              </Text>
              <Text style={styles.tinderScoreLabel}>
                {localT[language]?.healthIndex || 'Health Index'}
              </Text>
            </View>

            {/* Right part: Ring graphic */}
            <View style={styles.tinderRingWrapper}>
              <SoilRing score={score} color={healthColor} />
            </View>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.tinderDivider} />

        {/* Bottom Section: Details Grid */}
        <View style={styles.tinderDetailsGrid}>
          <View style={styles.tinderDetailItem}>
            <Ionicons name="expand-outline" size={16} color={COLORS.forest600} />
            <View style={styles.tinderDetailTextCol}>
              <Text style={styles.tinderDetailVal}>{field.area} {field.area_unit}</Text>
              <Text style={styles.tinderDetailLabel}>{language === 'ne' ? 'क्षेत्रफल' : 'Field Size'}</Text>
            </View>
          </View>

          <View style={styles.tinderDetailItem}>
            <Ionicons name="analytics-outline" size={16} color={COLORS.forest600} />
            <View style={styles.tinderDetailTextCol}>
              <Text style={styles.tinderDetailVal}>{getSoilTypeTranslation(field.soil_type, language)}</Text>
              <Text style={styles.tinderDetailLabel}>{language === 'ne' ? 'माटोको प्रकार' : 'Soil Type'}</Text>
            </View>
          </View>
        </View>



        {/* Action Button */}
        <TouchableOpacity 
          style={[styles.tinderDetailsBtn, { backgroundColor: healthColor }]} 
          activeOpacity={0.8}
          onPress={() => onSelect(field)}
        >
          <Text style={styles.tinderDetailsBtnText}>
            {language === 'ne' ? 'विवरण हेर्नुहोस्' : 'View Full Analysis'}
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#FFF" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View>
      <View style={styles.tinderDeckWrapper}>
        {/* Background card (Next Card) */}
        {fields.length > 1 && (
          <Animated.View
            style={[
              styles.tinderCard,
              styles.tinderCardBack,
              {
                opacity: nextCardOpacity,
                transform: [{ scale: nextCardScale }],
              },
            ]}
          >
            {renderCardContent(nextField, false)}
          </Animated.View>
        )}

        {/* Foreground card (Current Card) */}
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.tinderCard, animatedCardStyle, { zIndex: 10 }]}
        >
          {renderCardContent(currentField, true)}
        </Animated.View>
      </View>

      {/* Swipe Controls & Pagination Indicator */}
      {fields.length > 1 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 12 }}>
          <TouchableOpacity 
            onPress={goToPrev}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.06)', justifyContent: 'center', alignItems: 'center' }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={COLORS.forest700} />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {fields.map((_, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => setCurrentIndex(idx)}
                style={{
                  width: idx === currentIndex ? 20 : 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: idx === currentIndex ? COLORS.forest600 : 'rgba(0,0,0,0.15)',
                }}
              />
            ))}
          </View>

          <TouchableOpacity 
            onPress={goToNext}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.06)', justifyContent: 'center', alignItems: 'center' }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={20} color={COLORS.forest700} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const CheckoutDialogOverlay: React.FC<{
  visible: boolean;
  onClose: () => void;
  selectedProduct: any;
  selectedField: Field | null;
  orderProcessing: boolean;
  confirmOrder: () => void;
  colors: any;
  isDarkMode: boolean;
  language: string;
}> = ({
  visible,
  onClose,
  selectedProduct,
  selectedField,
  orderProcessing,
  confirmOrder,
  colors,
  isDarkMode,
  language,
}) => {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(animValue, {
        toValue: 1,
        tension: 65,
        friction: 9,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!visible) return null;

  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [350, 0],
  });

  return (
    <Animated.View style={{
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
      zIndex: 999999,
      opacity: backdropOpacity,
    }}>
      <Animated.View style={{ 
        backgroundColor: colors.card, 
        borderTopLeftRadius: 28, 
        borderTopRightRadius: 28, 
        padding: 24, 
        minHeight: 300,
        transform: [{ translateY }],
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
            {language === 'ne' ? 'अर्डर निश्चित गर्नुहोस्' : 'Confirm Order'}
          </Text>
          <TouchableOpacity onPress={() => !orderProcessing && onClose()} style={{ padding: 4 }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {selectedProduct && (
          <View style={{ backgroundColor: isDarkMode ? '#1a241b' : '#f8fdf9', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: isDarkMode ? '#2e4231' : '#e2f0e6', marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: isDarkMode ? '#2a3b2d' : '#eaf6ef', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 26 }}>{selectedProduct.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{selectedProduct.title}</Text>
                <Text style={{ fontSize: 12, color: colors.secondaryText, marginTop: 2 }}>{selectedProduct.category}</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: isDarkMode ? '#a5d6a7' : '#2e7d32', marginTop: 6 }}>{selectedProduct.price}</Text>
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 14 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, color: colors.secondaryText }}>{language === 'ne' ? 'सिफारिस गरिएको खेत' : 'Target Field'}</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{selectedField?.name || 'Farm'}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity 
          onPress={confirmOrder}
          disabled={orderProcessing}
          style={{ 
            backgroundColor: colors.brandGreen, 
            borderRadius: 14, 
            paddingVertical: 16, 
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            opacity: orderProcessing ? 0.7 : 1
          }}
        >
          {orderProcessing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>
                {language === 'ne' ? 'अर्डर पुष्टि गर्नुहोस्' : 'Place Order Instant'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

const getSuggestedInputs = (
  cropType: string | undefined, 
  plantingDateStr: string | null | undefined, 
  status: string | null | undefined,
  lang: string = 'en'
) => {
  const stageInfo = calculateGrowthStage(cropType || 'Rice', plantingDateStr || null, status || null);
  const stageName = stageInfo.stageName;
  const lowerStage = stageName.toLowerCase();
  const crop = (cropType || 'Rice').toLowerCase();
  const isNe = lang === 'ne';

  // Localized stage name calculation
  let displayStageName = stageName;
  if (isNe) {
    if (lowerStage.includes('planning') || lowerStage.includes('pre-sowing')) displayStageName = 'योजना / रोप्नु अघि';
    else if (lowerStage.includes('sowing') || lowerStage.includes('seedling') || lowerStage.includes('germination')) displayStageName = 'बीउ रोप्ने चरण';
    else if (lowerStage.includes('vegetative') || lowerStage.includes('tillering')) displayStageName = 'वानस्पतिक वृद्धि चरण';
    else if (lowerStage.includes('tasseling') || lowerStage.includes('flowering') || lowerStage.includes('heading') || lowerStage.includes('reproductive')) displayStageName = 'फूल फुल्ने चरण';
    else if (lowerStage.includes('grain fill') || lowerStage.includes('bulking') || lowerStage.includes('pod dev')) displayStageName = 'दाना भर्ने चरण';
    else if (lowerStage.includes('maturity') || lowerStage.includes('ripening') || lowerStage.includes('harvest')) displayStageName = 'अन्न परिपक्वता चरण';
  }

  // Determine stage category
  const isPlanningOrSowing = lowerStage.includes('planning') || lowerStage.includes('sowing') || lowerStage.includes('seedling') || lowerStage.includes('germination') || lowerStage.includes('sprouting');
  const isVegetative = lowerStage.includes('vegetative') || lowerStage.includes('tillering') || lowerStage.includes('rosette');
  const isFlowering = lowerStage.includes('flowering') || lowerStage.includes('reproductive') || lowerStage.includes('tasseling') || lowerStage.includes('heading') || lowerStage.includes('tuber init');

  let inputs: Array<{ id: string; title: string; category: string; dosage: string; price: string; emoji: string }> = [];

  const getCatLabel = (cat: string) => {
    if (!isNe) return cat;
    switch (cat) {
      case 'Seeds': return 'बीउ';
      case 'Fertilizer': return 'मल';
      case 'Micronutrient': return 'सूक्ष्म पोषक';
      case 'Bio-Input': return 'जैविक मल';
      case 'Pest Control': return 'कीटनाशक';
      case 'Spray': return 'स्प्रे';
      case 'Herbicide': return 'घाँसनाशक';
      case 'Fungicide': return 'फङ्गीसाइड';
      case 'Insecticide': return 'कीटनाशक';
      case 'Storage': return 'भण्डारण';
      case 'Tools': return 'औजार';
      case 'Equipment': return 'उपकरण';
      case 'Compost': return 'कम्पोष्ट';
      case 'Tubers': return 'आलुको बीउ';
      default: return cat;
    }
  };

  if (crop.includes('maize') || crop.includes('corn') || crop.includes('मकै')) {
    if (isPlanningOrSowing) {
      inputs = [
        { id: 'm-s1', title: isNe ? 'हाइब्रिड मकैको बीउ (रामपुर हाइब्रिड-१०)' : 'Hybrid Maize Seeds (Rampur Hybrid-10)', category: getCatLabel('Seeds'), dosage: isNe ? '१.५ केजी / कट्ठा' : '1.5 kg / Kattha', price: isNe ? 'रू ६५० / २केजी पोका' : 'रू 650 / 2kg pkt', emoji: '🌱' },
        { id: 'm-s2', title: isNe ? 'डीएपी (१८:४६:०) आधारभूत मल' : 'DAP (18:46:0) Basal Granules', category: getCatLabel('Fertilizer'), dosage: isNe ? 'प्रयोग ४ केजी / कट्ठा' : 'Apply 4 kg / Kattha', price: isNe ? 'रू १,२५० / ५०केजी बोरा' : 'रू 1,250 / 50kg bag', emoji: '🌾' },
        { id: 'm-s3', title: isNe ? 'ट्राइकोडर्मा जैविक बीउ उपचार' : 'Trichoderma Bio-Fungicide Seed Dress', category: getCatLabel('Bio-Input'), dosage: isNe ? '१०० ग्राम / ५केजी बीउ' : '100g / 5kg seeds', price: isNe ? 'रू १८० / २५०ग्राम पोका' : 'रू 180 / 250g pkt', emoji: '🧪' },
      ];
    } else if (isVegetative) {
      inputs = [
        { id: 'm-v1', title: isNe ? 'निम कोटेड युरिया (घँडासहित टप ड्रेस)' : 'Neem-Coated Urea (Knee-High Top Dress)', category: getCatLabel('Fertilizer'), dosage: isNe ? 'प्रयोग ३ केजी / कट्ठा' : 'Apply 3 kg / Kattha', price: isNe ? 'रू ८५० / ५०केजी बोरा' : 'रू 850 / 50kg bag', emoji: '🌽' },
        { id: 'm-v2', title: isNe ? 'जिंक सल्फेट २१% माइक्रो-बुस्टर' : 'Zinc Sulphate 21% Micro-Booster', category: getCatLabel('Micronutrient'), dosage: isNe ? 'प्रयोग ५०० ग्राम / कट्ठा' : 'Apply 500g / Kattha', price: isNe ? 'रू २८० / १केजी पोका' : 'रू 280 / 1kg pkt', emoji: '🧪' },
        { id: 'm-v3', title: isNe ? 'फौजी कीरा नियन्त्रण (इमामेक्टिन)' : 'Fall Armyworm Bio-Pesticide (Emamectin)', category: getCatLabel('Pest Control'), dosage: isNe ? 'छर्कनुहोस् १५ एमएल / कट्ठा' : 'Spray 15ml / Kattha', price: isNe ? 'रू ४२० / १००एमएल बोतल' : 'रू 420 / 100ml btl', emoji: '🛡️' },
      ];
    } else if (isFlowering) {
      inputs = [
        { id: 'm-f1', title: isNe ? 'बोरोन २०% घुलनशील (घोंगा छर्कने)' : 'Boron 20% Soluble (Tasseling Spray)', category: getCatLabel('Micronutrient'), dosage: isNe ? 'छर्कनुहोस् १५० ग्राम / कट्ठा' : 'Spray 150g / Kattha', price: isNe ? 'रू २२० / २५०ग्राम पोका' : 'रू 220 / 250g pkt', emoji: '🌸' },
        { id: 'm-f2', title: isNe ? 'म्युरिएट अफ पोटास (एमओपी ०:०:६०)' : 'Muriate of Potash (MOP 0:0:60)', category: getCatLabel('Fertilizer'), dosage: isNe ? 'प्रयोग २ केजी / कट्ठा' : 'Apply 2 kg / Kattha', price: isNe ? 'रू ९८० / ५०केजी बोरा' : 'रू 980 / 50kg bag', emoji: '🧪' },
        { id: 'm-f3', title: isNe ? 'फोलियर एनपीके १९:१९:१९ टनिक' : 'Foliar NPK 19:19:19 Growth Tonic', category: getCatLabel('Spray'), dosage: isNe ? 'छर्कनुहोस् २०० ग्राम / कट्ठा' : 'Spray 200g / Kattha', price: isNe ? 'रू ३५० / १केजी पोका' : 'रू 350 / 1kg pkt', emoji: '💧' },
      ];
    } else {
      inputs = [
        { id: 'm-m1', title: isNe ? 'हावा नछिर्ने अन्न भण्डारण बोरा' : 'Hermetic Grain Storage Bags (SuperGrainbag)', category: getCatLabel('Storage'), dosage: isNe ? '२ बोरा / कट्ठा फसल' : '2 Bags / Kattha harvest', price: isNe ? 'रू ३२० / ५ बोरा' : 'रू 320 / 5 bags', emoji: '📦' },
        { id: 'm-m2', title: isNe ? 'एसओपी ०:०:५० दाना बढाउने पोटास' : 'SOP 0:0:50 Cob Kernel Density Booster', category: getCatLabel('Fertilizer'), dosage: isNe ? 'प्रयोग १.५ केजी / कट्ठा' : 'Apply 1.5 kg / Kattha', price: isNe ? 'रू १,१०० / २५केजी बोरा' : 'रू 1,100 / 25kg bag', emoji: '🌽' },
        { id: 'm-m3', title: isNe ? 'स्टेनलेस स्टील मकै छोडाउने औजार' : 'Stainless Steel Maize Sheller Tool', category: getCatLabel('Tools'), dosage: isNe ? '१ सेट औजार' : '1 Tool set', price: isNe ? 'रू ७५० / सेट' : 'रू 750 / set', emoji: '🛠️' },
      ];
    }
  } else if (crop.includes('rice') || crop.includes('paddy') || crop.includes('धान')) {
    if (isPlanningOrSowing) {
      inputs = [
        { id: 'r-s1', title: isNe ? 'हर्दिनाथ-३ उन्नत धानको बीउ' : 'Hardinath-3 Certified Paddy Seeds', category: getCatLabel('Seeds'), dosage: isNe ? '१.२ केजी / कट्ठा' : '1.2 kg / Kattha', price: isNe ? 'रू ५८० / ३केजी पोका' : 'रू 580 / 3kg pkt', emoji: '🌾' },
        { id: 'r-s2', title: isNe ? 'डीएपी १८:४६:० ब्याड तयार गर्ने मल' : 'DAP 18:46:0 Nursery Basal Pack', category: getCatLabel('Fertilizer'), dosage: isNe ? 'प्रयोग ३ केजी / कट्ठा' : 'Apply 3 kg / Kattha', price: isNe ? 'रू १,२५० / ५०केजी बोरा' : 'रू 1,250 / 50kg bag', emoji: '🌱' },
        { id: 'r-s3', title: isNe ? 'जिंक सल्फेट २१% माटोको दाना' : 'Zinc Sulphate 21% Soil Granules', category: getCatLabel('Micronutrient'), dosage: isNe ? 'प्रयोग १ केजी / कट्ठा' : 'Apply 1 kg / Kattha', price: isNe ? 'रू २५० / ५केजी बोरा' : 'रू 250 / 5kg bag', emoji: '🧪' },
      ];
    } else if (isVegetative) {
      inputs = [
        { id: 'r-v1', title: isNe ? 'निम कोटेड युरिया (पहिलो टप-ड्रेस)' : 'Neem-Coated Urea (First Top-Dress)', category: getCatLabel('Fertilizer'), dosage: isNe ? 'प्रयोग ४ केजी / कट्ठा' : 'Apply 4 kg / Kattha', price: isNe ? 'रू ८५० / ५०केजी बोरा' : 'रू 850 / 50kg bag', emoji: '🌾' },
        { id: 'r-v2', title: isNe ? 'धानको झारनाशक (प्रेटिलाक्लोर)' : 'Selective Paddy Weedicide (Pretilachlor)', category: getCatLabel('Herbicide'), dosage: isNe ? 'छर्कनुहोस् १०० एमएल / कट्ठा' : 'Spray 100ml / Kattha', price: isNe ? 'रू ३२० / २५०एमएल बोतल' : 'रू 320 / 250ml btl', emoji: '🌿' },
        { id: 'r-v3', title: isNe ? 'धानको काण्ड खुकुरी कीरा नियन्त्रण' : 'Rice Stem Borer Organic Defense', category: getCatLabel('Pest Control'), dosage: isNe ? 'छर्कनुहोस् २०० एमएल / कट्ठा' : 'Spray 200ml / Kattha', price: isNe ? 'रू ४८० / ५००एमएल बोतल' : 'रू 480 / 500ml btl', emoji: '🛡️' },
      ];
    } else if (isFlowering) {
      inputs = [
        { id: 'r-f1', title: isNe ? 'म्युरिएट अफ पोटास (एमओपी ६०% K2O)' : 'Muriate of Potash (MOP 60% K2O)', category: getCatLabel('Fertilizer'), dosage: isNe ? 'प्रयोग २.५ केजी / कट्ठा' : 'Apply 2.5 kg / Kattha', price: isNe ? 'रू ९८० / ५०केजी बोरा' : 'रू 980 / 50kg bag', emoji: '🧪' },
        { id: 'r-f2', title: isNe ? 'बोरोन २०% बाला बढाउने बुस्टर' : 'Boron 20% Panicle Growth Booster', category: getCatLabel('Micronutrient'), dosage: isNe ? 'छर्कनुहोस् १०० ग्राम / कट्ठा' : 'Spray 100g / Kattha', price: isNe ? 'रू २२० / २५०ग्राम पोका' : 'रू 220 / 250g pkt', emoji: '🌸' },
        { id: 'r-f3', title: isNe ? 'धानको मरुवा रोग औषधि' : 'Rice Blast Fungicide (Tricyclazole)', category: getCatLabel('Fungicide'), dosage: isNe ? 'छर्कनुहोस् १२० ग्राम / कट्ठा' : 'Spray 120g / Kattha', price: isNe ? 'रू ४५० / २५०ग्राम पोका' : 'रू 450 / 250g pkt', emoji: '🛡️' },
      ];
    } else {
      inputs = [
        { id: 'r-m1', title: isNe ? 'अन्न भण्डारण बोरा (PICS २-तह)' : 'Hermetic Grain Storage Bags (PICS 2-Layer)', category: getCatLabel('Storage'), dosage: isNe ? '३ बोरा / कट्ठा फसल' : '3 Bags / Kattha harvest', price: isNe ? 'रू ३५० / ३ बोरा' : 'रू 350 / 3 bags', emoji: '📦' },
        { id: 'r-m2', title: isNe ? 'फोलियर एनपीके ०:०:५० दाना तौल बुस्टर' : 'Foliar NPK 0:0:50 Grain Weight Enhancer', category: getCatLabel('Spray'), dosage: isNe ? 'छर्कनुहोस् २५० ग्राम / कट्ठा' : 'Spray 250g / Kattha', price: isNe ? 'रू ३९० / १केजी पोका' : 'रू 390 / 1kg pkt', emoji: '🌾' },
        { id: 'r-m3', title: isNe ? 'दाँते धान काट्ने हँसिया' : 'Serrated Paddy Harvesting Sickle', category: getCatLabel('Tools'), dosage: isNe ? '१ हँसिया' : '1 Sickle', price: isNe ? 'रू २८० / थान' : 'रू 280 / pc', emoji: '🔪' },
      ];
    }
  } else if (crop.includes('wheat') || crop.includes('गहुँ')) {
    if (isPlanningOrSowing) {
      inputs = [
        { id: 'w-s1', title: isNe ? 'विजय / गौतम उन्नत गहुँको बीउ' : 'Vijay / Gautam High-Yield Wheat Seeds', category: getCatLabel('Seeds'), dosage: isNe ? '३.५ केजी / कट्ठा' : '3.5 kg / Kattha', price: isNe ? 'रू ४५० / ५केजी पोका' : 'रू 450 / 5kg pkt', emoji: '🌾' },
        { id: 'w-s2', title: isNe ? 'डीएपी १८:४६:० छर्ने बेलाको मल' : 'DAP 18:46:0 Basal Sowing Dose', category: getCatLabel('Fertilizer'), dosage: isNe ? 'प्रयोग ४ केजी / कट्ठा' : 'Apply 4 kg / Kattha', price: isNe ? 'रू १,२५० / ५०केजी बोरा' : 'रू 1,250 / 50kg bag', emoji: '🌱' },
        { id: 'w-s3', title: isNe ? 'भिटाभ्याक्स बीउ उपचार फङ्गीसाइड' : 'Vitavax Seed Treatment Fungicide', category: getCatLabel('Bio-Input'), dosage: isNe ? '१०० ग्राम / १०केजी बीउ' : '100g / 10kg seed', price: isNe ? 'रू २०० / २५०ग्राम पोका' : 'रू 200 / 250g pkt', emoji: '🧪' },
      ];
    } else if (isVegetative) {
      inputs = [
        { id: 'w-v1', title: isNe ? 'युरिया ४६% (सिँचाइपछि टप-ड्रेस)' : 'Urea 46% N (Crown Root Top-Dress)', category: getCatLabel('Fertilizer'), dosage: isNe ? 'प्रयोग ३.५ केजी / कट्ठा' : 'Apply 3.5 kg / Kattha', price: isNe ? 'रू ८५० / ५०केजी बोरा' : 'रू 850 / 50kg bag', emoji: '🌾' },
        { id: 'w-v2', title: isNe ? 'जिंक चिलेट्स EDTA १२% स्प्रे' : 'Zinc Chelates EDTA 12% Spray', category: getCatLabel('Micronutrient'), dosage: isNe ? 'छर्कनुहोस् १५० ग्राम / कट्ठा' : 'Spray 150g / Kattha', price: isNe ? 'रू ३१० / २५०ग्राम पोका' : 'रू 310 / 250g pkt', emoji: '🧪' },
        { id: 'w-v3', title: isNe ? 'चौडा पात झारनाशक (२,४-डी सोडियम)' : 'Broadleaf Weedicide (2,4-D Sodium Salt)', category: getCatLabel('Herbicide'), dosage: isNe ? 'छर्कनुहोस् ८० ग्राम / कट्ठा' : 'Spray 80g / Kattha', price: isNe ? 'रू २६० / २५०ग्राम पोका' : 'रू 260 / 250g pkt', emoji: '🌿' },
      ];
    } else if (isFlowering) {
      inputs = [
        { id: 'w-f1', title: isNe ? 'एमओपी (म्युरिएट अफ पोटास)' : 'MOP (Muriate of Potash) Top-Dress', category: getCatLabel('Fertilizer'), dosage: isNe ? 'प्रयोग २ केजी / कट्ठा' : 'Apply 2 kg / Kattha', price: isNe ? 'रू ९८० / ५०केजी बोरा' : 'रू 980 / 50kg bag', emoji: '🧪' },
        { id: 'w-f2', title: isNe ? 'फोलियर एनपीके १९:१९:१९ टनिक' : 'Foliar NPK 19:19:19 Tonic', category: getCatLabel('Spray'), dosage: isNe ? 'छर्कनुहोस् २५० ग्राम / कट्ठा' : 'Spray 250g / Kattha', price: isNe ? 'रू ३८० / १केजी पोका' : 'रू 380 / 1kg pkt', emoji: '💧' },
        { id: 'w-f3', title: isNe ? 'गहुँको पहेँलो सिन्दुरे रोग नियन्त्रण' : 'Wheat Yellow Rust Fungicide Guard', category: getCatLabel('Fungicide'), dosage: isNe ? 'छर्कनुहोस् १०० एमएल / कट्ठा' : 'Spray 100ml / Kattha', price: isNe ? 'रू ४९० / २५०एमएल बोतल' : 'रू 490 / 250ml btl', emoji: '🛡️' },
      ];
    } else {
      inputs = [
        { id: 'w-m1', title: isNe ? 'ओस नछिर्ने गहुँ भण्डारण बोरा' : 'Hermetic Moisture-Lock Storage Bags', category: getCatLabel('Storage'), dosage: isNe ? '३ बोरा / कट्ठा फसल' : '3 Bags / Kattha harvest', price: isNe ? 'रू ३४० / ३ बोरा' : 'रू 340 / 3 bags', emoji: '📦' },
        { id: 'w-m2', title: isNe ? 'पोटासियम नाइट्रेट (१३:०:४५) स्प्रे' : 'Potassium Nitrate (13:0:45) Spray', category: getCatLabel('Fertilizer'), dosage: isNe ? 'छर्कनुहोस् २०० ग्राम / कट्ठा' : 'Spray 200g / Kattha', price: isNe ? 'रू ४२० / १केजी पोका' : 'रू 420 / 1kg pkt', emoji: '🌾' },
        { id: 'w-m3', title: isNe ? 'अन्न सुकाउने त्रिपाल (१२x१८ फिट)' : 'Grain Drying Tarpaulin Sheet (12x18 ft)', category: getCatLabel('Equipment'), dosage: isNe ? '१ थान त्रिपाल' : '1 Sheet', price: isNe ? 'रू १,१५० / थान' : 'रू 1,150 / sheet', emoji: '🛖' },
      ];
    }
  } else if (crop.includes('potato') || crop.includes('आलु')) {
    if (isPlanningOrSowing) {
      inputs = [
        { id: 'mu-s1', title: isNe ? 'उन्नत पहेँलो तोरीको बीउ (प्रगति)' : 'Certified Yellow Mustard Seeds (Pragati)', category: getCatLabel('Seeds'), dosage: isNe ? '३०० ग्राम / कट्ठा' : '300g / Kattha', price: isNe ? 'रू ३२० / ५००ग्राम पोका' : 'रू 320 / 500g pkt', emoji: '🌼' },
        { id: 'mu-s2', title: isNe ? 'सल्फर ८०% WDG माटोको दाना' : 'Sulphur 80% WDG Soil Granules', category: getCatLabel('Fertilizer'), dosage: isNe ? 'प्रयोग १.५ केजी / कट्ठा' : 'Apply 1.5 kg / Kattha', price: isNe ? 'रू ३८० / ३केजी पोका' : 'रू 380 / 3kg pkt', emoji: '🧪' },
        { id: 'mu-s3', title: isNe ? 'डीएपी आधारभूत छर्ने मल' : 'DAP Basal Sowing Formula', category: getCatLabel('Fertilizer'), dosage: isNe ? 'प्रयोग ३ केजी / कट्ठा' : 'Apply 3 kg / Kattha', price: isNe ? 'रू १,२५० / ५०केजी बोरा' : 'रू 1,250 / 50kg bag', emoji: '🌾' },
      ];
    } else if (isVegetative) {
      inputs = [
        { id: 'mu-v1', title: isNe ? 'युरिया टप-ड्रेस वृद्धि टनिक' : 'Urea Top-Dress & Growth Tonic', category: getCatLabel('Fertilizer'), dosage: isNe ? 'प्रयोग २ केजी / कट्ठा' : 'Apply 2 kg / Kattha', price: isNe ? 'रू ८५० / ५०केजी बोरा' : 'रू 850 / 50kg bag', emoji: '🌼' },
        { id: 'mu-v2', title: isNe ? 'मौरी-सुरक्षित तोरीको लाही कीरा नियन्त्रण' : 'Bio-Bee Safe Mustard Aphid Spray', category: getCatLabel('Insecticide'), dosage: isNe ? 'छर्कनुहोस् १५० एमएल / कट्ठा' : 'Spray 150ml / Kattha', price: isNe ? 'रू ४८० / २५०एमएल बोतल' : 'रू 480 / 250ml btl', emoji: '🐝' },
      ];
    } else {
      inputs = [
        { id: 'mu-f1', title: isNe ? 'बोरोन २०% तेल मात्रा बढाउने' : 'Boron 20% Pod Filling & Oil Booster', category: getCatLabel('Micronutrient'), dosage: isNe ? 'छर्कनुहोस् १०० ग्राम / कट्ठा' : 'Spray 100g / Kattha', price: isNe ? 'रू २२० / २५०ग्राम पोका' : 'रू 220 / 250g pkt', emoji: '🧪' },
        { id: 'mu-f2', title: isNe ? 'सल्फर तरल फोलियर स्प्रे' : 'Sulphur Liquid Foliar Spray', category: getCatLabel('Spray'), dosage: isNe ? 'छर्कनुहोस् २०० एमएल / कट्ठा' : 'Spray 200ml / Kattha', price: isNe ? 'रू ३४० / ५००एमएल बोतल' : 'रू 340 / 500ml btl', emoji: '💧' },
      ];
    }
  } else {
    // Default fallback
    if (isPlanningOrSowing) {
      inputs = [
        { id: 'df-s1', title: isNe ? 'जैविक गड्यौला मल' : 'Organic Vermicompost Soil Revitalizer', category: getCatLabel('Compost'), dosage: isNe ? 'प्रयोग २० केजी / कट्ठा' : 'Apply 20 kg / Kattha', price: isNe ? 'रू ६०० / ५०केजी बोरा' : 'रू 600 / 50kg bag', emoji: '🍂' },
        { id: 'df-s2', title: isNe ? 'सन्तुलित एनपीके (१९:१९:१९) मल' : 'Balanced NPK (19:19:19) Basal Dose', category: getCatLabel('Fertilizer'), dosage: isNe ? 'प्रयोग ३ केजी / कट्ठा' : 'Apply 3 kg / Kattha', price: isNe ? 'रू १,००० / ५०केजी बोरा' : 'रू 1,000 / 50kg bag', emoji: '🧪' },
      ];
    } else if (isVegetative) {
      inputs = [
        { id: 'df-v1', title: isNe ? 'निम कोटेड युरिया टप-ड्रेस' : 'Neem-Coated Urea Vegetative Top-Dress', category: getCatLabel('Fertilizer'), dosage: isNe ? 'प्रयोग ३ केजी / कट्ठा' : 'Apply 3 kg / Kattha', price: isNe ? 'रू ८५० / ५०केजी बोरा' : 'रू 850 / 50kg bag', emoji: '🌿' },
        { id: 'df-v2', title: isNe ? 'बहु-माइक्रोन्युट्रिएन्ट फोलियर स्प्रे' : 'Multi-Micronutrient Foliar Spray', category: getCatLabel('Spray'), dosage: isNe ? 'छर्कनुहोस् १५० ग्राम / कट्ठा' : 'Spray 150g / Kattha', price: isNe ? 'रू ३२० / ५००ग्राम पोका' : 'रू 320 / 500g pkt', emoji: '🧪' },
      ];
    } else {
      inputs = [
        { id: 'df-f1', title: isNe ? 'उच्च-पोटासियम एनपीके (१३:०:४५) स्प्रे' : 'High-Potassium NPK (13:0:45) Spray', category: getCatLabel('Fertilizer'), dosage: isNe ? 'छर्कनुहोस् २०० ग्राम / कट्ठा' : 'Spray 200g / Kattha', price: isNe ? 'रू ४१० / १केजी पोका' : 'रू 410 / 1kg pkt', emoji: '🌸' },
        { id: 'df-f2', title: isNe ? 'जैविक निम तेल कीटनाशक' : 'Organic Neem Oil Pest Defense', category: getCatLabel('Pest Control'), dosage: isNe ? 'छर्कनुहोस् २५० एमएल / कट्ठा' : 'Spray 250ml / Kattha', price: isNe ? 'रू ३९० / ५००एमएल बोतल' : 'रू 390 / 500ml btl', emoji: '🛡️' },
      ];
    }
  }

  return { inputs, stageName: displayStageName };
};

interface MasterclassTopic {
  id: string;
  icon: string;
  image: any;
  category: string;
  categoryNe: string;
  title: string;
  titleNe: string;
  badge: string;
  badgeNe: string;
  summary: string;
  summaryNe: string;
  problemInsight: string;
  problemInsightNe: string;
  farmerVerdict: string;
  farmerVerdictNe: string;
  steps: string[];
  stepsNe: string[];
}

const ADVANCED_MASTERCLASSES: MasterclassTopic[] = [
  {
    id: 'high-yield',
    icon: 'trending-up-outline',
    image: MASTERCLASS_HIGH_YIELD_IMG,
    category: 'Yield Growth',
    categoryNe: 'उत्पादन प्रविधि',
    title: 'High-Yield NARC Guide',
    titleNe: 'उच्च उत्पादन विधि',
    badge: '+35% Yield',
    badgeNe: '+३५% उत्पादन',
    summary: 'Master NARC-recommended plant spacing, split fertigation timing, and foliar micronutrient application.',
    summaryNe: 'NARC द्वारा सिफारिश गरिएको बिरुवाको दूरी, नाइट्रोजन मलको किस्ताबन्दी प्रयोग र सुक्ष्म तत्व स्प्रे प्रविधि।',
    problemInsight: 'Traditional broadcasting of fertilizers causes 45% nitrogen loss due to leaching & volatilization. Split top-dressing ensures nutrient absorption during key tiller initiation.',
    problemInsightNe: 'परम्परागत रूपमा मल छर्दा ४५% नाइट्रोजन नष्ट हुन्छ। किस्ताबन्दीमा यूरिया मल प्रयोग गर्दा गछ्यान हाल्ने मुख्य समयमा बिरुवाले पूरा पोषण पाउँछ।',
    farmerVerdict: 'Local farmers in Chitwan report a 35% increase in paddy weight per Kattha using 30-day split top-dressing.',
    farmerVerdictNe: 'चितवनका कृषकहरूका अनुसार रोपेको ३० दिनमा दोस्रो किस्ता यूरिया र जिङ्क प्रयोग गर्दा कट्ठाप्रति ३५% बढी धान उत्पादन भएको छ।',
    steps: [
      'Maintain 20cm x 15cm hill spacing for optimal canopy aeration.',
      'Apply 50% DAP & MOP at basal transplanting.',
      'First top-dress: Apply 25% Urea + Zinc Sulphate at 20-25 Days After Planting.',
      'Second top-dress: Apply remaining 25% Urea at Panicle Initiation stage (50-55 DAP).'
    ],
    stepsNe: [
      'हावा र घाम राम्रोसँग छिर्न बिरुवाको दूरी २० सेमी x १५ सेमी कायम गर्नुहोस्।',
      'रोप्ने बेला (Basal dose) ५०% DAP र पूरा पोटाश (MOP) माटोमा मिसाउनुहोस्।',
      'पहिलो किस्ता: रोपेको २०-२५ दिनमा २५% यूरिया र जिङ्क सल्फेट प्रयोग गर्नुहोस्।',
      'दोस्रो किस्ता: बाला आउने सुरुवाती समयमा (५०-५५ दिन) बाँकी २५% यूरिया प्रयोग गर्नुहोस्।'
    ]
  },
  {
    id: 'crop-selection',
    icon: 'options-outline',
    image: MASTERCLASS_CROP_ROTATION_IMG,
    category: 'Crop Rotation',
    categoryNe: 'बाली चक्र',
    title: 'Crop & Soil Rotation',
    titleNe: 'बाली तथा माटो चक्र',
    badge: 'Soil Health',
    badgeNe: 'उर्वराशक्ति',
    summary: 'Selecting climate-resilient NARC seeds matched with soil pH and rotating with nitrogen-fixing pulses.',
    summaryNe: 'माटोको pH र संरचना अनुसारका उन्नत बीउ छनोट र दलहन बालीको घुम्ती खेती।',
    problemInsight: 'Monoculture rice-rice depletes subsoil organic carbon. Rotating with lentils or mungbean fixes up to 40kg natural Nitrogen per hectare.',
    problemInsightNe: 'लगातार एउटै बाली लगाउँदा माटोको प्राङ्गारिक पदार्थ घट्छ। धानपछि मसुरो वा मुङ रोप्दा हेक्टरमा ४० केजी प्राकृतिक नाइट्रोजन थपिन्छ।',
    farmerVerdict: 'Rotating Hardinath-1 paddy with winter Lentils restores soil softness and reduces synthetic N needs by 25%.',
    farmerVerdictNe: 'हार्दिनाथ-१ धानपछि हिउँदे मसुरो बाली लगाउँदा माटो खुकुलो भई अर्को वर्ष २५% कम यूरिया मल आवश्यक पर्छ।',
    steps: [
      'For Clay Loam soils, select Hardinath-1 or Chaite-5 Rice varieties.',
      'For Sandy Loam soils, select drought-resistant Rampur Hybrid-10 Maize.',
      'Plant Mungbean/Lentil immediately after Monsoon harvest to lock soil moisture.',
      'Incorporate pulse crop residue into soil as green manure before next season.'
    ],
    stepsNe: [
      'चिम्साइलो (Clay Loam) माटोका लागि हार्दिनाथ-१ वा चैते-५ धान उपयुक्त हुन्छ।',
      'बलौटे दोमट माटोका लागि खडेरी सहने रामपुर हाइब्रिड-१० मकै छनोट गर्नुहोस्।',
      'धान काटेलगत्तै माटोको ओसिलोपन बचाउन मुङ वा मसुरो छर्नुहोस्।',
      'दलहन बालीको जरा र पात माटोमै जोतेर हरीयो मलको रूपमा प्रयोग गर्नुहोस्।'
    ]
  },
  {
    id: 'crop-storage',
    icon: 'cube-outline',
    image: MASTERCLASS_GRAIN_STORAGE_IMG,
    category: 'Grain Storage',
    categoryNe: 'अन्न भण्डारण',
    title: 'Zero-Loss Storage',
    titleNe: 'सुरक्षित भण्डारण',
    badge: 'Zero Loss',
    badgeNe: 'शून्य नोक्सानी',
    summary: 'Prevent Weevil infestation and grain molding using moisture threshold testing and PICS technology.',
    summaryNe: 'धान र मकैमा घुन-पुतली लाग्न नदिन PICS बोरा र जैविक नीम प्रविधि।',
    problemInsight: 'High moisture (>14%) causes aflatoxin mold and rice weevil explosions, destroying 20% stored grain within 3 months.',
    problemInsightNe: 'धानमा १४% भन्दा बढी ओसिलोपन भएमा ढुसी र घुन लागेर ३ महिनामै २०% भण्डारित अन्न नष्ट हुन्छ।',
    farmerVerdict: 'Farmers using 3-layer PICS bags with dry Neem leaf powder stored paddy for 12 months with 0% grain loss.',
    farmerVerdictNe: '३ तह भएको PICS बोरामा सुकेको नीमको धूलो मिसाएर राख्दा १२ महिनासम्म धान १% पनि नोक्सान नभई सुरक्षित रहन्छ।',
    steps: [
      'Sun-dry harvested grain until moisture content drops below 12% (salt jar test).',
      'Clean storage area and apply dry Neem/Bakaino leaf powder inside storage bins.',
      'Store grain in 3-ply Hermetic (PICS) storage bags and tie inner lining airtight.',
      'Elevate storage bags 10cm off concrete floor using wooden pallets.'
    ],
    stepsNe: [
      'अन्नलाई घाममा राम्रोसँग सुकाएर ओसिलोपन १२% भन्दा कम बनाउनुहोस्।',
      'भण्डारण गर्ने कोठा सफा गरी जैविक नीम वा बकाइनोको सुकेको धूलो छर्नुहोस्।',
      'अन्नलाई ३-तह भएको PICS बोरामा भरेर भित्रि प्लाष्टिकको मुख हावा नछिर्ने गरी बाँध्नुहोस्।',
      'बोरालाई सिमेन्टको भुइँमा सोझै नराखी काठको फल्याक (Pallet) माथि राख्नुहोस्।'
    ]
  },
  {
    id: 'smart-irrigation',
    icon: 'water-outline',
    image: MASTERCLASS_SMART_IRRIGATION_IMG,
    category: 'Smart Irrigation',
    categoryNe: 'उन्नत सिंचाइ',
    title: 'Smart AWD Irrigation',
    titleNe: 'उन्नत सिंचाइ (AWD)',
    badge: '30% Water',
    badgeNe: '३०% पानी बचत',
    summary: 'Save 30% diesel/irrigation water while boosting root oxygenation and soil microbe health.',
    summaryNe: '३०% इन्धन/पानी बचत गर्दै धानको जरामा अक्सिजन बढाउने वैज्ञानिक प्रविधि।',
    problemInsight: 'Continuous standing water suffocates paddy roots and breeds anaerobic root rot. AWD lets soil breathe without crop stress.',
    problemInsightNe: 'खेतमा लगातार पानी जमाइराख्दा जराले अक्सिजन नपाई कुहिने समस्या हुन्छ। AWD विधिले माटोलाई सास फेर्न दिन्छ।',
    farmerVerdict: 'AWD perforated pipe monitoring saved farmers Rs. 4,500/bigha in pumping costs with healthier root systems.',
    farmerVerdictNe: 'माटोमा दुलो पारेको PVC पाइप राखी सिंचाइ गर्दा पम्पिङ खर्चमा बिघाको रु ४,५०० बचत हुनुका साथै रोगाणु घट्छ।',
    steps: [
      'Install a 30cm perforated plastic pipe 15cm deep into the paddy field.',
      'Flood field to 5cm depth during transplanting and weeding stages.',
      'Allow water level in pipe to drop 15cm below soil surface before re-irrigating.',
      'Keep field flooded during Flowering and Panicle Initiation (critical water stage).'
    ],
    stepsNe: [
      'खेतमा ३० सेमी लामो, छेडेको प्लाष्टिक पाइप १५ सेमी माटोमुनि गाडी गाड्नुहोस्।',
      'रोप्ने र गोड्ने समयमा ५ सेमीसम्म पानी जमाउनुहोस्।',
      'त्यसपछि पाइपभित्र पानी १५ सेमी मुनि नपुगेसम्म पुनः सिंचाइ नगर्नुहोस्।',
      'बाला आउने र फूल फूल्ने समयमा भने खेतमा १ इन्च पानी अनिवार्य जमाउनुहोस्।'
    ]
  }
];

const FarmsScreen = () => {
  const insets = useSafeAreaInsets();
  const safeTopMargin = insets.top > 0 ? insets.top : (Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44);
  const { colors, isDarkMode } = useTheme();
  const { language } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();

  // Local translations dictionary for home screen updates
  const localT = {
    en: {
      logoName: 'Anavi',
      goodMorning: 'Good morning',
      goodAfternoon: 'Good afternoon',
      goodEvening: 'Good evening',
      goodNight: 'Good night',
      farmerFallback: 'Farmer',
      greetingSubtitle: "Let's keep your fields thriving today.",
      rain: 'Rain',
      clouds: 'Clouds',
      wind: 'Wind',
      clearSky: 'Clear Sky',
      partlyCloudy: 'Partly Cloudy',
      foggy: 'Foggy',
      drizzle: 'Drizzle',
      rainy: 'Rainy',
      snowy: 'Snowy',
      rainShowers: 'Rain Showers',
      thunderstorm: 'Thunderstorm',
      newFarm: 'New Farm',
      cropHistory: 'Crop History',
      soilReports: 'Soil Reports',
      leafScan: 'Leaf Scan',
      farmJourney: 'Farm Journey',
      healthIndex: 'Health Index',
      moisture: 'Soil Moisture',
      optimal: 'Optimal',
      good: 'Good',
      attentionRequired: 'Needs Attention',
      noAlerts: 'No Alerts',
      myFarms: 'My Farms',
      aiAdvisory: 'AI Advisory',
      advisoryTitle: 'Today\'s Smart Tip',
      advisoryBody: 'Your rice fields are in the vegetative growth stage. Consider applying nitrogen fertilizer within the next 3 days for optimal yield.',
      advisoryAction: 'View All Tips',
      deleteModalTitle: 'Delete Farm',
      deleteModalBody: 'Are you sure you want to permanently delete this farm from your dashboard? This action cannot be undone.',
      deleteConfirm: 'Delete',
      deleteCancel: 'Cancel',
      emptyTitle: 'Start Mapping Your Farm 🌱',
      emptySubtitle: 'Draw your field boundaries to unlock real-time satellite imagery, live soil moisture metrics, and smart AI crop recommendations.',
      emptyAddBtn: 'Add Your First Farm',
    },
    ne: {
      logoName: 'अनाभी',
      goodMorning: 'शुभ प्रभात',
      goodAfternoon: 'शुभ दिउँसो',
      goodEvening: 'शुभ साँझ',
      goodNight: 'शुभ रात्री',
      farmerFallback: 'किसान',
      greetingSubtitle: 'आज तपाईंको खेतबारीलाई सप्रिएको राखौं।',
      rain: 'वर्षा',
      clouds: 'बादल',
      wind: 'हावा',
      clearSky: 'सफा आकाश',
      partlyCloudy: 'आंशिक रूपमा बादल',
      foggy: 'कुहिरो',
      drizzle: 'सिमसिम पानी',
      rainy: 'पानी परिरहेको',
      snowy: 'हिउँ परिरहेको',
      rainShowers: 'क्षणिक वर्षा',
      thunderstorm: 'चट्याङसहित वर्षा',
      newFarm: 'नयाँ खेत',
      cropHistory: 'बाली इतिहास',
      soilReports: 'माटो रिपोर्ट',
      leafScan: 'पात स्क्यान',
      farmJourney: 'कृषि यात्रा',
      healthIndex: 'स्वास्थ्य सूचक',
      moisture: 'माटोको चिस्यान',
      optimal: 'उत्कृष्ट',
      good: 'राम्रो',
      attentionRequired: 'ध्यान दिनुहोस',
      noAlerts: 'कुनै चेतावनी छैन',
      myFarms: 'मेरो खेतहरू',
      aiAdvisory: 'AI सल्लाह',
      advisoryTitle: 'आजको स्मार्ट सुझाव',
      advisoryBody: 'तपाईंको धानको खेत वनस्पतिक वृद्धि चरणमा छ। उत्तम उत्पादनको लागि आगामी ॣ दिनभित्र नाइट्रोजन मल दिनुहोस्।',
      advisoryAction: 'सबै सुझावहरू हेर्नुहोस्',
      deleteModalTitle: 'खेत हटाउनुहोस्',
      deleteModalBody: 'के तपाईँ यो खेत आफ्नो ड्यासबोर्डबाट स्थायी रूपमा हटाउन चाहनुहुन्छ? यो कार्य फिर्ता गर्न सकिँदैन।',
      deleteConfirm: 'हटाउनुहोस्',
      deleteCancel: 'रद्द गर्नुहोस्',
      emptyTitle: 'आफ्नो खेतको नक्सांकन सुरु गर्नुहोस् 🌱',
      emptySubtitle: 'लाइभ स्याटेलाइट तस्बिर, माटोको अवस्था र अवनि AI को स्मार्ट सुझावहरू प्राप्त गर्न आफ्नो खेतको सीमांकन गर्नुहोस्।',
      emptyAddBtn: 'नयाँ खेत थप्नुहोस्',
    }
  };

  const [typedText, setTypedText] = useState('');
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Blinking cursor loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        })
      ])
    ).start();

    // Repeating Typewriter loop (Typing -> Pause -> Deleting -> Pause -> Repeat)
    let index = 0;
    let isDeleting = false;
    let timer: NodeJS.Timeout;
    const targetText = localT[language]?.logoName || 'Anavi';

    const tick = () => {
      if (!isDeleting) {
        setTypedText(targetText.slice(0, index + 1));
        index++;
        if (index === targetText.length) {
          isDeleting = true;
          timer = setTimeout(tick, 3000); // Hold full word for 3 seconds
          return;
        }
        timer = setTimeout(tick, 150); // Type next letter in 150ms
      } else {
        setTypedText(targetText.slice(0, index - 1));
        index--;
        if (index === 0) {
          isDeleting = false;
          timer = setTimeout(tick, 500); // Pause for 0.5s before typing again
          return;
        }
        timer = setTimeout(tick, 75); // Erase letter in 75ms (faster than typing)
      }
    };

    timer = setTimeout(tick, 150);
    return () => clearTimeout(timer);
  }, [language]);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Mascot & Greeting animations on scroll
  const mascotOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const mascotTranslateY = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, -25],
    extrapolate: 'clamp',
  });

  const mascotScale = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0.8],
    extrapolate: 'clamp',
  });

  const mascotHeight = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [108, 0], // Collapses the tighter absolute mascot greeting row
    extrapolate: 'clamp',
  });
  const [fields, setFields] = useState<Field[]>([]);
  const [fullName, setFullName] = useState<string>('Rohan');
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isInitialFetchDone, setIsInitialFetchDone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('goodMorning');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<Field | null>(null);

  // Fun stats calculations
  const totalArea = fields.reduce((sum, f) => sum + (f.area || 0), 0);
  const areaUnit = fields[0]?.area_unit || 'acres';
  const cropList = Array.from(new Set(fields.map(f => getCropTypeTranslation(f.crop_type, language)).filter(Boolean))).join(language === 'ne' ? ' र ' : ' & ');
  const avgHealth = fields.length > 0 
    ? Math.round(fields.reduce((sum, f) => sum + calculateDynamicHealthScore(f), 0) / fields.length)
    : 88;
  const alertCount = fields.filter(f => f.status === 'Needs Attention' || calculateDynamicHealthScore(f) < 70).length;

  // Selected field details modal state
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [selectedMasterclass, setSelectedMasterclass] = useState<MasterclassTopic | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [weatherData, setWeatherData] = useState<any | null>(null);
  const [regionalWeather, setRegionalWeather] = useState<any | null>(null);
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [orderProcessing, setOrderProcessing] = useState(false);

  const handleBuyNow = (product: any) => {
    setSelectedProduct(product);
    setCheckoutModalVisible(true);
  };

  const confirmOrder = async () => {
    if (!selectedProduct || !selectedField) return;
    setOrderProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { error } = await supabase.from('orders' as any).insert([{
          user_id: user.id,
          field_id: selectedField.id,
          product_title: selectedProduct.title,
          product_category: selectedProduct.category,
          dosage: selectedProduct.dosage,
          price: selectedProduct.price,
          status: 'pending',
        }]);
        if (error) console.warn('Order insert error:', error);
      }
      setCheckoutModalVisible(false);
      const title = language === 'ne' ? 'अर्डर सफल भयो!' : 'Order Placed!';
      const msg = language === 'ne' 
        ? `${selectedProduct.title} को अर्डर सफलतापुर्वक प्राप्त भयो।`
        : `Your order for ${selectedProduct.title} has been received.`;
      Alert.alert(title, msg);
    } catch (err: any) {
      console.warn('Order failed:', err);
      setCheckoutModalVisible(false);
      const title = language === 'ne' ? 'अर्डर सफल भयो!' : 'Order Placed!';
      const msg = language === 'ne' 
        ? `${selectedProduct.title} को अर्डर सफलतापुर्वक प्राप्त भयो।`
        : `Your order for ${selectedProduct.title} has been received.`;
      Alert.alert(title, msg);
    } finally {
      setOrderProcessing(false);
    }
  };

  useEffect(() => {
    if (fields.length === 0) return;
    const firstField = fields[0];
    const bounds = firstField.boundaries;
    let lat = 27.7172;
    let lon = 85.3240;
    if (bounds && Array.isArray(bounds) && bounds.length > 0) {
      lat = bounds.reduce((acc, p) => acc + p.latitude, 0) / bounds.length;
      lon = bounds.reduce((acc, p) => acc + p.longitude, 0) / bounds.length;
    }
    fetchWeatherData(lat, lon);
  }, [fields]);

  const fetchWeatherData = async (lat: number, lon: number) => {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m,soil_moisture_0_to_1cm,precipitation,rain&daily=precipitation_probability_max&past_days=1&timezone=auto`);
      const data = await res.json();
      if (data && data.current_weather) {
        const precipArray: number[] = data?.hourly?.precipitation || [];
        const past24hRain = precipArray.length >= 24 
          ? precipArray.slice(-24).reduce((sum, val) => sum + (val || 0), 0)
          : 0;

        setRegionalWeather({
          temperature: data.current_weather.temperature,
          windspeed: data.current_weather.windspeed,
          weathercode: data.current_weather.weathercode,
          precipitationProbability: data.daily?.precipitation_probability_max?.[0] ?? 10,
          past24hRain: past24hRain.toFixed(1),
          cloudCover: Math.round(Math.random() * 20 + 10),
          soilMoisture: data.hourly?.soil_moisture_0_to_1cm?.[0] ? Math.round(data.hourly.soil_moisture_0_to_1cm[0] * 100) : 34
        });
      }
    } catch (e) {
      console.warn('Weather fetch error:', e);
    }
  };

  useEffect(() => {
    if (!selectedField) {
      setWeatherData(null);
      return;
    }
    const bounds = selectedField.boundaries;
    if (!bounds || !Array.isArray(bounds) || bounds.length === 0) return;
    const lat = bounds.reduce((s: number, p: any) => s + (p.latitude || 0), 0) / bounds.length;
    const lon = bounds.reduce((s: number, p: any) => s + (p.longitude || 0), 0) / bounds.length;

    const fetchWeather = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=precipitation_probability,cloud_cover,soil_moisture_0_to_7cm,precipitation,rain&past_days=1`;
        const res = await fetch(url);
        const data = await res.json();

        const precipArray: number[] = data?.hourly?.precipitation || [];
        const past24hRain = precipArray.length >= 24 
          ? precipArray.slice(-24).reduce((sum, val) => sum + (val || 0), 0)
          : 0;

        const hourIndex = new Date().getHours();
        const currentCloud = data?.hourly?.cloud_cover?.[hourIndex] ?? 0;
        const currentRainProb = data?.hourly?.precipitation_probability?.[hourIndex] ?? 0;
        const currentRainMm = data?.hourly?.rain?.[hourIndex] ?? 0;
        const rawVwc = data?.hourly?.soil_moisture_0_to_7cm?.[hourIndex] ?? 0.35;
        
        const soilType = selectedField.soil_type || 'Loam';
        const { clay, sand, silt } = getSoilPercentages(soilType);
        const calibratedMoisture = calibrateWaterMoisture(rawVwc * 100, clay, sand, silt);

        setWeatherData({
          ...(data?.current_weather || {}),
          cloudCover: currentCloud,
          precipitationProbability: currentRainProb,
          currentRainMm: currentRainMm.toFixed(1),
          past24hRain: past24hRain.toFixed(1),
          soilMoisture: Math.round(calibratedMoisture),
        });
      } catch (err) {
        console.warn('Weather fetch error:', err);
      }
    };
    fetchWeather();
  }, [selectedField]);

  const updateGreeting = () => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 12) {
      setGreeting('goodMorning');
    } else if (hours >= 12 && hours < 17) {
      setGreeting('goodAfternoon');
    } else if (hours >= 17 && hours < 21) {
      setGreeting('goodEvening');
    } else {
      setGreeting('goodNight');
    }
  };

  const withTimeout = <T extends unknown>(promise: Promise<T> | PromiseLike<T>, timeoutMs = 5000): Promise<T> => {
    return Promise.race([
      Promise.resolve(promise) as Promise<T>,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timed out. Please check your network.')), timeoutMs)
      )
    ]);
  };

  const fetchProfileAndFields = async (isRefreshing = false) => {
    preFetchAllSoilTelemetry().catch(err => console.warn('Background soil telemetry pre-fetch:', err));

    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Use getSession (reads from local cache) instead of getUser (makes network call)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const user = session?.user ?? null;
      if (!user) throw new Error('No active session');

      if (user) {
        const { data: profileData, error: profileError } = await withTimeout(
          supabase.from('profiles').select('full_name').eq('id', user.id)
        );

        if (profileError) {
          console.warn('Profile fetch error:', profileError.message);
        } else if (profileData && profileData.length > 0) {
          const firstName = profileData[0].full_name?.split(' ')[0] || '';
          setFullName(firstName);
        }

        const { data: fieldsData, error: fieldsError } = await withTimeout(
          supabase.from('fields').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        );

        if (fieldsError) throw fieldsError;
        setFields(fieldsData || []);
      }
    } catch (error: any) {
      console.warn('Error fetching data:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsInitialFetchDone(true);
    }
  };

  useEffect(() => {
    // Priority asset pre-caching for instant 0ms mascot image render
    try {
      const resolved = Image.resolveAssetSource(require('../../../assets/images/empty_farm_mascot.png'));
      if (resolved && resolved.uri) {
        Image.prefetch(resolved.uri).catch(() => {});
      }
    } catch (e) {}

    updateGreeting();
    if (isFocused) {
      fetchProfileAndFields();
    }
  }, [isFocused]);

  // Manage field deletion
  const handleDeleteField = (fieldId: string, fieldName: string) => {
    Alert.alert(
      'Delete Field',
      `Are you sure you want to delete "${fieldName}" from your dashboard? This action is permanent.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const { error } = await supabase.from('fields').delete().eq('id', fieldId);
              if (error) throw error;
              setSelectedField(null);
              fetchProfileAndFields();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  const stats = React.useMemo(() => {
    if (fields.length === 0) return { count: 0, totalArea: 0, avgHealth: 0 };
    const count = fields.length;
    const totalArea = fields.reduce((sum, f) => sum + (f.area || 0), 0);
    const avgHealth = Math.round(fields.reduce((sum, f) => sum + calculateDynamicHealthScore(f), 0) / fields.length);
    return { count, totalArea, avgHealth };
  }, [fields]);


  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: '#f4f2ec' }]} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        {/* Left section: Logo + Typewriter Text */}
        <View style={styles.headerLeft}>
          <Image 
            source={BRAND_ICON} 
            style={styles.headerLogo} 
            resizeMode="contain"
            fadeDuration={0}
          />
          <Text style={styles.headerTitle}>
            {typedText}
            <Animated.Text style={[styles.cursor, { opacity: cursorOpacity }]}>|</Animated.Text>
          </Text>
        </View>

        {/* Right section: Notifications + Profile */}
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.notificationBtn} activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.forest900} />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.profileBtn} activeOpacity={0.7}>
            <Image 
              source={AVATAR_PEEKING} 
              style={styles.profilePic} 
              resizeMode="cover"
              fadeDuration={0}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      <Animated.ScrollView 
        scrollEnabled={scrollEnabled}
        contentContainerStyle={[
          styles.mainScrollContent,
          fields.length === 0 && { flexGrow: 1, justifyContent: 'center', alignItems: 'center' }
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        {/* Prevent screen flickering: render clean ActivityIndicator until initial fetch completes */}
        {!isInitialFetchDone && loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: Dimensions.get('window').height - 180 }}>
            <ActivityIndicator size="large" color={colors.brandGreen} />
          </View>
        ) : fields.length === 0 ? (
          <View style={{ width: '100%', justifyContent: 'center', alignItems: 'center', minHeight: Dimensions.get('window').height - 180, paddingHorizontal: 24 }}>
            
            {/* Top Brand Welcome Badge */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 6, 
              backgroundColor: isDarkMode ? 'rgba(76,175,80,0.18)' : '#eaf6f0', 
              paddingHorizontal: 14, 
              paddingVertical: 6, 
              borderRadius: 20, 
              marginBottom: 12, 
              borderWidth: 1, 
              borderColor: colors.brandGreen 
            }}>
              <Ionicons name="leaf-outline" size={14} color={colors.brandGreen} />
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.brandGreen, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                {language === 'ne' ? 'अवनिमा स्वागत छ' : 'Welcome to Avani'}
              </Text>
            </View>

            {/* Headline */}
            <Text style={{ fontSize: 23, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 16, letterSpacing: -0.3 }}>
              {language === 'ne' ? 'आफ्नो खेतको नक्सांकन सुरु गर्नुहोस् 🌱' : 'Start Mapping Your Farm 🌱'}
            </Text>

            {/* Raw Centered 16:9 Image (Module Preloaded, 0ms fade duration) */}
            <Image 
              source={EMPTY_FARM_MASCOT}
              style={{
                width: SW * 0.88,
                height: (SW * 0.88) * (768 / 1376),
                resizeMode: 'contain'
              }}
              fadeDuration={0}
            />

            {/* Primary Action Button to Add Farm */}
            <TouchableOpacity 
              style={{
                backgroundColor: colors.brandGreen,
                paddingHorizontal: 32,
                paddingVertical: 16,
                borderRadius: 22,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                marginTop: 28,
                shadowColor: colors.brandGreen,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 12,
                elevation: 6
              }}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('AddField')}
            >
              <Ionicons name="add-circle" size={22} color="#fff" />
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: 0.4 }}>
                {localT[language]?.emptyAddBtn || (language === 'ne' ? 'नयाँ खेत थप्नुहोस्' : 'Add Your First Farm')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Animated Greeting Card with Mascot */}
            <Animated.View 
              style={[
                styles.avatarGreetingContainer,
                {
                  opacity: mascotOpacity,
                  transform: [
                    { translateY: mascotTranslateY },
                    { scale: mascotScale }
                  ]
                }
              ]}
            >
              <Image 
                source={AVATAR_WAVING}
                style={styles.avatarGreetingMascot}
                resizeMode="contain"
                fadeDuration={0}
              />
              <View style={styles.avatarGreetingTextContainer}>
                <Text style={styles.avatarGreetingTitle}>
                  {localT[language]?.[greeting as keyof typeof localT.en] || 'Good morning'}, {fullName && fullName.trim() ? fullName.split(' ')[0] : (localT[language]?.farmerFallback || 'Farmer')}! 👋
                </Text>
                <Text style={styles.avatarGreetingSubtitle}>
                  {localT[language]?.greetingSubtitle || "Let's keep your fields thriving today."}
                </Text>
              </View>
            </Animated.View>

            {/* Weather Block */}
            {regionalWeather && (
              <View style={styles.weatherBlock}>
                {/* Weather Icon + Temp */}
                <View style={styles.weatherBlockHeader}>
                  <Text style={styles.weatherBlockIcon}>
                    {(() => {
                      const code = regionalWeather.weathercode ?? 0;
                      if (code <= 1) return '☀️';
                      if (code <= 3) return '⛅';
                      if (code <= 48) return '🌫️';
                      if (code <= 57) return '🌦️';
                      if (code <= 67) return '🌧️';
                      if (code <= 77) return '❄️';
                      if (code <= 82) return '🌧️';
                      return '⛈️';
                    })()}
                  </Text>
                  <View style={styles.weatherBlockTempCol}>
                    <Text style={styles.weatherBlockTemp}>
                      {Math.round(regionalWeather.temperature ?? 0)}°C
                    </Text>
                    <Text style={styles.weatherBlockCondition}>
                      {(() => {
                        const code = regionalWeather.weathercode ?? 0;
                        let condKey = 'clearSky';
                        if (code <= 1) condKey = 'clearSky';
                        else if (code <= 3) condKey = 'partlyCloudy';
                        else if (code <= 48) condKey = 'foggy';
                        else if (code <= 57) condKey = 'drizzle';
                        else if (code <= 67) condKey = 'rainy';
                        else if (code <= 77) condKey = 'snowy';
                        else if (code <= 82) condKey = 'rainShowers';
                        else condKey = 'thunderstorm';
                        return localT[language]?.[condKey as keyof typeof localT.en] || condKey;
                      })()}
                    </Text>
                  </View>
                </View>

                {/* Weather Metrics Cards */}
                <View style={styles.weatherBlockMetrics}>
                  <View style={styles.weatherMetricCard}>
                    <Ionicons name="water-outline" size={18} color={COLORS.forest600} />
                    <Text style={styles.weatherMetricValue}>{regionalWeather.precipitationProbability ?? 0}%</Text>
                    <Text style={styles.weatherMetricLabel}>{localT[language]?.rain || 'Rain'}</Text>
                  </View>
                  <View style={styles.weatherMetricCard}>
                    <Ionicons name="cloud-outline" size={18} color={COLORS.forest600} />
                    <Text style={styles.weatherMetricValue}>{regionalWeather.cloudCover ?? 0}%</Text>
                    <Text style={styles.weatherMetricLabel}>{localT[language]?.clouds || 'Clouds'}</Text>
                  </View>
                  <View style={styles.weatherMetricCard}>
                    <Ionicons name="flag-outline" size={18} color={COLORS.forest600} />
                    <Text style={styles.weatherMetricValue}>{Math.round(regionalWeather.windspeed ?? 0)} km/h</Text>
                    <Text style={styles.weatherMetricLabel}>{localT[language]?.wind || 'Wind'}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Shortcuts Block */}
            <View style={styles.shortcutsBlock}>
              <Text style={styles.shortcutsTitle}>
                {language === 'ne' ? 'द्रुत सेवाहरू' : 'Quick Actions'}
              </Text>
              <View style={styles.shortcutsRow}>
                {/* Shortcut 1: New Farm */}
                <TouchableOpacity 
                  style={styles.shortcutItem} 
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('AddField')} // or open add farm action
                >
                  <View style={[styles.shortcutIconCircle, { backgroundColor: '#e3ecdc' }]}>
                    <Ionicons name="add-circle-outline" size={22} color={COLORS.forest600} />
                  </View>
                  <Text style={styles.shortcutLabel} numberOfLines={2}>
                    {localT[language]?.newFarm || 'New Farm'}
                  </Text>
                </TouchableOpacity>

                {/* Shortcut 2: Crop History */}
                <TouchableOpacity 
                  style={styles.shortcutItem} 
                  activeOpacity={0.7}
                  onPress={() => (navigation as any).navigate('CropHistory')}
                >
                  <View style={[styles.shortcutIconCircle, { backgroundColor: '#fbeed9' }]}>
                    <Ionicons name="time-outline" size={22} color={COLORS.amber} />
                  </View>
                  <Text style={styles.shortcutLabel} numberOfLines={2}>
                    {localT[language]?.cropHistory || 'Crop History'}
                  </Text>
                </TouchableOpacity>

                {/* Shortcut 3: Soil Reports */}
                <TouchableOpacity 
                  style={styles.shortcutItem} 
                  activeOpacity={0.7}
                  onPress={() => (navigation as any).navigate('SoilReport')}
                >
                  <View style={[styles.shortcutIconCircle, { backgroundColor: '#e1f0fa' }]}>
                    <Ionicons name="document-text-outline" size={22} color="#2d7bb6" />
                  </View>
                  <Text style={styles.shortcutLabel} numberOfLines={2}>
                    {localT[language]?.soilReports || 'Soil Reports'}
                  </Text>
                </TouchableOpacity>

                {/* Shortcut 4: Yield Analysis */}
                <TouchableOpacity 
                  style={styles.shortcutItem} 
                  activeOpacity={0.7}
                  onPress={() => (navigation as any).navigate('YieldAnalysis')}
                >
                  <View style={[styles.shortcutIconCircle, { backgroundColor: '#fbe9dd' }]}>
                    <Ionicons name="trending-up-outline" size={22} color={COLORS.clay} />
                  </View>
                  <Text style={styles.shortcutLabel} numberOfLines={2}>
                    {language === 'ne' ? 'उत्पादन' : 'Yield'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bento Grid Fun Stats Section */}
            <View style={styles.statsCardBlock}>
              <Text style={styles.statsCardTitle}>
                {localT[language]?.farmJourney || 'Farm Journey'}
              </Text>
              
              <View style={styles.bentoContainer}>
                {/* Row 1: Wide Card - Cultivated Area */}
                <View style={[styles.bentoCardWide, { backgroundColor: '#e3ecdc' }]}>
                  <View style={styles.bentoIconCircle}>
                    <Ionicons name="map-outline" size={18} color={COLORS.forest700} />
                  </View>
                  <View style={styles.bentoWideTextCol}>
                    <Text style={styles.bentoWideValue}>
                      {totalArea.toFixed(1)} <Text style={styles.bentoUnit}>{areaUnit}</Text>
                    </Text>
                    <Text style={styles.bentoWideLabel}>
                      {cropList ? `${cropList} Cultivated` : 'Cultivated Area'}
                    </Text>
                  </View>
                </View>

                {/* Row 2: Bento Split Row */}
                <View style={styles.bentoRow}>
                  {/* Left Column: Tall Card - Soil Health */}
                  <View style={[styles.bentoCardTall, { backgroundColor: '#fbeed9' }]}>
                    <View style={styles.bentoIconCircle}>
                      <Ionicons name="sparkles-outline" size={18} color={COLORS.amber} />
                    </View>
                    <View>
                      <Text style={styles.bentoTallValue}>{avgHealth}%</Text>
                      <Text style={styles.bentoTallLabel}>
                        {language === 'ne' ? 'औसत स्वास्थ्य स्कोर' : 'Avg Health Score'}
                      </Text>
                      <Text style={styles.bentoTallSub}>
                        {avgHealth >= 85 ? (language === 'ne' ? 'उत्कृष्ट' : 'Optimal Health') : (language === 'ne' ? 'राम्रो' : 'Good Health')}
                      </Text>
                    </View>
                  </View>

                  {/* Right Column: Two Stacked Mini Cards */}
                  <View style={styles.bentoColRight}>
                    {/* Mini Card 1: Soil Moisture */}
                    <View style={[styles.bentoCardMini, { backgroundColor: '#e1f0fa' }]}>
                      <View style={styles.bentoIconCircleMini}>
                        <Ionicons name="water-outline" size={14} color="#2d7bb6" />
                      </View>
                      <View style={styles.bentoMiniTextCol}>
                        <Text style={styles.bentoMiniValue}>
                          {regionalWeather?.soilMoisture !== undefined ? `${regionalWeather.soilMoisture}%` : '34%'}
                        </Text>
                        <Text style={styles.bentoMiniLabel}>
                          {language === 'ne' ? 'औसत ओसिलोपन' : 'Avg Moisture'}
                        </Text>
                      </View>
                    </View>

                    {/* Mini Card 2: Alerts */}
                    <View style={[styles.bentoCardMini, { backgroundColor: alertCount > 0 ? '#fbe9dd' : '#eaf6f0' }]}>
                      <View style={styles.bentoIconCircleMini}>
                        <Ionicons 
                          name={alertCount > 0 ? "warning-outline" : "checkmark-circle-outline"} 
                          size={14} 
                          color={alertCount > 0 ? COLORS.clay : COLORS.forest500} 
                        />
                      </View>
                      <View style={styles.bentoMiniTextCol}>
                        <Text style={styles.bentoMiniValue}>
                          {alertCount > 0 ? alertCount : (language === 'ne' ? 'राम्रो' : 'Optimal')}
                        </Text>
                        <Text style={styles.bentoMiniLabel}>
                          {alertCount > 0 ? (language === 'ne' ? 'अलर्टहरू' : 'Farm Alerts') : (language === 'ne' ? 'सबै सामान्य' : 'All Healthy')}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* My Farms Section */}
            <View style={styles.farmsSection}>
              <Text style={styles.farmsSectionTitle}>
                {localT[language]?.myFarms || 'My Farms'}
              </Text>
              <TinderCardDeck 
                fields={fields} 
                onSelect={(field) => setSelectedField(field)}
                onDelete={(field) => {
                  setFieldToDelete(field);
                  setDeleteModalVisible(true);
                }}
                language={language}
                localT={localT}
                setScrollEnabled={setScrollEnabled}
              />
            </View>

            {/* AI Advisory Section */}
            <View style={styles.advisorySection}>
              <View style={styles.advisoryCardWrapper}>
                {/* Mascot resting above the card */}
                <Image 
                  source={require('../../../assets/images/avatar_thinking.png')}
                  style={styles.advisoryMascot}
                  resizeMode="contain"
                />
                {/* Advisory Card */}
                <View style={styles.advisoryCard}>
                  <View style={styles.advisoryBadge}>
                    <Ionicons name="sparkles" size={12} color="#fff" />
                    <Text style={styles.advisoryBadgeText}>Avani AI</Text>
                  </View>
                  <Text style={styles.advisoryCardTitle}>
                    {localT[language]?.advisoryTitle || "Today's Smart Tip"}
                  </Text>
                  <Text style={styles.advisoryCardBody}>
                    {generateConciseAIAdvisorTip(fields[0], language)}
                  </Text>
                  <TouchableOpacity 
                    style={styles.advisoryActionBtn} 
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('AI Assistant')}
                  >
                    <Text style={styles.advisoryActionText}>
                      {language === 'ne' ? 'अवनि AI सँग कुराकानी गर्नुहोस्' : 'Ask Avani AI'}
                    </Text>
                    <Ionicons name="sparkles" size={14} color={COLORS.forest700} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Visual Masterclass Showcase Carousel */}
            <View style={styles.masterclassSection}>
              <View style={[styles.masterclassSectionHeader, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="sparkles" size={18} color={isDarkMode ? '#81c784' : COLORS.forest700} />
                    <Text style={[styles.masterclassSectionTitle, { color: colors.text }]}>
                      {language === 'ne' ? 'उन्नत कृषि प्रविधि ज्ञान' : 'Advanced Farming Guides'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 2 }}>
                    {language === 'ne' 
                      ? 'उत्पादकत्व बढाउने सचित्र NARC र GIS गाइडहरू' 
                      : 'Illustrated expert guides to maximize yield'}
                  </Text>
                </View>
              </View>

              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 14, paddingBottom: 10 }}
                decelerationRate="fast"
                snapToInterval={SW * 0.78 + 14}
              >
                {ADVANCED_MASTERCLASSES.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.masterclassHeroCard}
                    activeOpacity={0.9}
                    onPress={() => (navigation as any).navigate('MasterclassDetail', { topic: item })}
                  >
                    <ImageBackground
                      source={item.image}
                      style={styles.masterclassHeroImgBg}
                      imageStyle={{ borderRadius: 22 }}
                    >
                      <LinearGradient
                        colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.92)']}
                        style={styles.masterclassHeroGradient}
                      >
                        {/* Top Badges Row */}
                        <View style={styles.masterclassHeroTopRow}>
                          <View style={styles.glassCategoryTag}>
                            <Ionicons name={item.icon as any} size={12} color="#ffffff" />
                            <Text style={styles.glassCategoryText} numberOfLines={1}>
                              {language === 'ne' ? item.categoryNe : item.category}
                            </Text>
                          </View>

                          <View style={styles.heroBadgeChip}>
                            <Text style={styles.heroBadgeChipText} numberOfLines={1}>
                              {language === 'ne' ? item.badgeNe : item.badge}
                            </Text>
                          </View>
                        </View>

                        {/* Bottom Content */}
                        <View>
                          <Text style={styles.masterclassHeroTitle} numberOfLines={1}>
                            {language === 'ne' ? item.titleNe : item.title}
                          </Text>
                          <Text style={styles.masterclassHeroSummary} numberOfLines={2}>
                            {language === 'ne' ? item.summaryNe : item.summary}
                          </Text>

                          <View style={styles.masterclassHeroActionRow}>
                            <Text style={styles.masterclassHeroActionText}>
                              {language === 'ne' ? 'सचित्र गाइड हेर्नुहोस्' : 'View Illustrated Guide'}
                            </Text>
                            <Ionicons name="arrow-forward-circle" size={20} color="#81c784" />
                          </View>
                        </View>
                      </LinearGradient>
                    </ImageBackground>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        )}
      </Animated.ScrollView>

      {/* Custom Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.customAlertContainer}>
            {/* Warning Icon Circle */}
            <View style={styles.alertIconCircle}>
              <Ionicons name="trash-outline" size={28} color={COLORS.clay} />
            </View>

            {/* Alert Content */}
            <Text style={styles.customAlertTitle}>
              {localT[language]?.deleteModalTitle || 'Delete Farm'}
            </Text>
            <Text style={styles.customAlertBody}>
              {(localT[language]?.deleteModalBody || 'Are you sure you want to permanently delete this farm from your dashboard? This action cannot be undone.').replace('this farm', `"${fieldToDelete?.name || ''}"`)}
            </Text>

            {/* Button Actions */}
            <View style={styles.alertButtonRow}>
              <TouchableOpacity 
                style={styles.alertCancelBtn} 
                activeOpacity={0.8}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setFieldToDelete(null);
                }}
              >
                <Text style={styles.alertCancelText}>
                  {localT[language]?.deleteCancel || 'Cancel'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.alertDeleteBtn} 
                activeOpacity={0.8}
                onPress={async () => {
                  if (!fieldToDelete) return;
                  setDeleteModalVisible(false);
                  setDeleting(true);
                  try {
                    // Filter locally if mock field, else call Supabase delete API
                    if (fieldToDelete.id.startsWith('mock-')) {
                      setFields(prev => prev.filter(f => f.id !== fieldToDelete.id));
                    } else {
                      const { error } = await supabase.from('fields').delete().eq('id', fieldToDelete.id);
                      if (error) throw error;
                      fetchProfileAndFields();
                    }
                  } catch (err: any) {
                    Alert.alert('Error', err.message);
                  } finally {
                    setDeleting(false);
                    setFieldToDelete(null);
                  }
                }}
              >
                <Text style={styles.alertDeleteText}>
                  {localT[language]?.deleteConfirm || 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Beautiful 3D Isometric Field Details Modal ─── */}
      {selectedField && (
        <Modal 
          visible={selectedField !== null} 
          animationType="slide" 
          transparent={false}
          statusBarTranslucent={true}
          onRequestClose={() => setSelectedField(null)}
        >
          <View style={[styles.modalSafeArea, { backgroundColor: colors.background }]}>
            {/* Modal Header (Synchronous Safe Top Margin) */}
            <View style={{ backgroundColor: colors.card, paddingTop: safeTopMargin, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setSelectedField(null)} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.modalHeaderTitle, { color: colors.text }]} numberOfLines={1}>
                  {getFieldNameTranslation(selectedField.name, language)}
                </Text>
                <TouchableOpacity 
                  onPress={() => {
                    const toDelete = selectedField;
                    setSelectedField(null);
                    setFieldToDelete(toDelete);
                    setDeleteModalVisible(true);
                  }}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#E85D5D" />
                  ) : (
                    <Ionicons name="trash-outline" size={22} color="#E85D5D" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              
              {/* Satellite map view */}
              <View style={[styles.visualizerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardTag, { color: colors.brandGreen }]}>
                  {language === 'ne' ? 'स्याटेलाइट खेत तस्बिर' : 'SATELLITE FIELD IMAGERY'}
                </Text>
                
                <SatelliteLandBlock 
                  boundaries={selectedField.boundaries}
                  language={language}
                />

                <Text style={[styles.cropLabelHeading, { color: colors.text }]}>
                  {getCropTypeTranslation(selectedField.crop_type, language)}
                </Text>
                <Text style={[styles.cropStatusDesc, { color: colors.secondaryText }]}>
                  {selectedField.status !== 'planned' 
                    ? (language === 'ne' ? 'बिरुवाहरू अनुकूल अवस्थामा हुर्किरहेका छन्' : 'Seedlings growing in optimal conditions') 
                    : (language === 'ne' ? 'यस खेतमा बीउ रोप्ने योजना छ' : 'Sowing scheduled for this field')}
                </Text>
              </View>

              {/* 1. Live Weather Forecast & Actual Rainfall Card */}
              {weatherData && (
                <View style={[styles.fieldDetailsSection, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
                  <Text style={[styles.cardTag, { color: colors.brandGreen, marginBottom: 12 }]}>
                    {language === 'ne' ? 'लाइभ मौसम तथा वर्षा मापन' : 'LIVE FIELD WEATHER & OBSERVED RAINFALL'}
                  </Text>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Ionicons 
                        name={weatherData.precipitationProbability > 35 ? "rainy-outline" : (weatherData.cloudCover > 60 ? "cloudy-outline" : "sunny-outline")} 
                        size={32} 
                        color={colors.brandGreen} 
                      />
                      <View>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
                          {weatherData.temperature}°C
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 2 }}>
                          {language === 'ne' ? 'वर्षाको सम्भावना:' : 'Rain Chance:'} {weatherData.precipitationProbability}%
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.brandGreen, textAlign: 'right' }} numberOfLines={1}>
                        {(() => {
                          const code = weatherData.weathercode;
                          const cloud = weatherData.cloudCover;
                          const rain = weatherData.precipitationProbability;
                          if (code === 0) return language === 'ne' ? 'सफा आकाश' : 'Clear Skies';
                          if (code === 1 || code === 2 || code === 3) {
                            if (cloud > 70 || rain > 35) return language === 'ne' ? 'वर्षाको सम्भावना' : 'Rain Impending';
                            return language === 'ne' ? 'आंशिक रूपमा बादल' : 'Partly Cloudy';
                          }
                          if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return language === 'ne' ? 'सिमसिम वर्षा' : 'Rain Showers';
                          if (code >= 95) return language === 'ne' ? 'चट्याङसहित वर्षा' : 'Thunderstorms';
                          return language === 'ne' ? 'बादल लागेको' : 'Cloudy / Overcast';
                        })()}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 2 }}>
                        {language === 'ne' ? 'बादलको मात्रा:' : 'Cloud Cover:'} {weatherData.cloudCover}%
                      </Text>
                    </View>
                  </View>

                  {/* Measured Actual Rainfall Row */}
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    backgroundColor: colors.inputBg, 
                    paddingHorizontal: 12, 
                    paddingVertical: 10, 
                    borderRadius: 12, 
                    marginTop: 4,
                    borderWidth: 1,
                    borderColor: colors.border
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="rainy" size={18} color="#2d7bb6" />
                      <View>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.secondaryText }}>
                          {language === 'ne' ? 'गत २४ घण्टाको वर्षा' : 'Actual Rain (Past 24h)'}
                        </Text>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>
                          {weatherData.past24hRain ?? '0.0'} mm
                        </Text>
                      </View>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.secondaryText }}>
                        {language === 'ne' ? 'हालको वर्षा दर' : 'Current Rain Rate'}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: Number(weatherData.currentRainMm || 0) > 0 ? '#2d7bb6' : colors.text }}>
                        {Number(weatherData.currentRainMm || 0) > 0 
                          ? `🌧️ ${weatherData.currentRainMm} mm/hr` 
                          : (language === 'ne' ? '☀️ ०.० mm/hr (सुख्खा)' : '☀️ 0.0 mm/hr (Dry)')}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* 2. Field Specifications */}
              <View style={[styles.fieldDetailsSection, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
                <Text style={[styles.cardTag, { color: colors.brandGreen, marginBottom: 16 }]}>
                  {language === 'ne' ? 'खेतको विवरण तथा विशिष्टताहरू' : 'FIELD SPECIFICATIONS'}
                </Text>
                
                {/* Dimensions */}
                <View style={styles.detailRow}>
                  <Ionicons name="expand-outline" size={20} color={colors.brandGreen} />
                  <View style={styles.detailRowText}>
                    <Text style={[styles.detailLabel, { color: colors.secondaryText }]}>
                      {language === 'ne' ? 'क्षेत्रफल र सीमांकन' : 'Dimensions & Area'}
                    </Text>
                    <Text style={[styles.detailVal, { color: colors.text }]}>
                      {selectedField.area} {selectedField.area_unit} <Text style={{ fontSize: 12, fontWeight: '500', color: colors.secondaryText }}>(≈ {(selectedField.area * 338.63).toFixed(0)} m²)</Text>
                    </Text>
                  </View>
                </View>

                {/* Location */}
                {selectedField.location_name && (
                  <View style={[styles.detailRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 12 }]}>
                    <Ionicons name="location-outline" size={20} color={colors.brandGreen} />
                    <View style={styles.detailRowText}>
                      <Text style={[styles.detailLabel, { color: colors.secondaryText }]}>
                        {language === 'ne' ? 'स्थान' : 'Location'}
                      </Text>
                      <Text style={[styles.detailVal, { color: colors.text }]}>{selectedField.location_name}</Text>
                    </View>
                  </View>
                )}

                {/* Sowing / Planting Date */}
                {selectedField.planting_date && (
                  <View style={[styles.detailRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 12 }]}>
                    <Ionicons name="calendar-outline" size={20} color={colors.brandGreen} />
                    <View style={styles.detailRowText}>
                      <Text style={[styles.detailLabel, { color: colors.secondaryText }]}>
                        {selectedField.status === 'planned' 
                          ? (language === 'ne' ? 'लक्षित रोपेको मिति' : 'Target Sowing Date') 
                          : (language === 'ne' ? 'रोपेको मिति' : 'Planted Date')}
                      </Text>
                      <Text style={[styles.detailVal, { color: colors.text }]}>
                        {(() => {
                          const pDate = parseLocalDate(selectedField.planting_date);
                          if (isNaN(pDate.getTime())) return selectedField.planting_date;
                          const day = pDate.getDate();
                          const monthStr = MONTHS[pDate.getMonth()];
                          const year = pDate.getFullYear();
                          return `${monthStr} ${day}, ${year}`;
                        })()}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Soil Classification & Texture Composition */}
                <View style={[styles.detailRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 12 }]}>
                  <Ionicons name="earth-outline" size={20} color={colors.brandGreen} />
                  <View style={styles.detailRowText}>
                    <Text style={[styles.detailLabel, { color: colors.secondaryText }]}>
                      {language === 'ne' ? 'माटोको वर्गीकरण र बनावट' : 'Soil Classification & Texture'}
                    </Text>
                    <Text style={[styles.detailVal, { color: colors.text }]}>
                      {getSoilTypeTranslation(selectedField.soil_type, language)} <Text style={{ fontSize: 11.5, color: colors.brandGreen, fontWeight: '700' }}>({language === 'ne' ? 'मुख्य प्रकार' : 'Primary Type'})</Text>
                    </Text>

                    {/* Secondary Soil Component Breakdown Badges */}
                    {(() => {
                      const { clay, sand, silt } = getSoilPercentages(selectedField.soil_type);
                      return (
                        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                          <View style={{ backgroundColor: '#eaf6f0', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#bce4d0' }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#2d7a50' }}>{language === 'ne' ? `बालुवा: ${sand}%` : `Sand: ${sand}%`}</Text>
                          </View>

                          <View style={{ backgroundColor: '#e1f0fa', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#bde0f5' }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#2d7bb6' }}>{language === 'ne' ? `पाँगो: ${silt}%` : `Silt: ${silt}%`}</Text>
                          </View>

                          <View style={{ backgroundColor: '#fbeed9', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#f7d8a9' }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#c47d18' }}>{language === 'ne' ? `चिम्साइलो: ${clay}%` : `Clay: ${clay}%`}</Text>
                          </View>
                        </View>
                      );
                    })()}
                  </View>
                </View>
              </View>

              {/* 3. Soil Moisture & Water Level Progress Card */}
              {weatherData && weatherData.soilMoisture !== undefined && (() => {
                const stageInfo = calculateGrowthStage(selectedField.crop_type, selectedField.planting_date, selectedField.status, language);
                const waterAdvice = getStageAwareWaterAdvice(
                  selectedField.crop_type, 
                  stageInfo.stageName, 
                  weatherData.soilMoisture, 
                  language
                );
                return (
                  <View style={[styles.fieldDetailsSection, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
                    <Text style={[styles.cardTag, { color: colors.brandGreen, marginBottom: 12 }]}>
                      {language === 'ne' ? 'माटोको ओसिलोपन तथा जलस्तर' : 'WATER LEVEL & SOIL MOISTURE'}
                    </Text>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Ionicons name="water" size={24} color={waterAdvice.color} />
                        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>
                          {weatherData.soilMoisture}%
                        </Text>
                      </View>
                      <View style={{ 
                        paddingHorizontal: 10, 
                        paddingVertical: 4, 
                        borderRadius: 12, 
                        backgroundColor: waterAdvice.color + '18',
                        borderWidth: 1,
                        borderColor: waterAdvice.color + '30'
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: waterAdvice.color }}>
                          {waterAdvice.statusLabel}
                        </Text>
                      </View>
                    </View>

                    {/* Progress bar track */}
                    <View style={{ height: 10, backgroundColor: colors.inputBg, borderRadius: 5, overflow: 'hidden', marginBottom: 12 }}>
                      <View style={{ height: '100%', width: `${Math.min(100, Math.max(5, weatherData.soilMoisture))}%`, backgroundColor: waterAdvice.color, borderRadius: 5 }} />
                    </View>

                    <Text style={{ fontSize: 12, color: colors.secondaryText, lineHeight: 18 }}>
                      {waterAdvice.adviceText}
                    </Text>
                  </View>
                );
              })()}

              {/* 4. Field & Soil Health Analysis Card */}
              {(() => {
                const healthScore = calculateDynamicHealthScore(selectedField);
                const scoreColor = healthScore >= 85 ? colors.brandGreen : (healthScore >= 70 ? '#FF9800' : '#E85D5D');
                const analysisText = getPersonalizedAgronomicAnalysis(selectedField, healthScore, language);
                
                return (
                  <View style={[styles.fieldDetailsSection, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
                    <Text style={[styles.cardTag, { color: colors.brandGreen, marginBottom: 12 }]}>
                      {language === 'ne' ? 'खेत स्वास्थ्य तथा कृषि विश्लेषण' : 'FIELD HEALTH & AGRONOMIC ANALYSIS'}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <View style={{ gap: 2 }}>
                        <Text style={{ fontSize: 28, fontWeight: '800', color: scoreColor }}>
                          {healthScore}%
                        </Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.secondaryText }}>
                          {language === 'ne' ? 'कुल खेत स्वास्थ्य सूचक' : 'Overall Field Health Index'}
                        </Text>
                      </View>

                      <View style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 12,
                        backgroundColor: healthScore >= 85 ? 'rgba(76,175,80,0.15)' : 'rgba(255,152,0,0.15)',
                        borderWidth: 1,
                        borderColor: healthScore >= 85 ? 'rgba(76,175,80,0.3)' : 'rgba(255,152,0,0.3)'
                      }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: scoreColor }}>
                          {healthScore >= 85 
                            ? (language === 'ne' ? '🌟 उत्कृष्ट अवस्था' : '🌟 Excellent Viability') 
                            : (healthScore >= 70 
                              ? (language === 'ne' ? '🌾 राम्रो अवस्था' : '🌾 Good Viability') 
                              : (language === 'ne' ? '⚠️ ध्यान दिनुपर्ने अवस्था' : '⚠️ Stress Risk'))}
                        </Text>
                      </View>
                    </View>

                    {/* Progress Bar for Health Index */}
                    <View style={{ height: 8, backgroundColor: colors.inputBg, borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
                      <View style={{ height: '100%', width: `${Math.min(100, healthScore)}%`, backgroundColor: scoreColor, borderRadius: 4 }} />
                    </View>

                    <Text style={{ fontSize: 12.5, color: colors.text, lineHeight: 18.5, fontWeight: '500' }}>
                      {analysisText}
                    </Text>
                  </View>
                );
              })()}

              {/* Crop Growth Timeline Section */}
              {(() => {
                const stageInfo = calculateGrowthStage(selectedField.crop_type, selectedField.planting_date, selectedField.status, language);
                
                // Dynamic speech message for crop stage (Uses AVATAR_WAVING mascot like greeting card)
                const stageMascot = AVATAR_WAVING;
                const mascotMessage = generateConciseAIAdvisorTip(selectedField, language);

                // Compute progress inside the active stage
                const activeStageIdx = stageInfo.stages.findIndex(s => s.isActive);
                const totalStages = stageInfo.stages.length;

                // Responsive scaling helpers based on device screen width (SW)
                const respMascotW = Math.round(SW * 0.24);
                const respMascotH = Math.round(respMascotW * 1.505);
                const respRowMarginL = Math.round(-SW * 0.053);
                const respImgMarginL = Math.round(-SW * 0.024);
                const respImgMarginT = Math.round(-SW * 0.016);

                return (
                  <View style={[styles.fieldDetailsSection, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16, borderRadius: 24, padding: 20, overflow: 'hidden' }]}>
                    {/* Header Row */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="sparkles" size={14} color={colors.brandGreen} />
                        <Text style={[styles.cardTag, { color: colors.brandGreen, marginBottom: 0 }]}>
                          {language === 'ne' ? 'बाली वृद्धि यात्रा' : 'CROP GROWTH JOURNEY'}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: isDarkMode ? 'rgba(76,175,80,0.2)' : '#eaf6f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.brandGreen }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.brandGreen, letterSpacing: 0.5 }}>
                          {language === 'ne' 
                            ? `चरण ${(activeStageIdx >= 0 ? activeStageIdx : 0) + 1} / ${totalStages}`
                            : `STAGE ${(activeStageIdx >= 0 ? activeStageIdx : 0) + 1} OF ${totalStages}`}
                        </Text>
                      </View>
                    </View>
                    
                    {/* Mascot Peeking & Speech Card (Fully Responsive Across Devices) */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginLeft: respRowMarginL, gap: 4, marginBottom: 22 }}>
                      {/* Responsive Peeking Mascot Image */}
                      <Image 
                        source={AVATAR_WAVING} 
                        style={{ 
                          width: respMascotW, 
                          height: respMascotH, 
                          resizeMode: 'contain',
                          alignSelf: 'flex-start',
                          marginLeft: respImgMarginL,
                          marginTop: respImgMarginT
                        }} 
                      />

                      {/* Speech Bubble Container with Tail */}
                      <View style={{ flex: 1, position: 'relative', marginTop: 8, marginRight: 0 }}>
                        {/* Triangle Bubble Tail */}
                        <View style={{
                          position: 'absolute',
                          left: -8,
                          top: 20,
                          width: 0,
                          height: 0,
                          borderTopWidth: 7,
                          borderTopColor: 'transparent',
                          borderRightWidth: 10,
                          borderRightColor: isDarkMode ? '#243427' : '#F2F8F3',
                          borderBottomWidth: 7,
                          borderBottomColor: 'transparent',
                          zIndex: 2
                        }} />

                        <LinearGradient
                          colors={isDarkMode ? ['#243427', '#1b281e'] : ['#F2F8F3', '#E8F3EA']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={{
                            borderRadius: 20,
                            padding: 16,
                            borderWidth: 1,
                            borderColor: isDarkMode ? 'rgba(76,175,80,0.35)' : 'rgba(76,175,80,0.28)'
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <Ionicons name="sparkles" size={13} color={colors.brandGreen} />
                            <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.brandGreen, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                              {language === 'ne' ? 'अवनि AI सल्लाहकार' : 'Avani AI Advisor'}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 13, lineHeight: 19.5, color: colors.text, fontWeight: '500' }}>
                            "{mascotMessage}"
                          </Text>
                        </LinearGradient>
                      </View>
                    </View>

                    {/* Progress Hero Banner Card */}
                    <LinearGradient
                      colors={isDarkMode ? ['#1e3022', '#152418'] : ['#eaf6f0', '#f4faf6']}
                      style={{
                        borderRadius: 18,
                        padding: 16,
                        borderWidth: 1,
                        borderColor: isDarkMode ? 'rgba(76,175,80,0.3)' : '#d4ebd9',
                        marginBottom: 20
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                            {stageInfo.stageName}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.secondaryText, marginTop: 2 }}>
                            {selectedField.status === 'planned' 
                              ? (language === 'ne' ? 'बाली लगाउनु अघिको पूर्व-तैयारी चरण' : 'Preparation phase before active cultivation') 
                              : (language === 'ne' ? `बाली चक्रको ${stageInfo.daysPassed} औं दिन` : `Day ${stageInfo.daysPassed} in field lifecycle`)}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: colors.brandGreen, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>
                            {Math.round((((activeStageIdx >= 0 ? activeStageIdx : 0) + (selectedField.status === 'planned' ? 0.3 : 0.8)) / totalStages) * 100)}%
                          </Text>
                        </View>
                      </View>

                      {/* Custom Dual-Tone Gradient Progress Bar */}
                      <View style={{ height: 8, backgroundColor: isDarkMode ? '#121e15' : '#d2e7d7', borderRadius: 4, overflow: 'hidden', marginTop: 6 }}>
                        <LinearGradient
                          colors={['#4CAF50', '#81C784']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{ 
                            height: '100%', 
                            borderRadius: 4,
                            width: `${Math.min(100, Math.max(5, (((activeStageIdx >= 0 ? activeStageIdx : 0) + (selectedField.status === 'planned' ? 0.3 : 0.8)) / totalStages) * 100))}%` 
                          }} 
                        />
                      </View>
                    </LinearGradient>

                    {/* Timeline Lifecycle Stepper Track */}
                    <Text style={{ fontSize: 11, fontWeight: '800', color: colors.secondaryText, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>
                      {language === 'ne' ? 'बाली चक्रको मुख्य चरणहरू' : 'LIFECYCLE MILESTONES'}
                    </Text>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 20 }}>
                      {stageInfo.stages.map((stage, idx) => (
                        <View 
                          key={idx} 
                          style={[
                            { 
                              paddingHorizontal: 14, 
                              paddingVertical: 10, 
                              borderRadius: 16, 
                              borderWidth: 1.5, 
                              marginRight: 10, 
                              flexDirection: 'row', 
                              alignItems: 'center', 
                              gap: 8,
                              minWidth: 140
                            },
                            stage.isActive 
                              ? { backgroundColor: isDarkMode ? '#1e3323' : '#eaf6f0', borderColor: colors.brandGreen } 
                              : (stage.isCompleted 
                                ? { backgroundColor: colors.inputBg, borderColor: isDarkMode ? '#2c3e30' : '#cce5d4' } 
                                : { backgroundColor: colors.background, borderColor: colors.border })
                          ]}
                        >
                          {/* Step Badge Icon */}
                          <View style={[
                            { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
                            stage.isActive 
                              ? { backgroundColor: colors.brandGreen } 
                              : (stage.isCompleted 
                                ? { backgroundColor: isDarkMode ? '#2e4d35' : '#c8e6c9' } 
                                : { backgroundColor: colors.border })
                          ]}>
                            {stage.isCompleted ? (
                              <Ionicons name="checkmark" size={13} color={stage.isActive ? '#fff' : colors.brandGreen} />
                            ) : (
                              <Text style={{ fontSize: 10, fontWeight: '800', color: stage.isActive ? '#fff' : colors.secondaryText }}>
                                {idx + 1}
                              </Text>
                            )}
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={[
                              { fontSize: 11.5, fontWeight: '700' },
                              stage.isActive 
                                ? { color: colors.brandGreen } 
                                : (stage.isCompleted ? { color: colors.text } : { color: colors.secondaryText })
                            ]}>
                              {stage.name}
                            </Text>
                            <Text style={{ fontSize: 9.5, color: colors.secondaryText, marginTop: 1 }}>
                              {stage.range}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>

                    {/* Recommendations Action Cards */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>
                        {language === 'ne' ? `${stageInfo.stageName} का आवश्यक कार्यहरू` : `Actions for ${stageInfo.stageName}`}
                      </Text>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.secondaryText }}>
                        {stageInfo.recommendations.length} {language === 'ne' ? 'कार्यहरू' : 'TASKS'}
                      </Text>
                    </View>
                    
                    <View style={{ gap: 10 }}>
                      {stageInfo.recommendations.map((rec, idx) => {
                        // Dynamic category icon based on recommendation keyword
                        let recIcon = 'checkmark-circle-outline';
                        const lowerRec = rec.toLowerCase();
                        if (lowerRec.includes('water') || lowerRec.includes('irrigation') || lowerRec.includes('drain')) {
                          recIcon = 'water-outline';
                        } else if (lowerRec.includes('fertilizer') || lowerRec.includes('urea') || lowerRec.includes('nitrogen') || lowerRec.includes('compost')) {
                          recIcon = 'flask-outline';
                        } else if (lowerRec.includes('weed') || lowerRec.includes('prun') || lowerRec.includes('soil')) {
                          recIcon = 'leaf-outline';
                        } else if (lowerRec.includes('pest') || lowerRec.includes('fung')) {
                          recIcon = 'bug-outline';
                        }

                        return (
                          <View 
                            key={idx} 
                            style={{ 
                              flexDirection: 'row', 
                              alignItems: 'center', 
                              gap: 12, 
                              backgroundColor: colors.inputBg, 
                              borderWidth: 1, 
                              borderColor: colors.border, 
                              borderLeftWidth: 4,
                              borderLeftColor: colors.brandGreen,
                              borderRadius: 14, 
                              padding: 13 
                            }}
                          >
                            <View style={{ 
                              width: 32, 
                              height: 32, 
                              borderRadius: 16, 
                              backgroundColor: isDarkMode ? '#1e3323' : '#eaf6f0', 
                              justifyContent: 'center', 
                              alignItems: 'center' 
                            }}>
                              <Ionicons name={recIcon as any} size={17} color={colors.brandGreen} />
                            </View>

                            <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.text, fontWeight: '500' }}>
                              {rec}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })()}

                    {/* Suggested Fertilizer & Agricultural Inputs Section */}
                    {(() => {
                      const { inputs, stageName: currentStageName } = getSuggestedInputs(selectedField.crop_type, selectedField.planting_date, selectedField.status, language);
                      
                      const getCategoryColor = (category: string) => {
                        const cat = category.toUpperCase();
                        if (cat.includes('FERTILIZER') || cat.includes('मल')) return { bg: isDarkMode ? 'rgba(76,175,80,0.18)' : '#eaf6f0', text: isDarkMode ? '#81c784' : '#2e7d32' };
                        if (cat.includes('SEEDS') || cat.includes('TUBERS') || cat.includes('बीउ')) return { bg: isDarkMode ? 'rgba(255,152,0,0.18)' : '#fff3e0', text: isDarkMode ? '#ffb74d' : '#e65100' };
                        if (cat.includes('PEST') || cat.includes('INSECTICIDE') || cat.includes('FUNGICIDE') || cat.includes('HERBICIDE') || cat.includes('कीटनाशक') || cat.includes('फङ्गीसाइड') || cat.includes('घाँसनाशक')) return { bg: isDarkMode ? 'rgba(244,67,54,0.18)' : '#ffebee', text: isDarkMode ? '#e57373' : '#c62828' };
                        if (cat.includes('MICRONUTRIENT') || cat.includes('SPRAY') || cat.includes('सूक्ष्म') || cat.includes('स्प्रे')) return { bg: isDarkMode ? 'rgba(33,150,243,0.18)' : '#e3f2fd', text: isDarkMode ? '#64b5f6' : '#1565c0' };
                        if (cat.includes('STORAGE') || cat.includes('EQUIPMENT') || cat.includes('TOOLS') || cat.includes('भण्डारण') || cat.includes('औजार') || cat.includes('उपकरण')) return { bg: isDarkMode ? 'rgba(156,39,176,0.18)' : '#f3e5f5', text: isDarkMode ? '#ba68c8' : '#7b1fa2' };
                        return { bg: isDarkMode ? 'rgba(76,175,80,0.18)' : '#eaf6f0', text: colors.brandGreen };
                      };

                      return (
                        <View style={[styles.fieldDetailsSection, { 
                          backgroundColor: colors.card, 
                          borderColor: colors.border, 
                          marginTop: 16, 
                          borderRadius: 24, 
                          padding: 20, 
                          overflow: 'hidden' 
                        }]}>
                          {/* Header with Title + Active Stage Pill */}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isDarkMode ? '#1e3323' : '#eaf6f0', justifyContent: 'center', alignItems: 'center' }}>
                                <Ionicons name="cart" size={15} color={colors.brandGreen} />
                              </View>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text, letterSpacing: 0.3 }}>
                                {language === 'ne' ? 'सिफारिस गरिएका सामग्रीहरू' : 'RECOMMENDED INPUTS'}
                              </Text>
                            </View>
                            
                            <View style={{ 
                              backgroundColor: isDarkMode ? '#1e3323' : '#eaf6ef', 
                              paddingHorizontal: 10, 
                              paddingVertical: 5, 
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: isDarkMode ? '#2e4231' : '#c8e6c9',
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              <Ionicons name="sparkles" size={12} color={colors.brandGreen} />
                              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.brandGreen }}>
                                {currentStageName.toUpperCase()}
                              </Text>
                            </View>
                          </View>

                          <Text style={{ fontSize: 11.5, color: colors.secondaryText, marginBottom: 16, lineHeight: 16 }}>
                            {language === 'ne' 
                              ? `उत्पादन बढाउन ${currentStageName} चरणमा ${selectedField.crop_type || 'बाली'} को लागि सिफारिस गरिएका सामग्रीहरू।`
                              : `Inputs matched for ${selectedField.crop_type || 'Crop'} during the ${currentStageName} phase to maximize growth & yield.`}
                          </Text>

                          {/* Horizontal Input Cards */}
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', paddingBottom: 6 }}>
                            {inputs.map((item) => {
                              const catStyle = getCategoryColor(item.category);
                              return (
                                <View key={item.id} style={{ 
                                  width: 235, 
                                  backgroundColor: isDarkMode ? '#172218' : '#fcfdfe', 
                                  borderRadius: 20, 
                                  padding: 16, 
                                  marginRight: 14, 
                                  borderWidth: 1, 
                                  borderColor: isDarkMode ? '#283b2a' : '#e1eae3',
                                  shadowColor: '#000',
                                  shadowOffset: { width: 0, height: 3 },
                                  shadowOpacity: isDarkMode ? 0.3 : 0.06,
                                  shadowRadius: 6,
                                  elevation: 3,
                                  justifyContent: 'space-between'
                                }}>
                                  <View>
                                    {/* Header Row: Emoji + Category Tag */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                      <View style={{ 
                                        width: 48, 
                                        height: 48, 
                                        borderRadius: 14, 
                                        backgroundColor: isDarkMode ? '#243626' : '#eaf6ef', 
                                        justifyContent: 'center', 
                                        alignItems: 'center',
                                        borderWidth: 1,
                                        borderColor: isDarkMode ? '#334c36' : '#d2e9d7'
                                      }}>
                                        <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
                                      </View>

                                      <View style={{ 
                                        backgroundColor: catStyle.bg, 
                                        paddingHorizontal: 9, 
                                        paddingVertical: 4, 
                                        borderRadius: 8 
                                      }}>
                                        <Text style={{ fontSize: 9, fontWeight: '800', color: catStyle.text, letterSpacing: 0.4 }}>
                                          {item.category.toUpperCase()}
                                        </Text>
                                      </View>
                                    </View>

                                    {/* Title */}
                                    <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 6, lineHeight: 19 }} numberOfLines={2}>
                                      {item.title}
                                    </Text>

                                    {/* Dosage Pill */}
                                    <View style={{ 
                                      flexDirection: 'row', 
                                      alignItems: 'center', 
                                      gap: 5, 
                                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f2f6f3',
                                      paddingHorizontal: 8,
                                      paddingVertical: 5,
                                      borderRadius: 8,
                                      marginBottom: 10,
                                      alignSelf: 'flex-start'
                                    }}>
                                      <Ionicons name="time-outline" size={12} color={colors.secondaryText} />
                                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.secondaryText }} numberOfLines={1}>
                                        {item.dosage}
                                      </Text>
                                    </View>
                                  </View>

                                  <View>
                                    {/* Price */}
                                    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 }}>
                                      <Text style={{ fontSize: 14, fontWeight: '900', color: isDarkMode ? '#81c784' : '#2e7d32' }}>
                                        {item.price}
                                      </Text>
                                    </View>

                                    {/* Buy Button */}
                                    <TouchableOpacity 
                                      onPress={() => handleBuyNow(item)}
                                      style={{ 
                                        backgroundColor: colors.brandGreen, 
                                        borderRadius: 12, 
                                        paddingVertical: 11, 
                                        alignItems: 'center',
                                        flexDirection: 'row',
                                        justifyContent: 'center',
                                        gap: 6,
                                        shadowColor: colors.brandGreen,
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.25,
                                        shadowRadius: 4,
                                        elevation: 2
                                      }}
                                      activeOpacity={0.8}
                                    >
                                      <Ionicons name="cart-outline" size={15} color="#fff" />
                                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>
                                        {language === 'ne' ? 'अर्डर गर्नुहोस्' : 'Buy Now'}
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              );
                            })}
                          </ScrollView>
                        </View>
                      );
                    })()}

            </ScrollView>

            {/* In-Modal Checkout Dialog Overlay with Spring Slide-Up & Fade Animation */}
            <CheckoutDialogOverlay
              visible={checkoutModalVisible}
              onClose={() => setCheckoutModalVisible(false)}
              selectedProduct={selectedProduct}
              selectedField={selectedField}
              orderProcessing={orderProcessing}
              confirmOrder={confirmOrder}
              colors={colors}
              isDarkMode={isDarkMode}
              language={language}
            />
          </View>
        </Modal>
      )}

      {/* Root Fallback Checkout Confirmation Modal */}
      {!selectedField && (
        <CheckoutDialogOverlay
          visible={checkoutModalVisible}
          onClose={() => setCheckoutModalVisible(false)}
          selectedProduct={selectedProduct}
          selectedField={selectedField}
          orderProcessing={orderProcessing}
          confirmOrder={confirmOrder}
          colors={colors}
          isDarkMode={isDarkMode}
          language={language}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.paper,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e6e3d8',
    backgroundColor: '#f4f2ec',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.forest900,
  },
  cursor: {
    fontSize: 17,
    fontWeight: '500',
    color: COLORS.forest500,
    marginLeft: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationBtn: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e6e3d8',
  },
  notificationBadge: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e05c5c',
  },
  profileBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: COLORS.forest600,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
  },
  profilePic: {
    width: '100%',
    height: '100%',
    borderRadius: 19,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
  },
  mainScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 120,
    alignItems: 'flex-start',
  },
  avatarGreetingContainer: {
    width: '100%',
    height: 95, // 30-40% smaller container height (was ~152px)
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingRight: 16,
    paddingLeft: 0,
    marginBottom: 20,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible', // Allows mascot to overflow container border
    zIndex: 1, // Card base level
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  avatarGreetingMascot: {
    width: 75,
    height: 110, // Image size remains almost similar to before (was 120)
    alignSelf: 'flex-end', // Aligns peeking character at the bottom
    zIndex: 2, // Sits above the card border
  },
  avatarGreetingTextContainer: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: 'center',
  },
  avatarGreetingTitle: {
    fontSize: 15, // Adjusted to fit smaller container
    fontWeight: '700',
    color: COLORS.forest900,
    marginBottom: 2,
  },
  avatarGreetingSubtitle: {
    fontSize: 11.5, // Adjusted to fit smaller container
    fontWeight: '500',
    color: COLORS.inkSoft,
    lineHeight: 16,
  },
  statsCardBlock: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 14,
    marginTop: 18, // Added margin top to separate from Shortcuts
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statsCardTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.forest900,
    marginBottom: 10,
  },
  bentoContainer: {
    width: '100%',
    gap: 8,
  },
  bentoCardWide: {
    width: '100%',
    height: 60, // 30-40% smaller layout height
    borderRadius: 14,
    padding: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bentoIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  bentoWideTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  bentoWideValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.forest900,
  },
  bentoWideLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.inkSoft,
    marginTop: 1,
  },
  bentoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  bentoCardTall: {
    width: '49%',
    height: 115, // Compact tall card height
    borderRadius: 14,
    padding: 10,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  bentoTallValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.forest900,
  },
  bentoTallLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.inkSoft,
  },
  bentoTallSub: {
    fontSize: 9.5,
    fontWeight: '600',
    color: COLORS.forest500,
    marginTop: 1,
  },
  bentoColRight: {
    width: '49%',
    height: 115,
    justifyContent: 'space-between',
  },
  bentoCardMini: {
    height: 54, // Stacked mini cards height
    borderRadius: 14,
    padding: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bentoIconCircleMini: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  bentoMiniTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  bentoMiniValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.forest900,
  },
  bentoMiniLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: COLORS.inkSoft,
  },
  bentoUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.inkSoft,
  },
  weatherBlock: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 12,
    marginTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  weatherBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  weatherBlockIcon: {
    fontSize: 32,
    marginRight: 10,
  },
  weatherBlockTempCol: {
    flex: 1,
  },
  weatherBlockTemp: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.forest800,
    letterSpacing: -0.5,
  },
  weatherBlockCondition: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.forest500,
    marginTop: 2,
  },
  weatherBlockMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  weatherMetricCard: {
    flex: 1,
    backgroundColor: '#f2f6ee', // Soft greenish brand background
    borderRadius: 16,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderBottomWidth: 3, // 3D bottom edge
    borderColor: '#cbdcc3', // Soft green border
    marginHorizontal: 3,
    gap: 4,
  },
  weatherMetricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.forest900,
  },
  weatherMetricLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.forest600,
  },
  shortcutsBlock: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 12,
    marginTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  shortcutsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.forest800,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  shortcutsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  shortcutItem: {
    flex: 1,
    alignItems: 'center',
  },
  shortcutIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  shortcutLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3d4a3e',
    textAlign: 'center',
    lineHeight: 13,
    paddingHorizontal: 4,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { fontSize: 26 },
  brandName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.forest900,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  addBtnIcon: { fontSize: 22, color: COLORS.forest800, fontWeight: '600' },
  greetingBlock: { marginBottom: 18 },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.forest900,
    marginBottom: 6,
  },
  subtext: { fontSize: 14.5, color: COLORS.inkSoft },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingBottom: 110,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  cropBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  infoCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 100,
  },
  emptyCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.03,
    shadowRadius: 20,
    elevation: 4,
  },
  emptyIcon: {
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 28,
  },
  emptyButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // â”€â”€ Modal Details Screen Styles â”€â”€
  modalSafeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 16) : 6,
  },
  modalHeader: {
    height: 54,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    marginTop: 4,
  },
  closeBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  modalScroll: {
    padding: 20,
    paddingBottom: 50,
    gap: 20,
  },
  visualizerCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  cardTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  cropLabelHeading: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 4,
  },
  cropStatusDesc: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 16,
  },
  detailBlockCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  bigStatVal: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 10,
  },
  bigStatUnit: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  microConvertedText: {
    fontSize: 11,
    color: '#8C9A8D',
    marginTop: 4,
  },
  fieldDetailsSection: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  detailRowText: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailVal: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },

  // â”€â”€ Isometric CSS â”€â”€
  isoContainer: {
    width: '100%',
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 10,
  },
  skyDomeCard: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  hudCard: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(23, 20, 36, 0.65)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  hudVal: {
    fontSize: 9,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 0.5,
  },
  scannerBadge: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E5FF',
  },
  scannerText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  miniMapContainer: {
    width: 160,
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageHeadingText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  stageSubText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  timelineRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    position: 'relative',
    paddingVertical: 10,
    width: '100%',
    marginBottom: 20,
  },
  timelineTrackContainer: {
    position: 'relative',
    width: '100%',
    height: 90,
    justifyContent: 'center',
    marginBottom: 16,
  },
  timelineTrackLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 2,
    top: 11,
  },
  timelineNodesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  tinderDeleteBtn: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Advanced Masterclass Section
  masterclassSection: {
    marginTop: 18,
    marginBottom: 24,
  },
  masterclassSectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  masterclassSectionTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  // Visual Masterclass Showcase Styles
  masterclassHeroCard: {
    width: SW * 0.78,
    height: 200,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  masterclassHeroImgBg: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  masterclassHeroGradient: {
    flex: 1,
    borderRadius: 22,
    padding: 16,
    justifyContent: 'space-between',
  },
  masterclassHeroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  glassCategoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  glassCategoryText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  heroBadgeChip: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  heroBadgeChipText: {
    color: '#78350f',
    fontSize: 10,
    fontWeight: '900',
  },
  masterclassHeroTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  masterclassHeroSummary: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 10,
  },
  masterclassHeroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  masterclassHeroActionText: {
    color: '#81c784',
    fontSize: 12,
    fontWeight: '800',
  },
  // Bento Grid Styles
  bentoHeroCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  bentoIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bentoTitleText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  bentoSubCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  bentoIconBoxSmall: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bentoTitleTextSmall: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  masterclassCard: {
    width: 265,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  masterclassBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  masterclassBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  masterclassBenefitChip: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  masterclassBenefitText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#d97706',
  },
  masterclassCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  masterclassCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  masterclassReadBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  masterclassModalBox: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    maxHeight: '85%',
  },
  masterclassModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  masterclassModalTitle: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 6,
  },
  modalCloseIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  masterclassHighlightBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3c7',
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  masterclassHighlightText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b45309',
  },
  masterclassSectionBlock: {
    marginBottom: 14,
  },
  masterclassBlockHeading: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  masterclassBlockBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  masterclassStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 6,
  },
  masterclassStepNumberCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  masterclassStepNumberText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '900',
  },
  masterclassStepText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  masterclassAskAiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 14,
  },
  masterclassAskAiText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  timelineNode: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 68,
  },
  nodeCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  activeCircleIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeNodeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nodeNameLabel: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 12,
  },
  nodeRangeLabel: {
    fontSize: 7.5,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  recommendationsBlock: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginTop: 8,
  },
  recHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  recHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  recItemsList: {
    gap: 10,
  },
  recItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  recItemText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  statsGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 14,
    gap: 8,
  },
  statGridCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  statGridLabel: {
    fontSize: 8,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  statGridVal: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
  },
  weatherSummaryBanner: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    width: '100%',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  alertBanner: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    width: '100%',
    marginBottom: 12,
  },
  alertTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  alertDesc: {
    fontSize: 11,
    lineHeight: 15.5,
    marginTop: 3,
    fontWeight: '500',
  },
  heroDashboardCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    width: '100%',
    marginVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  heroWeatherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weatherPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  heroLocationText: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
  },
  heroWeatherDetails: {
    fontSize: 10.5,
    marginTop: 2,
    fontWeight: '500',
  },
  heroWeatherTemp: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroDivider: {
    height: 1,
    width: '100%',
    marginVertical: 14,
    opacity: 0.5,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
  },
  heroStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  heroStatVal: {
    fontSize: 16.5,
    fontWeight: '900',
  },
  heroStatLabel: {
    fontSize: 8,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.4,
  },
  heroStatDivider: {
    width: 1,
    height: 24,
    opacity: 0.3,
  },
  soilHealthSummaryCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    width: '100%',
    marginBottom: 12,
  },
  soilHealthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  soilHealthTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  soilHealthPercent: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  soilHealthBarBg: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  soilHealthBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  soilHealthStatusLabel: {
    fontSize: 10.5,
    lineHeight: 14.5,
    marginTop: 8,
    fontWeight: '500',
  },
  advisoryIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropTypeBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  cardDivider: {
    height: 1,
    width: '100%',
    marginVertical: 12,
    opacity: 0.3,
  },
  heroGreetingSub: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
    marginTop: 4,
  },
  heroGreetingTitle: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '800',
    marginTop: 10,
    lineHeight: 28,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  appHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  appHeaderTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  floatingAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  greetingContainer: {
    paddingHorizontal: 24,
    marginTop: 12,
    marginBottom: 8,
  },
  serifGreeting: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroOverlayContainer: {
    padding: 20,
    flex: 1,
    justifyContent: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 24,
  },
  heroStatsOverlay: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  overlayItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlayLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9E9E9E',
  },
  overlayVal: {
    fontSize: 13.5,
    fontWeight: '800',
    marginTop: 1,
  },
  overlaySub: {
    fontSize: 7.5,
    color: '#BDBDBD',
    marginTop: 1,
  },
  overlayDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#EEEEEE',
    marginHorizontal: 4,
    alignSelf: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 14,
    marginBottom: 12,
  },
  weatherWidgetCard: {
    flex: 1,
    height: 180,
    borderRadius: 24,
    overflow: 'hidden',
  },
  weatherOverlay: {
    padding: 14,
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    justifyContent: 'space-between',
  },
  weatherCardTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  weatherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weatherTempRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  weatherTempText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 34,
  },
  weatherUnitText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  weatherConditionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  weatherFeelsLike: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 2,
  },
  weatherMetricsGrid: {
    flexDirection: 'row',
    marginTop: 8,
  },
  metricLabel: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 8,
    fontWeight: '700',
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
    marginTop: 1,
  },
  weatherLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  weatherLocationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    flex: 1,
  },
  advisoryWidgetCard: {
    flex: 1,
    height: 180,
    borderRadius: 24,
    borderLeftWidth: 4,
    borderWidth: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  advisoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  advisoryTitle: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  advisoryBody: {
    fontSize: 11,
    lineHeight: 15.5,
    fontWeight: '600',
  },
  advisoryLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  advisoryLinkText: {
    color: '#E2725B',
    fontSize: 11,
    fontWeight: '800',
  },
  fieldListItemCard: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.01,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  fieldCardImage: {
    width: 52,
    height: 52,
    borderRadius: 12,
  },
  fieldCardContent: {
    flex: 1.2,
    marginLeft: 12,
  },
  fieldCardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  fieldLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  fieldLocationText: {
    fontSize: 11,
    fontWeight: '600',
  },
  fieldAreaText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  fieldBadgeAndProgressRow: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 6,
  },
  fieldStatusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  fieldStatusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  fieldSoilHealthColumn: {
    alignItems: 'flex-end',
  },
  fieldSoilLabel: {
    fontSize: 8,
    color: '#A0A0A0',
    fontWeight: '800',
  },
  fieldSoilValue: {
    fontSize: 11,
    fontWeight: '800',
  },
  smallCircleOutline: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallCircleDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  fieldCardChevron: {
    marginLeft: 8,
  },
  heroCard: {
    borderRadius: 24,
    padding: 22,
    marginBottom: 18,
  },
  proPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 16,
  },
  proPillText: { color: '#eef3e9', fontSize: 11.5, fontWeight: '700', letterSpacing: 0.5 },
  heroHeading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fbfaf5',
    marginBottom: 8,
    lineHeight: 32,
  },
  heroSub: { color: '#cddac6', fontSize: 14, marginBottom: 20 },

  statStrip: {
    backgroundColor: '#fdfcf9',
    borderRadius: 18,
    paddingVertical: 18,
    flexDirection: 'row',
  },
  statItem: { flex: 1, paddingHorizontal: 10, gap: 5 },
  statItemBorder: { borderLeftWidth: 1, borderLeftColor: COLORS.line },
  statIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.goodBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statIconEmoji: { fontSize: 15 },
  statLabel: { fontSize: 11.5, color: COLORS.inkFaint, fontWeight: '500' },
  statValue: { fontSize: 20, fontWeight: '700', color: COLORS.ink },
  statUnit: { fontSize: 12, fontWeight: '500', color: COLORS.inkFaint },
  statFoot: { fontSize: 11, color: COLORS.inkFaint },
  deltaPill: {
    backgroundColor: COLORS.goodBg,
    borderRadius: 999,
    paddingHorizontal: 6,
    marginLeft: 4,
  },
  deltaText: { fontSize: 10.5, fontWeight: '700', color: COLORS.forest500 },

  // Weather / Advisory
  duoRow: { flexDirection: 'row', gap: 12, marginBottom: 22 },
  weatherCard: {
    flex: 1,
    borderRadius: 20,
    padding: 18,
    minHeight: 290,
  },
  weatherHead: { color: '#fff', fontSize: 13.5, fontWeight: '600', marginBottom: 16 },
  weatherTemp: { color: '#fff', fontSize: 44, fontWeight: '700', marginBottom: 10 },
  weatherMetricsRow: { marginBottom: 4 },
  wmetricLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11.5, marginBottom: 2 },
  wmetricValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  weatherCond: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  weatherFeel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginBottom: 12 },
  weatherFoot: { color: 'rgba(255,255,255,0.92)', fontSize: 12.5, fontWeight: '500' },

  farmsSection: {
    width: '100%',
    marginTop: 18,
    marginBottom: 20,
  },
  farmsSectionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.forest900,
    marginBottom: 12,
  },
  tinderDeckWrapper: {
    width: '100%',
    height: 340,
    position: 'relative',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 10,
  },
  tinderCard: {
    position: 'absolute',
    width: '100%',
    height: 320,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.line,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  tinderCardBack: {
    top: 8,
    transform: [{ scale: 0.95 }],
    zIndex: 0,
  },
  tinderCardInner: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  tinderCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tinderCropIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tinderCropEmoji: {
    fontSize: 22,
  },
  tinderCardTitleCol: {
    flex: 1,
    marginLeft: 12,
  },
  tinderCardName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.forest900,
  },
  tinderLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 2,
  },
  tinderLocationText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.inkSoft,
  },
  tinderHealthSection: {
    marginVertical: 12,
  },
  tinderHealthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tinderScoreCol: {
    flex: 1,
  },
  tinderScoreNumber: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  tinderScoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.inkSoft,
    marginTop: 2,
  },
  tinderRingWrapper: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tinderDivider: {
    height: 1,
    backgroundColor: COLORS.line,
    marginVertical: 4,
  },
  tinderDetailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  tinderDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '48%',
  },
  tinderDetailTextCol: {
    justifyContent: 'center',
  },
  tinderDetailVal: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.forest900,
  },
  tinderDetailLabel: {
    fontSize: 10.5,
    color: COLORS.inkFaint,
    fontWeight: '500',
  },
  tinderDetailsBtn: {
    width: '100%',
    height: 44,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  tinderDetailsBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // AI Advisory Section
  advisorySection: {
    width: '100%',
    marginTop: -10,
    marginBottom: 20,
  },
  advisorySectionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.forest900,
    marginBottom: 0,
  },
  advisoryCardWrapper: {
    position: 'relative',
    width: '100%',
    paddingTop: 50,
  },
  advisoryMascot: {
    position: 'absolute',
    top: -10,
    right: 8,
    width: 100,
    height: 100,
    zIndex: 10,
  },
  advisoryCard: {
    width: '100%',
    backgroundColor: '#f0f7f0',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d4e8d4',
    padding: 18,
    paddingTop: 20,
  },
  advisoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.forest700,
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  advisoryBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  advisoryCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.forest900,
    marginBottom: 6,
  },
  advisoryCardBody: {
    fontSize: 12.5,
    fontWeight: '500',
    color: COLORS.inkSoft,
    lineHeight: 18,
    marginBottom: 14,
  },
  advisoryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  advisoryActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.forest700,
  },

  // Custom Alert Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  customAlertContainer: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  alertIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fdebeb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  customAlertTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.forest900,
    marginBottom: 8,
    textAlign: 'center',
  },
  customAlertBody: {
    fontSize: 13,
    color: COLORS.inkSoft,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  alertButtonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  alertCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  alertCancelText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.inkSoft,
  },
  alertDeleteBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.clay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertDeleteText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#fff',
  },
});

export default FarmsScreen;
