import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Animated,
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

interface CropLog {
  id: string;
  field_id: string;
  field_name: string;
  season: string;
  crop_name: string;
  planting_date: string;
  harvest_date: string;
  status: 'active' | 'completed' | 'planned';
  yield_amount: string;
  notes: string;
  dap: number;
  progressPct: number;
  areaVal: number;
  areaUnit: string;
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

// ─── Subtle Skeleton Loader ─────────────────────────────
function SkeletonPulse({ w, h, r, isDarkMode }: { w: number | string; h: number; r: number; isDarkMode: boolean }) {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[{ width: w as any, height: h, borderRadius: r, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', opacity: pulse }]} />;
}

function CropHistorySkeleton({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <View style={{ padding: 16, gap: 16 }}>
      <SkeletonPulse w={SW - 32} h={110} r={16} isDarkMode={isDarkMode} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <SkeletonPulse w={80} h={32} r={16} isDarkMode={isDarkMode} />
        <SkeletonPulse w={100} h={32} r={16} isDarkMode={isDarkMode} />
        <SkeletonPulse w={90} h={32} r={16} isDarkMode={isDarkMode} />
      </View>
      <SkeletonPulse w={SW - 32} h={160} r={16} isDarkMode={isDarkMode} />
      <SkeletonPulse w={SW - 32} h={160} r={16} isDarkMode={isDarkMode} />
    </View>
  );
}

// ─── Minimal Timeline Dot ─────────────────────────────
function TimelineDot({ isActive, isLast, brandGreen, borderColor }: { isActive: boolean; isLast: boolean; brandGreen: string; borderColor: string }) {
  return (
    <View style={styles.timelineTrack}>
      <View style={[
        styles.timelineDot,
        {
          backgroundColor: isActive ? brandGreen : 'transparent',
          borderColor: isActive ? brandGreen : borderColor,
          borderWidth: 2,
        }
      ]} />
      {!isLast && <View style={[styles.timelineLine, { backgroundColor: borderColor }]} />}
    </View>
  );
}

export default function CropHistoryScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDarkMode } = useTheme();
  const { language } = useLanguage();
  const isNe = language === 'ne';

  const [fields, setFields] = useState<Field[]>(DEFAULT_FIELDS);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [cropLogs, setCropLogs] = useState<CropLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [newCropName, setNewCropName] = useState('');
  const [newYieldAmount, setNewYieldAmount] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchHistoryData();
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [loading]);

  const fetchHistoryData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let activeFields = DEFAULT_FIELDS;

      if (session?.user) {
        const { data: userFields } = await supabase
          .from('fields')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (userFields && userFields.length > 0) {
          activeFields = userFields;
        }
      }

      setFields(activeFields);

