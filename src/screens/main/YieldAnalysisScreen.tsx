import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../lib/ThemeContext';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';

const { width: SW } = Dimensions.get('window');

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

export default function YieldAnalysisScreen() {
  const navigation = useNavigation();
  const { colors, isDarkMode } = useTheme();
  const { language } = useLanguage();

  const [fields, setFields] = useState<Field[]>([]);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFields();
  }, []);

  const fetchFields = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data, error } = await supabase
        .from('fields')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data && data.length > 0) {
        setFields(data);
        setSelectedField(data[0]);
      }
    } catch (e: any) {
      console.warn('Error loading fields for yield analysis:', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // YIELD MODEL — Nepal MoALD + NARC Statistics (Top 5 Crops)
  // ──────────────────────────────────────────────────────────────
  // Conversion: 1 hectare = 29.585 Kattha (Nepal Terai standard)
  // Q/Kattha = (Yield in t/ha × 10) ÷ 29.585
  //
  // ┌──────────┬──────────┬──────────┬─────────────────────────────┐
  // │ Crop     │ t/ha     │ Q/Kattha │ Optimal Nepal Window        │
  // ├──────────┼──────────┼──────────┼─────────────────────────────┤
  // │ Rice     │ 3.76     │ 1.27     │ Jun–Jul (Monsoon)           │
  // │ Maize    │ 2.80     │ 0.95     │ Mar–May (Spring/Summer)     │
  // │ Wheat    │ 2.60     │ 0.88     │ Mid Nov (Winter)            │
  // │ Potato   │ 17.50    │ 5.91     │ Oct–Nov (Winter)            │
  // │ Mustard  │ 1.10     │ 0.37     │ Oct–Nov (Autumn)            │
  // └──────────┴──────────┴──────────┴─────────────────────────────┘
  // ──────────────────────────────────────────────────────────────

  interface CropProfile {
    key: string;
    baseQPerKattha: number;   // National avg Q/Kattha
    tPerHa: number;           // National avg tonnes/hectare
    bestPracticeMult: number; // Best practice multiplier
    bestPracticeLabel: string;
    season: string;
    nepaliName: string;
  }

  const CROP_DB: Record<string, CropProfile> = {
    rice:    { key: 'rice',    baseQPerKattha: 1.27, tPerHa: 3.76,  bestPracticeMult: 1.45, bestPracticeLabel: 'SRI Method',      season: 'Jun–Jul (Monsoon)', nepaliName: 'धान' },
    maize:   { key: 'maize',   baseQPerKattha: 0.95, tPerHa: 2.80,  bestPracticeMult: 1.35, bestPracticeLabel: 'Hybrid Seed',     season: 'Mar–May (Spring)',  nepaliName: 'मकै' },
    wheat:   { key: 'wheat',   baseQPerKattha: 0.88, tPerHa: 2.60,  bestPracticeMult: 1.35, bestPracticeLabel: 'Improved Seed',   season: 'Nov–Dec (Winter)',  nepaliName: 'गहुँ' },
    potato:  { key: 'potato',  baseQPerKattha: 5.91, tPerHa: 17.50, bestPracticeMult: 1.25, bestPracticeLabel: 'Tuber Seed',     season: 'Oct–Nov (Winter)',  nepaliName: 'आलु' },
    mustard: { key: 'mustard', baseQPerKattha: 0.37, tPerHa: 1.10,  bestPracticeMult: 1.30, bestPracticeLabel: 'Line Sowing',     season: 'Oct–Nov (Autumn)',  nepaliName: 'तोरी' },
  };

  const crop = selectedField?.crop_type || 'Rice';
  const area = selectedField?.area || 1;
  const plantingDateStr = selectedField?.planting_date || null;

  // Match crop name to profile
  const matchCropProfile = (cropName: string): CropProfile => {
    const c = cropName.toLowerCase();
    if (c.includes('rice') || c.includes('paddy') || c.includes('धान')) return CROP_DB.rice;
    if (c.includes('maize') || c.includes('corn') || c.includes('मकै')) return CROP_DB.maize;
    if (c.includes('wheat') || c.includes('गहुँ')) return CROP_DB.wheat;
    if (c.includes('potato') || c.includes('आलु')) return CROP_DB.potato;
    if (c.includes('mustard') || c.includes('तोरी') || c.includes('rayo')) return CROP_DB.mustard;
    return CROP_DB.rice; // fallback
  };

  const cropProfile = matchCropProfile(crop);

  // Planting window alignment factor based on NARC agronomy research
  const getPlantingWindowInfo = (cropKey: string, dateStr: string | null): { factor: number; label: string } => {
    if (!dateStr) return { factor: 1.0, label: 'Optimal Window' };
    const month = new Date(dateStr).getMonth(); // 0 = Jan, 11 = Dec
    
    if (cropKey === 'rice') {
      if (month === 5 || month === 6) return { factor: 1.05, label: 'Optimal Monsoon Sowing' };
      if (month === 4 || month === 7) return { factor: 0.92, label: 'Slightly Delayed Sowing' };
      return { factor: 0.78, label: 'Off-Season Sowing (-22%)' };
    }
    if (cropKey === 'wheat') {
      if (month === 10) return { factor: 1.08, label: 'Optimal Mid-Nov Window' };
      if (month === 9 || month === 11) return { factor: 0.95, label: 'Acceptable Window' };
      if (month === 0) return { factor: 0.80, label: 'Late Sowing Heat Stress (-20%)' };
      return { factor: 0.70, label: 'Off-Season Window (-30%)' };
    }
    if (cropKey === 'maize') {
      if (month >= 2 && month <= 4) return { factor: 1.05, label: 'Optimal Spring Window' };
      if (month === 5 || month === 6) return { factor: 0.98, label: 'Summer Monsoon Window' };
      return { factor: 0.80, label: 'Suboptimal Timing (-20%)' };
    }
    if (cropKey === 'potato') {
      if (month === 9 || month === 10) return { factor: 1.06, label: 'Optimal Winter Window' };
      if (month === 8 || month === 11) return { factor: 0.95, label: 'Acceptable Window' };
      return { factor: 0.75, label: 'Off-Season Heat Stress (-25%)' };
    }
    if (cropKey === 'mustard') {
      if (month === 9 || month === 10) return { factor: 1.05, label: 'Optimal Autumn Window' };
      if (month === 8 || month === 11) return { factor: 0.90, label: 'Suboptimal Sowing (-10%)' };
      return { factor: 0.72, label: 'Off-Season Sowing (-28%)' };
    }
    return { factor: 1.0, label: 'Standard Window' };
  };

  const windowInfo = getPlantingWindowInfo(cropProfile.key, plantingDateStr);

  const baseHealthScore = selectedField?.health_score ?? (selectedField?.status === 'planned' ? 86 : 88);
  const healthScore = Math.max(35, Math.min(98, Math.round(baseHealthScore * windowInfo.factor)));
  const soilType = selectedField?.soil_type || 'Loam';

  // Soil quality adjustment factor (0.88 – 1.08)
  const getSoilFactor = (soil: string): number => {
    const s = soil.toLowerCase();
    if (s.includes('clay loam') || s.includes('silt')) return 1.08;
    if (s.includes('loam')) return 1.05;
    if (s.includes('clay')) return 0.95;
    if (s.includes('sandy')) return 0.88;
    return 1.0;
  };

  // Health index adjustment (maps 0–100 score → 0.70 to 1.05 multiplier)
  const healthFactor = 0.7 + (healthScore / 100) * 0.35;

  const baseYield = cropProfile.baseQPerKattha;
  const soilFactor = getSoilFactor(soilType);
  const yieldPerKattha = parseFloat((baseYield * soilFactor * healthFactor * windowInfo.factor).toFixed(2));
  const totalYieldQuintals = (area * yieldPerKattha).toFixed(1);
  const totalYieldKg = Math.round(area * yieldPerKattha * 100);

  // National average (baseline without adjustments)
  const districtAvg = baseYield;
  // Best practice ceiling (SRI / hybrid / improved variety)
  const maxPotential = parseFloat((baseYield * cropProfile.bestPracticeMult).toFixed(2));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Top Header matching app standard */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {language === 'ne' ? 'उत्पादन विश्लेषण' : 'Yield Analysis'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brandGreen} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Field Selection Selector */}
          {fields.length > 0 && (
            <View style={styles.fieldSelectorWrapper}>
              <Text style={[styles.sectionSubtitle, { color: colors.secondaryText }]}>
                {language === 'ne' ? 'खेत छान्नुहोस्' : 'SELECT FIELD'}
              </Text>
              <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScroll}>
                {fields.map((f) => {
                  const isSelected = selectedField?.id === f.id;
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
                      onPress={() => setSelectedField(f)}
                    >
                      <Ionicons
                        name={isSelected ? "leaf" : "leaf-outline"}
                        size={14}
                        color={isSelected ? '#fff' : colors.text}
                      />
                      <Text style={[styles.fieldPillText, { color: isSelected ? '#fff' : colors.text }]}>
                        {f.name} ({f.crop_type})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Hero Forecast Card — compact */}
          <View style={[styles.heroCard, { backgroundColor: isDarkMode ? '#1e3826' : '#eaf6f0', borderColor: colors.brandGreen }]}>
            <View style={styles.heroBadgeRow}>
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={12} color="#fff" />
                <Text style={styles.aiBadgeText}>AVANI AI</Text>
              </View>
              <Text style={{ fontSize: 10.5, fontWeight: '600', color: colors.secondaryText }}>
                {cropProfile.season}
              </Text>
            </View>

            <View style={styles.heroYieldRow}>
              <Text style={[styles.heroYieldVal, { color: colors.brandGreen }]}>
                {totalYieldQuintals}
              </Text>
              <View style={{ marginLeft: 6 }}>
                <Text style={[styles.heroYieldUnit, { color: colors.brandGreen }]}>Quintals</Text>
                <Text style={{ fontSize: 11, color: colors.secondaryText }}>≈ {totalYieldKg.toLocaleString()} kg</Text>
              </View>
            </View>

            {/* Rate pill */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <View style={[styles.ratePill, { backgroundColor: colors.brandGreen }]}>  
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>{yieldPerKattha} Q/Kattha</Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.secondaryText }}>
                Avg {districtAvg} • Max {maxPotential}
              </Text>
            </View>
          </View>

          {/* Visual Factor Indicators — icon-forward, minimal text */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {/* Area */}
            <View style={[styles.factorChip, { backgroundColor: colors.card, borderColor: colors.border, flex: 1 }]}>
              <View style={[styles.factorIcon, { backgroundColor: '#e8f5e9' }]}>
                <Ionicons name="resize-outline" size={18} color="#2d7a50" />
              </View>
              <Text style={[styles.factorVal, { color: colors.text }]}>{area}</Text>
              <Text style={[styles.factorLabel, { color: colors.secondaryText }]}>Kattha</Text>
            </View>
            {/* Soil */}
            <View style={[styles.factorChip, { backgroundColor: colors.card, borderColor: colors.border, flex: 1 }]}>
              <View style={[styles.factorIcon, { backgroundColor: '#e3f2fd' }]}>
                <Ionicons name="earth" size={18} color="#2d7bb6" />
              </View>
              <Text style={[styles.factorVal, { color: colors.text }]}>×{soilFactor.toFixed(2)}</Text>
              <Text style={[styles.factorLabel, { color: colors.secondaryText }]}>{soilType}</Text>
            </View>
            {/* Health */}
            <View style={[styles.factorChip, { backgroundColor: colors.card, borderColor: colors.border, flex: 1 }]}>
              <View style={[styles.factorIcon, { backgroundColor: '#fff3e0' }]}>
                <Ionicons name="heart" size={18} color="#cf6a28" />
              </View>
              <Text style={[styles.factorVal, { color: colors.text }]}>{healthScore}%</Text>
              <Text style={[styles.factorLabel, { color: colors.secondaryText }]}>Health</Text>
            </View>
            {/* Season */}
            <View style={[styles.factorChip, { backgroundColor: colors.card, borderColor: colors.border, flex: 1 }]}>
              <View style={[styles.factorIcon, { backgroundColor: '#fce4ec' }]}>
                <Ionicons name="rainy" size={18} color="#8e24aa" />
              </View>
              <Text style={[styles.factorVal, { color: colors.text }]}>{crop}</Text>
              <Text style={[styles.factorLabel, { color: colors.secondaryText }]}>{cropProfile.nepaliName}</Text>
            </View>
          </View>

          {/* Yield Benchmark — visual bar chart, no description text */}
          <View style={[styles.cardSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTag, { color: colors.brandGreen, marginBottom: 14 }]}>BENCHMARK (Q/Kattha)</Text>
            
            <View style={styles.chartContainer}>
              {/* National Avg */}
              <View style={styles.chartCol}>
                <Text style={[styles.barVal, { color: colors.secondaryText }]}>{districtAvg}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${Math.round((districtAvg / maxPotential) * 100)}%`, backgroundColor: isDarkMode ? '#555' : '#ccc' }]} />
                </View>
                <Text style={[styles.barYear, { color: colors.secondaryText, textAlign: 'center' }]}>Nepal</Text>
              </View>

              {/* Your Field */}
              <View style={styles.chartCol}>
                <Text style={[styles.barVal, { color: colors.brandGreen, fontWeight: '800' }]}>{yieldPerKattha}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${Math.min(Math.round((yieldPerKattha / maxPotential) * 100), 100)}%`, backgroundColor: colors.brandGreen }]} />
                </View>
                <Text style={[styles.barYear, { color: colors.brandGreen, fontWeight: '800', textAlign: 'center' }]}>You</Text>
              </View>

              {/* Best Practice */}
              <View style={styles.chartCol}>
                <Text style={[styles.barVal, { color: '#2d7bb6', fontWeight: '800' }]}>{maxPotential}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: '98%', backgroundColor: '#2d7bb6' }]} />
                </View>
                <Text style={[styles.barYear, { color: '#2d7bb6', fontWeight: '800', textAlign: 'center' }]}>Best</Text>
              </View>
            </View>

            <Text style={{ fontSize: 10, color: colors.secondaryText, textAlign: 'center', marginTop: 10 }}>
              {cropProfile.bestPracticeLabel} • MoALD {cropProfile.tPerHa} t/ha
            </Text>
          </View>

          {/* Quick Tips — 1-line each, icon-only */}
          <View style={[styles.cardSection, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 30 }]}>
            <Text style={[styles.cardTag, { color: colors.brandGreen, marginBottom: 10 }]}>TIPS TO IMPROVE</Text>
            
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.brandGreen} />
              <Text style={[styles.tipText, { color: colors.text }]}>
                {matchCropProfile(crop) === CROP_DB.rice ? 'Apply urea top-dressing at 20 days after transplanting' :
                 matchCropProfile(crop) === CROP_DB.maize ? 'Use hybrid seeds and apply DAP at sowing time' :
                 matchCropProfile(crop) === CROP_DB.potato ? 'Use certified seed tubers and ridge planting' :
                 matchCropProfile(crop) === CROP_DB.mustard ? 'Practice line sowing at 30cm spacing' :
                 matchCropProfile(crop) === CROP_DB.lentil ? 'Inoculate seeds with Rhizobium before sowing' :
                 'Follow recommended fertilizer schedule'}
              </Text>
            </View>

            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.brandGreen} />
              <Text style={[styles.tipText, { color: colors.text }]}>
                {matchCropProfile(crop) === CROP_DB.rice ? 'Keep 3-5cm standing water during flowering' :
                 matchCropProfile(crop) === CROP_DB.maize ? 'Ensure irrigation at tasseling stage' :
                 matchCropProfile(crop) === CROP_DB.potato ? 'Irrigate every 7-10 days, avoid waterlogging' :
                 matchCropProfile(crop) === CROP_DB.mustard ? 'Irrigate once at flowering stage' :
                 matchCropProfile(crop) === CROP_DB.lentil ? 'Avoid excess irrigation, ensure good drainage' :
                 'Monitor soil moisture regularly'}
              </Text>
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
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  fieldSelectorWrapper: {
    gap: 8,
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  selectorScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  fieldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  fieldPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  heroYieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  heroYieldVal: {
    fontSize: 38,
    fontWeight: '900',
  },
  heroYieldUnit: {
    fontSize: 15,
    fontWeight: '700',
  },
  heroSubText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  ratePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  rateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  factorChip: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  factorIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  factorVal: {
    fontSize: 12,
    fontWeight: '800',
  },
  factorLabel: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  cardSection: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
  },
  miniVarCard: {
    width: '48%',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  miniVarTitle: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  miniVarVal: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  miniVarSub: {
    fontSize: 10.5,
    marginTop: 2,
  },
  cardTag: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 10,
  },
  chartCol: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    width: 70,
  },
  barVal: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  barTrack: {
    width: 32,
    height: 80,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 10,
  },
  barYear: {
    fontSize: 11,
    marginTop: 8,
    fontWeight: '700',
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  factorIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  factorTextCol: {
    flex: 1,
  },
  factorTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  factorDesc: {
    fontSize: 11.5,
    marginTop: 2,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
});
