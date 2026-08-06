import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Linking,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../lib/ThemeContext';
import { useLanguage } from '../lib/LanguageContext';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface OrderTrackingModalProps {
  visible: boolean;
  onClose: () => void;
}

const CACHE_KEY = 'avani_cached_orders';

export default function OrderTrackingModal({ visible, onClose }: OrderTrackingModalProps) {
  const { colors, isDarkMode } = useTheme();
  const { language } = useLanguage();

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
    return () => pulseAnim.stopAnimation();
  }, []);

  useEffect(() => {
    if (visible) {
      // 1. Show cached orders instantly
      loadCachedOrders();
      // 2. Background refresh + cache update
      fetchOrders();

      // 3. When a status changes in the DB, reload from the DB
      const channel = supabase
        .channel('public:orders_mobile')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          fetchOrders();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [visible]);

  const loadCachedOrders = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOrders(parsed);
          setLoading(false);
        }
      }
    } catch (e) {
      console.warn('Cache read error:', e);
    }
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error loading orders:', error);
        return;
      }
      if (data) {
        setOrders(data);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
      }
    } catch (e) {
      console.warn('Catch loading orders:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  const activeOrders = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
  const historyOrders = orders.filter(o => o.status === 'delivered' || o.status === 'cancelled');

  const displayedOrders = activeTab === 'active' ? activeOrders : historyOrders;

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'shipped':
      case 'dispatched':
        return { bg: 'rgba(37, 99, 235, 0.15)', text: '#2563eb', border: 'rgba(37, 99, 235, 0.3)', label: language === 'ne' ? 'मार्गमा छ' : 'In Transit' };
      case 'delivered':
        return { bg: 'rgba(22, 163, 74, 0.15)', text: '#16a34a', border: 'rgba(22, 163, 74, 0.3)', label: language === 'ne' ? 'डेलिभरी भयो' : 'Delivered' };
      default:
        return { bg: 'rgba(217, 119, 6, 0.15)', text: '#d97706', border: 'rgba(217, 119, 6, 0.3)', label: language === 'ne' ? 'तयारी हुँदैछ' : 'Processing' };
    }
  };

  const getStepIcon = (step: any, isDone: boolean, isActive: boolean) => {
    if (isDone) return 'checkmark';
    const title = (step.title || '').toLowerCase();
    if (title.includes('deliver') || title.includes('bike') || title.includes('डेलिभरी')) return 'bicycle';
    if (title.includes('dispatch') || title.includes('out for')) return 'bicycle-outline';
    if (title.includes('pack') || title.includes('prepar') || title.includes('तयारी')) return 'cube-outline';
    if (title.includes('order') || title.includes('received') || title.includes('आदेश')) return 'receipt-outline';
    return isActive ? 'bicycle' : 'ellipse';
  };

  const getProgress = (steps: any[]) => {
    if (!steps || steps.length === 0) return 0;
    const completed = steps.filter(s => s.status === 'completed').length;
    return completed / steps.length;
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#142218' : '#ffffff', borderColor: isDarkMode ? '#243c2a' : '#e2eae5' }]}>
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: isDarkMode ? '#203627' : '#eaf0eb' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <LinearGradient
                colors={isDarkMode ? ['#1e3a2a', '#14432a'] : ['#16a34a', '#15803d']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.iconCircle, { borderColor: isDarkMode ? '#2b5c3b' : '#bbf7d0', borderWidth: 1 }]}
              >
                <Ionicons name="bicycle" size={22} color="#ffffff" />
              </LinearGradient>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.headerTitle, { color: isDarkMode ? colors.text : '#1c231b' }]}>
                    {language === 'ne' ? 'मेरो अर्डर ट्र्याकिङ' : 'Order Tracking'}
                  </Text>
                  <View style={[styles.liveBadge, { backgroundColor: isDarkMode ? '#1c3a2c' : '#eaf7ef' }]}>
                    <Animated.View style={{ opacity: pulseAnim }}>
                      <View style={styles.liveDot} />
                    </Animated.View>
                    <Text style={[styles.liveBadgeText, { color: isDarkMode ? '#81c784' : '#16a34a' }]}>
                      {language === 'ne' ? 'प्रत्यक्ष' : 'LIVE'}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 11, color: colors.secondaryText }}>
                  {language === 'ne' ? 'बाइक डेलिभरी प्रत्यक्ष स्थिति' : 'Bike delivery, real-time status'}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>

          {/* Tab Switcher */}
          <View style={[styles.tabBarContainer, { backgroundColor: isDarkMode ? '#1c2d20' : '#f0f4f1' }]}>
            <TouchableOpacity
              onPress={() => setActiveTab('active')}
              style={[styles.tabBtn, activeTab === 'active' && { backgroundColor: isDarkMode ? colors.brandGreen : '#ffffff' }]}
              activeOpacity={0.8}
            >
              <Ionicons name={activeTab === 'active' ? 'flash' : 'flash-outline'} size={14} color={activeTab === 'active' ? (isDarkMode ? '#ffffff' : '#1c231b') : colors.secondaryText} />
              <Text style={[styles.tabText, { color: activeTab === 'active' ? (isDarkMode ? '#ffffff' : '#1c231b') : colors.secondaryText }]}>
                {language === 'ne' ? 'सक्रिय' : 'Active'} ({activeOrders.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('history')}
              style={[styles.tabBtn, activeTab === 'history' && { backgroundColor: isDarkMode ? colors.brandGreen : '#ffffff' }]}
              activeOpacity={0.8}
            >
              <Ionicons name={activeTab === 'history' ? 'time' : 'time-outline'} size={14} color={activeTab === 'history' ? (isDarkMode ? '#ffffff' : '#1c231b') : colors.secondaryText} />
              <Text style={[styles.tabText, { color: activeTab === 'history' ? (isDarkMode ? '#ffffff' : '#1c231b') : colors.secondaryText }]}>
                {language === 'ne' ? 'इतिहास' : 'History'} ({historyOrders.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Orders Scroll View */}
          {loading ? (
            <ActivityIndicator color={colors.brandGreen} style={{ marginVertical: 40 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
              {displayedOrders.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={[styles.emptyIconWrap, { backgroundColor: isDarkMode ? '#1c2d20' : '#eef6ef' }]}>
                    <Ionicons name="bicycle-outline" size={40} color={isDarkMode ? '#4a7a55' : '#9cc4a6'} />
                  </View>
                  <Text style={[styles.emptyText, { color: isDarkMode ? colors.text : '#1c231b' }]}>
                    {language === 'ne' ? 'कुनै अर्डर छैन' : 'No orders yet'}
                  </Text>
                </View>
              ) : (
                displayedOrders.map((order) => {
                  const badge = getStatusBadgeStyle(order.status);
                  const steps = Array.isArray(order.tracking_steps) ? order.tracking_steps : [];
                  const progress = getProgress(steps);
                  const riderStep = steps.find((s: any) => s.status === 'active' && s.rider);
                  const riderPhone = riderStep?.rider?.phone as string | undefined;
                  const deliveryAddress = (order.delivery_address || order.shipping_address || '').trim();

                  return (
                    <View
                      key={order.id || order.order_number}
                      style={[styles.orderCard, { backgroundColor: isDarkMode ? '#1a2b1f' : '#f9fbf9', borderColor: isDarkMode ? '#27422f' : '#e4ece6' }]}
                    >
                      {/* Top Row: Order # & Status Badge */}
                      <View style={styles.orderCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="receipt-outline" size={16} color={isDarkMode ? '#81c784' : '#2e7d32'} />
                          <Text style={[styles.orderNumberText, { color: isDarkMode ? colors.text : '#1c231b' }]}>
                            #{order.order_number || 'ANV-8109'}
                          </Text>
                        </View>

                        <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                          <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                            {badge.label}
                          </Text>
                        </View>
                      </View>

                      {/* Product Overview */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                        <View style={[styles.productIconWrap, { backgroundColor: isDarkMode ? '#243c2c' : '#eaf4ed' }]}>
                          <Ionicons name="leaf-outline" size={15} color={isDarkMode ? '#81c784' : '#2e7d32'} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.productTitleText, { color: isDarkMode ? colors.text : '#1c231b' }]} numberOfLines={1}>
                            {order.product_title}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.secondaryText }}>
                            {order.quantity} {order.dosage ? `(${order.dosage})` : 'Unit(s)'}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: isDarkMode ? '#81c784' : '#16a34a' }}>
                          {order.total_price || order.price}
                        </Text>
                      </View>

                      {/* Bike Delivery Banner */}
                      <LinearGradient
                        colors={isDarkMode ? ['#17341f', '#12301c'] : ['#e9f7ee', '#dff2e6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.deliveryBanner, { borderColor: isDarkMode ? '#2a5534' : '#cde8d6' }]}
                      >
                        <View style={[styles.bikeIconWrap, { backgroundColor: isDarkMode ? '#24563a' : '#ffffff' }]}>
                          <Ionicons name="bicycle" size={18} color="#16a34a" />
                        </View>
                        {deliveryAddress ? (
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.deliveryBannerText, { color: isDarkMode ? colors.text : '#1c231b' }]} numberOfLines={1}>
                              {deliveryAddress}
                            </Text>
                          </View>
                        ) : null}
                      </LinearGradient>

                      {/* Progress Bar */}
                      {steps.length > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                          <Ionicons name="speedometer-outline" size={14} color={isDarkMode ? '#81c784' : '#2e7d32'} />
                          <View style={[styles.progressTrack, { backgroundColor: isDarkMode ? '#24382a' : '#e5e7eb' }]}>
                            <View style={[styles.progressFill, { width: `${Math.max(progress * 100, 6)}%` }]} />
                          </View>
                          <Text style={{ fontSize: 11, fontWeight: '900', color: isDarkMode ? '#81c784' : '#2e7d32' }}>
                            {Math.round(progress * 100)}%
                          </Text>
                        </View>
                      )}

                      {/* Interactive Step Timeline */}
                      {steps.length > 0 && (
                        <View style={styles.timelineContainer}>
                          {steps.map((step: any, idx: number) => {
                            const isLast = idx === steps.length - 1;
                            const isDone = step.status === 'completed';
                            const isActive = step.status === 'active';

                            return (
                              <View key={idx} style={styles.timelineRow}>
                                {/* Left Line & Circle */}
                                <View style={{ alignItems: 'center', marginRight: 10 }}>
                                  <View style={[
                                    styles.timelineCircle,
                                    isDone && { backgroundColor: '#16a34a', borderColor: '#16a34a' },
                                    isActive && { backgroundColor: '#2563eb', borderColor: '#93c5fd' },
                                    !isDone && !isActive && { backgroundColor: isDarkMode ? '#24382a' : '#d1d5db', borderColor: 'transparent' }
                                  ]}>
                                    <Ionicons
                                      name={isDone ? 'checkmark' : getStepIcon(step, isDone, isActive)}
                                      size={10}
                                      color={isDone || isActive ? '#ffffff' : '#9ca3af'}
                                    />
                                  </View>
                                  {!isLast && (
                                    <View style={[
                                      styles.timelineLine,
                                      { backgroundColor: isDone ? '#16a34a' : (isDarkMode ? '#24382a' : '#e5e7eb') }
                                    ]} />
                                  )}
                                </View>

                                {/* Step Label */}
                                <View style={{ flex: 1, paddingBottom: isLast ? 0 : 10 }}>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                    <Text
                                      numberOfLines={1}
                                      style={[
                                        styles.stepTitle,
                                        { color: isDarkMode ? colors.text : '#1c231b' },
                                        isActive && { color: '#2563eb', fontWeight: '900' }
                                      ]}
                                    >
                                      {step.title}
                                    </Text>
                                    {step.time ? (
                                      <Text style={{ fontSize: 10, color: colors.secondaryText, fontWeight: '700' }}>
                                        {step.time}
                                      </Text>
                                    ) : null}
                                  </View>
                                  {step.desc ? (
                                    <Text style={{ fontSize: 10.5, color: colors.secondaryText, marginTop: 1 }} numberOfLines={1}>
                                      {step.desc}
                                    </Text>
                                  ) : null}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {/* Helpline Support CTA — only when order is out for delivery with a real rider */}
                      {riderPhone && (
                        <TouchableOpacity
                          onPress={() => Linking.openURL(`tel:${riderPhone}`)}
                          style={[styles.supportBtn, { borderColor: isDarkMode ? '#284632' : '#d4e2d8' }]}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="call-outline" size={14} color={isDarkMode ? '#81c784' : '#2e7d32'} />
                          <Text style={[styles.supportBtnText, { color: isDarkMode ? '#81c784' : '#2e7d32' }]}>
                            {language === 'ne' ? 'डेलिभरीलाई कल गर्नुहोस्' : `Call Rider ${riderPhone}`}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBarContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    marginVertical: 14,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
  },
  orderCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumberText: {
    fontSize: 14,
    fontWeight: '900',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  productIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productTitleText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  deliveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  bikeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryBannerLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  deliveryBannerText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#16a34a',
  },
  timelineContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },
  stepTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  supportBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
