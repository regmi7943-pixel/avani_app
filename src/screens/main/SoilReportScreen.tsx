import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Share,
  Alert,
  Animated,
  Image,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../lib/ThemeContext';
import { useLanguage } from '../../lib/LanguageContext';
import { useCart } from '../../lib/CartContext';
import { supabase } from '../../lib/supabase';
import { 
  fetchLiveSoilTelemetry, 
  getCachedSoilTelemetry, 
  RealSoilTelemetry 
} from '../../services/soilApiService';
import { 
  calculateCropGrowthStage, 
  generateAdvancedPrescriptions, 
  CropGrowthStage 
} from '../../services/agronomicEngine';
import { generateAndShareSoilPdf } from '../../services/soilPdfGenerator';

const { width: SW } = Dimensions.get('window');

// Marketplace Background Images
const BG_SEED = require('../../../assets/images/card_bg_seed.jpg');
const BG_FERTILIZER = require('../../../assets/images/card_bg_fertilizer.jpg');
const BG_PESTICIDES = require('../../../assets/images/card_bg_pesticides.jpg');
const BG_VITAMINS = require('../../../assets/images/card_bg_vitamins.jpg');
const BG_TOOLS = require('../../../assets/images/card_bg_tools.jpg');

const getCategoryBg = (category: string) => {
  const cat = (category || '').toUpperCase();
  if (cat.includes('SEED')) return BG_SEED;
  if (cat.includes('FERTILIZER') || cat.includes('SOIL')) return BG_FERTILIZER;
  if (cat.includes('PESTICIDE') || cat.includes('CROP')) return BG_PESTICIDES;
  if (cat.includes('VITAMIN') || cat.includes('MICRONUTRIENT')) return BG_VITAMINS;
  if (cat.includes('TOOL')) return BG_TOOLS;
  return BG_FERTILIZER;
};

interface Field {
  id: string;
  name: string;
  area: number;
  area_unit: string;
  crop_type: string;
  soil_type: string | null;
  status: string | null;
  health_score: number | null;
  planting_date: string | null;
  location_name: string | null;
}

const DEFAULT_FIELDS: Field[] = [
  {
    id: 'f-1',
    name: 'Rice feild',
    area: 4.19,
    area_unit: 'Kattha',
    crop_type: 'Rice',
    soil_type: 'Clay Loam',
    status: 'active',
    health_score: 95,
    planting_date: '2026-06-15',
    location_name: 'माडी, बागमती प्रदेश',
  },
  {
    id: 'f-2',
    name: 'कल्यानपुर Field',
    area: 5.85,
    area_unit: 'Kattha',
    crop_type: 'Rice',
    soil_type: 'Clay Loam',
    status: 'active',
    health_score: 95,
    planting_date: '2026-06-20',
    location_name: 'कल्यानपुर, बागमती प्रदेश',
  },
  {
    id: 'f-3',
    name: 'भरतपुर Field',
    area: 3.8,
    area_unit: 'Kattha',
    crop_type: 'Rice',
    soil_type: 'Sandy Loam',
    status: 'active',
    health_score: 77,
    planting_date: '2026-06-10',
    location_name: 'भरतपुर, बागमती प्रदेश',
  },
  {
    id: 'f-4',
    name: 'Madi Field',
    area: 6.91,
    area_unit: 'Kattha',
    crop_type: 'Maize',
    soil_type: 'Sandy Loam',
    status: 'active',
    health_score: 79,
    planting_date: '2026-04-12',
    location_name: 'Madi, Bagamati Province',
  },
  {
    id: 'f-5',
    name: 'Bharatpur Field 2',
    area: 12.54,
    area_unit: 'Kattha',
    crop_type: 'Maize',
    soil_type: 'Sandy Loam',
    status: 'active',
    health_score: 40,
    planting_date: '2026-04-15',
    location_name: 'Bharatpur, Bagamati Province',
  }
];