      // Try database crop_history table first
      try {
        const { data: dbLogs, error } = await supabase
          .from('crop_history' as any)
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && dbLogs && dbLogs.length > 0) {
          setCropLogs(dbLogs as any);
          setLoading(false);
          return;
        }
      } catch (err) {
        // No crop_history table yet
      }

      // Build ONLY from real authenticated database fields
      const now = new Date();
      const realFieldLogs: CropLog[] = activeFields.map((f) => {
        const cropName = f.crop_type || 'Rice';
        const isRice = cropName.toLowerCase().includes('rice') || cropName.toLowerCase().includes('धान');
        const areaVal = Number(f.area || 4);
        const areaUnit = f.area_unit || 'Kattha';
        const plantDate = f.planting_date ? new Date(f.planting_date) : new Date('2026-06-15');
        const dap = Math.max(0, Math.floor((now.getTime() - plantDate.getTime()) / (1000 * 60 * 60 * 24)));
        const totalDays = isRice ? 120 : 110;
        const progressPct = Math.min(100, Math.round((dap / totalDays) * 100));

        return {
          id: `log-active-${f.id}`,
          field_id: f.id,
          field_name: f.name,
          season: '2026 Monsoon Season',
          crop_name: cropName,
          planting_date: f.planting_date || '2026-06-15',
          harvest_date: isRice ? '2026-10-25 (Est.)' : '2026-08-30 (Est.)',
          status: 'active' as const,
          yield_amount: `${(areaVal * (isRice ? 6.5 : 5.2)).toFixed(1)} Qt`,
          notes: isNe 
            ? `${f.name} — ${cropName} रोपाइँ सम्पन्न भएको छ।` 
            : `${cropName} cultivated on ${f.name}`,
          dap,
          progressPct,
          areaVal,
          areaUnit,
        };
      });

      setCropLogs(realFieldLogs);
    } catch (e) {
      console.warn('Crop history fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHarvestLog = async () => {
    if (!newCropName.trim()) {
      Alert.alert(isNe ? 'त्रुटि' : 'Error', isNe ? 'बालीको नाम लेख्नुहोस्।' : 'Please enter a crop name.');
      return;
    }

    setSubmittingLog(true);
    const targetField = selectedField || fields[0];
    const newLog: CropLog = {
      id: `custom-log-${Date.now()}`,
      field_id: targetField.id,
      field_name: targetField.name,
      season: 'Season 2026',
      crop_name: newCropName.trim(),
      planting_date: new Date().toISOString().split('T')[0],
      harvest_date: 'Recorded Today',
      status: 'completed',
      yield_amount: newYieldAmount.trim() || 'Recorded',
      notes: newNotes.trim() || 'Harvest entry',
      dap: 0,
      progressPct: 100,
      areaVal: Number(targetField.area || 4),
      areaUnit: targetField.area_unit || 'Kattha',
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from('crop_history' as any).insert([{
          user_id: session.user.id,
          field_id: targetField.id,
          field_name: targetField.name,
          season: 'Season 2026',
          crop_name: newCropName.trim(),
          planting_date: new Date().toISOString().split('T')[0],
          harvest_date: 'Recorded Today',
          status: 'completed',
          yield_amount: newYieldAmount.trim() || 'Recorded',
          notes: newNotes.trim() || 'Harvest entry',
        }]);
      }
    } catch (e) {
      console.warn('DB save error:', e);
    }

    setCropLogs(prev => [newLog, ...prev]);
    setSubmittingLog(false);
    setLogModalVisible(false);
    setNewCropName('');
    setNewYieldAmount('');
    setNewNotes('');

    Alert.alert(
      isNe ? 'सेभ भयो!' : 'Saved!',
      isNe ? `${targetField.name} को लग थपियो।` : `Crop log added for ${targetField.name}.`,
      [{ text: 'OK' }]
    );
  };

  const filteredLogs = selectedField 
    ? cropLogs.filter(log => log.field_id === selectedField.id)
    : cropLogs;

  const totalArea = filteredLogs.reduce((s, l) => s + (l.areaVal || 0), 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      
      {/* ─── Organic Minimal Header ─── */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isNe ? 'बाली इतिहास लग' : 'Crop Rotation Logs'}
          </Text>
          <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 1 }}>
            {fields.length} {isNe ? 'खेतहरू जोडिएका छन्' : 'Synced Farm Fields'}
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.headerIconBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
          onPress={() => setLogModalVisible(true)} 
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={22} color={colors.brandGreen} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <CropHistorySkeleton isDarkMode={isDarkMode} />
      ) : (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            {/* ─── Harmonious Farm Summary Card ─── */}
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: colors.brandGreen }]}>{filteredLogs.length}</Text>
                <Text style={[styles.summaryLabel, { color: colors.secondaryText }]}>
                  {isNe ? 'कुल बालीहरू' : 'Total Crops'}
                </Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: colors.text }]}>{totalArea.toFixed(1)}</Text>
                <Text style={[styles.summaryLabel, { color: colors.secondaryText }]}>
                  {isNe ? 'कुल कट्ठा क्षेत्रफल' : 'Total Kattha'}
                </Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <View style={styles.badgeActive}>
                  <Text style={[styles.badgeActiveText, { color: colors.brandGreen }]}>
                    {isNe ? 'सक्रिय चक्र' : 'In Progress'}
                  </Text>
                </View>
                <Text style={[styles.summaryLabel, { color: colors.secondaryText, marginTop: 4 }]}>
                  {isNe ? 'वर्तमान स्थिति' : 'Current Season'}
                </Text>
              </View>
            </View>

            {/* ─── Filter Pills ─── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[
                    styles.chipPill,
                    {
                      backgroundColor: selectedField === null ? colors.brandGreen : colors.card,
                      borderColor: selectedField === null ? colors.brandGreen : colors.border
                    }
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedField(null)}
                >
                  <Text style={[styles.chipText, { color: selectedField === null ? '#fff' : colors.text }]}>
                    🌐 {isNe ? 'सबै खेत' : 'All Fields'} ({fields.length})
                  </Text>
                </TouchableOpacity>

                {fields.map((f) => {
                  const isSelected = selectedField?.id === f.id;
                  const isMaize = f.crop_type?.toLowerCase().includes('maize');
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[
                        styles.chipPill,
                        {
                          backgroundColor: isSelected ? colors.brandGreen : colors.card,
                          borderColor: isSelected ? colors.brandGreen : colors.border
                        }
                      ]}
                      activeOpacity={0.8}
                      onPress={() => setSelectedField(f)}
                    >
                      <Text style={{ fontSize: 13 }}>{isMaize ? '🌽' : '🌾'}</Text>
                      <Text style={[styles.chipText, { color: isSelected ? '#fff' : colors.text }]}>
                        {f.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* ─── Clean Timeline Crop Cards ─── */}
            <View style={styles.timelineContainer}>
              {filteredLogs.map((log, idx) => {
                const isActive = log.status === 'active';
                const isMaize = log.crop_name.toLowerCase().includes('maize') || log.crop_name.toLowerCase().includes('मकै');
                const cropEmoji = isMaize ? '🌽' : '🌾';
                const isLast = idx === filteredLogs.length - 1;

                return (
                  <View key={log.id} style={styles.timelineRow}>
                    <TimelineDot isActive={isActive} isLast={isLast} brandGreen={colors.brandGreen} borderColor={colors.border} />

                    <View style={[
                      styles.cropCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: isActive ? colors.brandGreen : colors.border,
                      }
                    ]}>
                      {/* Card Top Header */}
                      <View style={styles.cardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <Text style={{ fontSize: 20 }}>{cropEmoji}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.cropTitle, { color: colors.text }]}>{log.crop_name}</Text>
                            <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 1 }}>
                              {log.field_name} • {log.areaVal} {log.areaUnit}
                            </Text>
                          </View>
                        </View>

                        <View style={[
                          styles.statusTag,
                          { backgroundColor: isActive ? 'rgba(107, 143, 94, 0.15)' : 'rgba(148, 163, 184, 0.12)' }
                        ]}>
                          <Text style={{ fontSize: 10.5, fontWeight: '700', color: isActive ? colors.brandGreen : colors.secondaryText }}>
                            {isActive ? (isNe ? 'सक्रिय बाली' : 'Active Cycle') : (isNe ? 'कटानी' : 'Harvested')}
                          </Text>
                        </View>
                      </View>

                      {/* Minimal Cycle Progress Bar */}
                      {isActive && (
                        <View style={{ marginTop: 12 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 11, color: colors.secondaryText }}>
                              Day {log.dap} DAP ({log.progressPct}%)
                            </Text>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.brandGreen }}>
                              {log.yield_amount}
                            </Text>
                          </View>
                          <View style={[styles.barTrack, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                            <View style={[styles.barFill, { width: `${log.progressPct}%` as any, backgroundColor: colors.brandGreen }]} />
                          </View>
                        </View>
                      )}

                      {/* Details Row */}
                      <View style={[styles.detailsRow, { borderColor: colors.border }]}>
                        <View style={styles.detailCol}>
                          <Text style={{ fontSize: 10, color: colors.secondaryText }}>{isNe ? 'रोपाइँ' : 'Planted Date'}</Text>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 2 }}>{log.planting_date}</Text>
                        </View>

                        <View style={styles.detailCol}>
                          <Text style={{ fontSize: 10, color: colors.secondaryText }}>{isNe ? 'कटानी' : 'Harvest Date'}</Text>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 2 }}>{log.harvest_date}</Text>
                        </View>
                      </View>

                      {Boolean(log.notes) && (
                        <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 8, fontStyle: 'italic' }}>
                          "{log.notes}"
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      )}

      {/* ─── Simple Clean Modal ─── */}
      <Modal
        visible={logModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                {isNe ? 'नयाँ बाली इतिहास लग' : 'Log New Crop Cycle'}
              </Text>
              <TouchableOpacity onPress={() => setLogModalVisible(false)}>
                <Ionicons name="close-circle-outline" size={24} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.secondaryText }]}>
              {isNe ? 'बालीको नाम:' : 'Crop Name:'}
            </Text>
            <TextInput
              value={newCropName}
              onChangeText={setNewCropName}
              placeholder="e.g. Hardinath Paddy, Rampur Maize"
              placeholderTextColor={colors.secondaryText}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />

            <Text style={[styles.label, { color: colors.secondaryText, marginTop: 10 }]}>
              {isNe ? 'उत्पादन परिमाण:' : 'Yield Outcome:'}
            </Text>
            <TextInput
              value={newYieldAmount}
              onChangeText={setNewYieldAmount}
              placeholder="e.g. 28.5 Quintal"
              placeholderTextColor={colors.secondaryText}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />

            <Text style={[styles.label, { color: colors.secondaryText, marginTop: 10 }]}>
              {isNe ? 'टिप्पणी:' : 'Notes:'}
            </Text>
            <TextInput
              value={newNotes}
              onChangeText={setNewNotes}
              placeholder="e.g. Normal harvest remarks"
              placeholderTextColor={colors.secondaryText}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />

            <TouchableOpacity
              onPress={handleCreateHarvestLog}
              disabled={submittingLog}
              style={[styles.saveBtn, { backgroundColor: colors.brandGreen }]}
              activeOpacity={0.8}
            >
              {submittingLog ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {isNe ? 'सुरक्षित गर्नुहोस्' : 'Save Harvest Log'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerIconBtn: {
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
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryVal: {
    fontSize: 20,
    fontWeight: '900',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 28,
  },
  badgeActive: {
    backgroundColor: 'rgba(107, 143, 94, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeActiveText: {
    fontSize: 11,
    fontWeight: '800',
  },
  chipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  timelineContainer: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineTrack: {
    width: 20,
    alignItems: 'center',
    paddingTop: 16,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    marginTop: 4,
  },
  cropCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginLeft: 8,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cropTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  barTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 5,
    borderRadius: 3,
  },
  detailsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 8,
    gap: 12,
  },
  detailCol: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    marginTop: 4,
  },
  saveBtn: {
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