// Minimal Animated Skeleton Loader
function SoilReportSkeletonLoader({ isDarkMode }: { isDarkMode: boolean }) {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const skBg = isDarkMode ? '#1a2e21' : '#e2eae4';

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[1, 2, 3].map((i) => (
          <Animated.View key={i} style={[styles.skeletonBox, { width: 110, height: 38, borderRadius: 18, backgroundColor: skBg, opacity: pulseAnim }]} />
        ))}
      </View>

      <Animated.View style={[styles.skeletonBox, { height: 110, borderRadius: 18, backgroundColor: skBg, opacity: pulseAnim }]} />
      {[1, 2, 3].map((i) => (
        <Animated.View key={i} style={[styles.skeletonBox, { height: 100, borderRadius: 16, backgroundColor: skBg, opacity: pulseAnim }]} />
      ))}
    </View>
  );
}

export default function SoilReportScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDarkMode } = useTheme();
  const { language } = useLanguage();
  const { addToCart } = useCart();
  const isNe = language === 'ne';

  const [fields, setFields] = useState<Field[]>(DEFAULT_FIELDS);
  const [selectedField, setSelectedField] = useState<Field>(DEFAULT_FIELDS[0]);
  const [telemetry, setTelemetry] = useState<RealSoilTelemetry | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshingLive, setRefreshingLive] = useState(false);
  const [addingProduct, setAddingProduct] = useState<string | null>(null);

  // Load Initial Fields & Pre-Cached Telemetry
  useEffect(() => {
    async function init() {
      const initialCache = getCachedSoilTelemetry(DEFAULT_FIELDS[0].location_name);
      if (initialCache) {
        setTelemetry(initialCache);
      } else {
        setLoading(true);
        const fetched = await fetchLiveSoilTelemetry(DEFAULT_FIELDS[0].location_name, false);
        setTelemetry(fetched);
        setLoading(false);
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data } = await supabase
            .from('fields')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });

          if (data && data.length > 0) {
            setFields(data);
            setSelectedField(data[0]);
            loadTelemetry(data[0], false);
            return;
          }
        }
        const { data } = await supabase.from('fields').select('*').limit(10);
        if (data && data.length > 0) {
          setFields(data);
          setSelectedField(data[0]);
          loadTelemetry(data[0], false);
        }
      } catch (e) {
        console.warn('Field load error:', e);
      }
    }
    init();
  }, []);

  const loadTelemetry = async (field: Field, forceRefresh: boolean = false) => {
    if (forceRefresh) {
      setRefreshingLive(true);
    } else {
      const cached = getCachedSoilTelemetry(field.location_name);
      if (cached) {
        setTelemetry(cached);
        return;
      }
      setLoading(true);
    }

    try {
      const liveData = await fetchLiveSoilTelemetry(field.location_name, forceRefresh);
      setTelemetry(liveData);
    } catch (e) {
      console.warn('Telemetry error:', e);
    } finally {
      setLoading(false);
      setRefreshingLive(false);
    }
  };

  const handleSelectField = (field: Field) => {
    setSelectedField(field);
    loadTelemetry(field, false);
  };

  const areaKattha = Number(selectedField?.area || 4);
  const areaUnit = selectedField?.area_unit || 'Kattha';
  const crop = selectedField?.crop_type || 'Rice';
  const soilType = selectedField?.soil_type || 'Clay Loam';
  const plantingDate = selectedField?.planting_date || '2026-06-15';

  // Calculate Advanced Phenological Growth Stage Window
  const growthStage: CropGrowthStage = calculateCropGrowthStage(crop, plantingDate);

  // Dynamic Metrics per selected field
  const ph = telemetry?.ph ?? (soilType === 'Sandy Loam' ? 5.6 : 6.4);
  const socPct = telemetry?.socPct ?? 1.85;
  const socStockMgHa = telemetry?.socStockMgHa ?? 48.5;
  const clayPct = telemetry?.clayPct ?? 32;
  const sandPct = telemetry?.sandPct ?? 38;
  const siltPct = telemetry?.siltPct ?? 30;
  const cecMmolKg = telemetry?.cecMmolKg ?? 18.5;
  const bulkDensity = telemetry?.bulkDensity ?? 1.28;
  const surfaceMoisture = telemetry?.surfaceMoisture ?? 34;
  const subsurfaceMoisture = telemetry?.subsurfaceMoisture ?? 40;
  const soilTemperature = telemetry?.soilTemperature ?? 26.2;
  const isAcidic = ph < 5.8;

  // DYNAMIC FIELD SOIL HEALTH SCORE (Unique per database field!)
  const healthScore = selectedField?.health_score || (soilType === 'Clay Loam' ? 95 : (isAcidic ? 77 : 86));

  // GENERATE ADVANCED STAGE-AWARE PRESCRIPTIONS
  const prescriptions = generateAdvancedPrescriptions(
    crop,
    plantingDate,
    areaKattha,
    areaUnit,
    ph,
    socPct,
    clayPct,
    cecMmolKg
  );

  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handleShare = async () => {
    if (generatingPdf) return;
    setGeneratingPdf(true);
    try {
      await generateAndShareSoilPdf({
        fieldName: selectedField.name,
        areaKattha,
        areaUnit,
        cropType: crop,
        soilType,
        healthScore,
        telemetry,
        growthStage,
        prescriptions,
        isNe,
      });
    } catch (e: any) {
      console.warn('PDF export error:', e);
      await Share.share({
        title: `Soil Telemetry - ${selectedField.name}`,
        message: `Anavi Soil Report: ${selectedField.name}\nStage: ${growthStage.stageName} (Day ${growthStage.das})\npH: ${ph} (${isAcidic ? 'Acidic' : 'Optimal'})\nSoil Index: ${healthScore}%\nLocation: ${telemetry?.latitude}° N, ${telemetry?.longitude}° E`,
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleAddToCart = (item: any) => {
    const prodTitle = isNe ? item.productNameNe : item.productName;
    setAddingProduct(prodTitle);
    addToCart({
      id: `soil-rec-${Math.random()}`,
      title: prodTitle,
      category: item.category,
      price: item.price,
      dosage: item.totalDosage,
      emoji: item.emoji,
      description: isNe ? item.agronomicReasonNe : item.agronomicReason,
    });

    setTimeout(() => {
      setAddingProduct(null);
      Alert.alert(
        isNe ? 'अर्डर थपियो!' : 'Order Placed!',
        `${prodTitle} (${item.totalDosage})`,
        [{ text: 'OK' }]
      );
    }, 300);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isNe ? 'माटो र बाली विश्लेषण' : 'Soil & Crop Telemetry'}
          </Text>
          <Text style={{ fontSize: 11, color: colors.brandGreen, fontWeight: '700' }}>
            {selectedField.name} • {areaKattha} {areaUnit}
          </Text>
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={generatingPdf} activeOpacity={0.7}>
          {generatingPdf ? (
            <ActivityIndicator size="small" color={colors.brandGreen} />
          ) : (
            <Ionicons name="share-social-outline" size={20} color={colors.brandGreen} />
          )}
        </TouchableOpacity>
      </View>

      {loading || refreshingLive ? (
        <SoilReportSkeletonLoader isDarkMode={isDarkMode} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Field Selection Selector */}
          {fields.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {fields.map((f) => {
                  const isSelected = selectedField?.id === f.id;
                  const cropIcon = f.crop_type?.toLowerCase().includes('maize') ? '🌽' : '🌾';
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[
                        styles.fieldPill,
                        {
                          backgroundColor: isSelected ? colors.brandGreen : colors.card,
                          borderColor: isSelected ? colors.brandGreen : colors.border
                        }
                      ]}
                      activeOpacity={0.8}
                      onPress={() => handleSelectField(f)}
                    >
                      <Text style={{ fontSize: 13 }}>{cropIcon}</Text>
                      <Text style={[styles.fieldPillText, { color: isSelected ? '#fff' : colors.text }]}>
                        {f.name} ({f.area} {f.area_unit || 'Kattha'})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* Compact Minimal Provenance Bar */}
          <View style={[styles.compactBar, { backgroundColor: isDarkMode ? '#1a2e21' : '#eaf6f0', borderColor: isDarkMode ? '#284632' : '#cce8d7' }]}>
            <Ionicons name="location-outline" size={16} color={colors.brandGreen} />
            <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: colors.brandGreen }} numberOfLines={1}>
              {telemetry?.latitude}° N, {telemetry?.longitude}° E • {telemetry?.fetchedAt}
            </Text>

            <TouchableOpacity 
              onPress={() => loadTelemetry(selectedField, true)} 
              style={styles.refreshIconBtn} 
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={14} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* SLEEK MINIMAL HERO MASTER CARD */}
          <View style={[styles.heroCard, { backgroundColor: isDarkMode ? '#1a3322' : '#eaf6ef', borderColor: colors.brandGreen }]}>
            <View style={styles.heroBody}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroCropTitle, { color: colors.text }]}>
                  {selectedField.name}
                </Text>
                <Text style={{ fontSize: 12, color: colors.secondaryText, marginTop: 2 }}>
                  {crop} ({areaKattha} {areaUnit}) • {soilType}
                </Text>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.brandGreen }}>
                    🌱 Day {growthStage.das} DAP
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.secondaryText }}>• {growthStage.stageCode}</Text>
                </View>
              </View>

              {/* Dynamic Soil Index Ring */}
              <View style={[styles.heroYieldBox, { borderColor: healthScore >= 80 ? '#81c784' : (healthScore >= 60 ? '#f59e0b' : '#ef4444') }]}>
                <Text style={[styles.heroYieldNum, { color: healthScore >= 80 ? colors.brandGreen : (healthScore >= 60 ? '#f59e0b' : '#ef4444') }]}>
                  {healthScore}%
                </Text>
                <Text style={{ fontSize: 9, fontWeight: '700', color: colors.secondaryText, textTransform: 'uppercase' }}>
                  Index
                </Text>
              </View>
            </View>

            {/* Minimal Cycle Progress Bar */}
            <View style={[styles.barTrack, { marginTop: 12 }]}>
              <View style={[styles.barFill, { width: `${growthStage.progressPct}%`, backgroundColor: colors.brandGreen }]} />
            </View>
          </View>

          {/* Dashboard Telemetry Cards */}
          <View style={{ gap: 14 }}>
            {/* 1. Moisture & Water Depth Profile */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardHeaderTitle, { color: colors.text, marginBottom: 10 }]}>
                💧 {isNe ? 'जरा क्षेत्रको ओसिलोपन' : 'Soil Moisture Depth Profile'}
              </Text>

              <View style={{ gap: 10 }}>
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: colors.secondaryText }}>Surface (0-5cm)</Text>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#2563eb' }}>{surfaceMoisture}%</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${surfaceMoisture}%`, backgroundColor: '#3b82f6' }]} />
                  </View>
                </View>

                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: colors.secondaryText }}>Subsoil (5-15cm)</Text>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#1d4ed8' }}>{subsurfaceMoisture}%</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${subsurfaceMoisture}%`, backgroundColor: '#1d4ed8' }]} />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ fontSize: 12, color: colors.secondaryText }}>Root Zone Temp</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#d97706' }}>{soilTemperature}°C</Text>
                </View>
              </View>
            </View>

            {/* 2. Visual Particle Composition Badges */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardHeaderTitle, { color: colors.text, marginBottom: 10 }]}>
                🪨 {isNe ? 'माटोको बनौट' : 'Soil Particle Composition'}
              </Text>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={[styles.textureBadge, { backgroundColor: '#eaf6f0', borderColor: '#bce4d0' }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#2d7a50' }}>Sand</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: '#2d7a50' }}>{sandPct}%</Text>
                </View>

                <View style={[styles.textureBadge, { backgroundColor: '#e1f0fa', borderColor: '#bde0f5' }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#2d7bb6' }}>Silt</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: '#2d7bb6' }}>{siltPct}%</Text>
                </View>

                <View style={[styles.textureBadge, { backgroundColor: '#fbeed9', borderColor: '#f7d8a9' }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#c47d18' }}>Clay</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: '#c47d18' }}>{clayPct}%</Text>
                </View>
              </View>
            </View>

            {/* 3. Soil pH Meter */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardHeaderTitle, { color: colors.text }]}>🧪 Soil pH Scale</Text>
                <View style={[styles.statusTag, { backgroundColor: isAcidic ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)' }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isAcidic ? '#ef4444' : '#16a34a' }}>
                    {isAcidic ? 'Acidic' : 'Optimal'}
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 32, fontWeight: '900', color: colors.text, marginVertical: 6 }}>
                {ph} <Text style={{ fontSize: 14, fontWeight: '600', color: colors.secondaryText }}>pH</Text>
              </Text>

              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(ph / 14) * 100}%`, backgroundColor: isAcidic ? '#ef4444' : '#16a34a' }]} />
              </View>
            </View>

            {/* 4. Chemical & CEC Grid */}
            <View style={styles.metricGrid}>
              <View style={[styles.metricTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={{ fontSize: 11, color: colors.secondaryText }}>CEC Capacity</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 2 }}>{cecMmolKg} mmol/kg</Text>
              </View>

              <View style={[styles.metricTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={{ fontSize: 11, color: colors.secondaryText }}>SOC Carbon</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#16a34a', marginTop: 2 }}>{socPct}%</Text>
              </View>

              <View style={[styles.metricTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={{ fontSize: 11, color: colors.secondaryText }}>Bulk Density</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 2 }}>{bulkDensity} g/cm³</Text>
              </View>

              <View style={[styles.metricTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={{ fontSize: 11, color: colors.secondaryText }}>Carbon Stock</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.brandGreen, marginTop: 2 }}>{socStockMgHa} Mg C/ha</Text>
              </View>
            </View>

            {/* 5. STAGE-AWARE ADVANCED MARKETPLACE PRODUCT CARDS */}
            <View style={{ marginTop: 6, gap: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: isDarkMode ? colors.text : '#1b3823', letterSpacing: -0.2 }}>
                {isNe ? 'सिफारिस गरिएका सामग्रीहरू' : 'Stage-Window Prescriptions'}
              </Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16, gap: 12 }}>
                {prescriptions.map((item) => {
                  const prodTitle = isNe ? item.productNameNe : item.productName;
                  const windowText = isNe ? item.growthStageWindowNe : item.growthStageWindow;
                  const dosageText = isNe ? item.totalDosageNe : item.totalDosage;

                  return (
                    <View key={item.id} style={styles.marketplaceCardWrapper}>
                      <Image 
                        source={getCategoryBg(item.category)} 
                        style={styles.featuredCardBgImage}
                        resizeMode="cover"
                        fadeDuration={0}
                      />
                      <LinearGradient
                        colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.92)']}
                        style={styles.featuredCardOverlay}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={styles.categoryPillGlass}>
                            <Text style={styles.categoryPillText}>{item.category}</Text>
                          </View>
                          <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
                        </View>

                        <Text style={styles.featuredCardTitle} numberOfLines={2}>
                          {prodTitle}
                        </Text>

                        <View style={{ marginTop: 'auto' }}>
                          <Text style={{ color: '#fde047', fontSize: 10, fontWeight: '800', marginBottom: 2 }} numberOfLines={1}>
                            ⏱️ {windowText}
                          </Text>
                          <Text style={{ color: '#a7f3d0', fontSize: 11, fontWeight: '700', marginBottom: 2 }}>
                            Dosage: {dosageText}
                          </Text>
                          <Text style={{ color: '#81c784', fontSize: 14.5, fontWeight: '900', marginBottom: 6 }}>
                            {item.price}
                          </Text>

                          <TouchableOpacity 
                            onPress={() => handleAddToCart(item)}
                            style={[styles.buyBtnGlassRight, { backgroundColor: colors.brandGreen }]}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="cart" size={14} color="#fff" />
                            <Text style={styles.buyBtnGlassText}>
                              {isNe ? 'अर्डर गर्नुहोस्' : 'Buy Now'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </LinearGradient>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  fieldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  fieldPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  compactBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  refreshIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2e7d32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  stageTag: {
    backgroundColor: '#2e7d32',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  stageTagText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '800',
  },
  heroCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
  },
  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroCropTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  heroYieldBox: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroYieldNum: {
    fontSize: 18,
    fontWeight: '900',
  },
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  textureBadge: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricTile: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e0ece3',
    overflow: 'hidden',
    marginTop: 4,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },

  /* EXACT MARKETPLACE PRODUCT CARD STYLES */
  marketplaceCardWrapper: {
    width: 215,
    height: 255,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
  },
  featuredCardBgImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  featuredCardOverlay: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  categoryPillGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  categoryPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  featuredCardTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 19,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginTop: 6,
  },
  buyBtnGlassRight: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  buyBtnGlassText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '800',
  },
  skeletonBox: {
    width: '100%',
  },
});
