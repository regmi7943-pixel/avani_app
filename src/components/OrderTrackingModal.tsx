import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/ThemeContext';
import { useLanguage } from '../lib/LanguageContext';
import { supabase } from '../lib/supabase';

interface OrderTrackingModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function OrderTrackingModal({ visible, onClose }: OrderTrackingModalProps) {
  const { colors, isDarkMode } = useTheme();
  const { language } = useLanguage();

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchOrders();

      // Subscribe to real-time order updates
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

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error loading orders:', error);
      }
      setOrders(data || []);
    } catch (e) {
      console.warn('Catch loading orders:', e);
      setOrders([]);
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
        return { bg: 'rgba(37, 99, 235, 0.15)', text: '#2563eb', border: 'rgba(37, 99, 235, 0.3)', label: language === 'ne' ? 'मार्गमा छ' : 'In Transit' };
      case 'delivered':
        return { bg: 'rgba(22, 163, 74, 0.15)', text: '#16a34a', border: 'rgba(22, 163, 74, 0.3)', label: language === 'ne' ? 'डेलिभरी भयो' : 'Delivered' };
      default:
        return { bg: 'rgba(217, 119, 6, 0.15)', text: '#d97706', border: 'rgba(217, 119, 6, 0.3)', label: language === 'ne' ? 'तयारी हुँदैछ' : 'Processing' };
    }
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#142218' : '#ffffff', borderColor: isDarkMode ? '#243c2a' : '#e2eae5' }]}>
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: isDarkMode ? '#203627' : '#eaf0eb' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? '#223829' : '#eaf6ef' }]}>
                <Ionicons name="location-outline" size={20} color={isDarkMode ? '#81c784' : '#2e7d32'} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: isDarkMode ? colors.text : '#1c231b' }]}>
                  {language === 'ne' ? 'मेरो अर्डर ट्र्याकिङ' : 'Order Tracking'}
                </Text>
                <Text style={{ fontSize: 11, color: colors.secondaryText }}>
                  {language === 'ne' ? 'प्रत्यक्ष ट्र्याकिङ र स्थिति' : 'Real-time Status & History'}
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
              <Text style={[styles.tabText, { color: activeTab === 'active' ? (isDarkMode ? '#ffffff' : '#1c231b') : colors.secondaryText }]}>
                {language === 'ne' ? 'सक्रिय अर्डरहरू' : 'Active Orders'} ({activeOrders.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setActiveTab('history')} 
              style={[styles.tabBtn, activeTab === 'history' && { backgroundColor: isDarkMode ? colors.brandGreen : '#ffffff' }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, { color: activeTab === 'history' ? (isDarkMode ? '#ffffff' : '#1c231b') : colors.secondaryText }]}>
                {language === 'ne' ? 'अर्डर इतिहास' : 'Order History'} ({historyOrders.length})
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
                  <Ionicons name="cube-outline" size={48} color={isDarkMode ? '#34523c' : '#c2d4c8'} />
                  <Text style={[styles.emptyText, { color: isDarkMode ? colors.text : '#1c231b' }]}>
                    {language === 'ne' ? 'कुनै अर्डर भेटिएन' : 'No orders placed yet'}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: colors.secondaryText, marginTop: 4, textAlign: 'center' }}>
                    {language === 'ne' ? 'तपाईंले राख्नुभएको अर्डर यहाँ प्रत्यक्ष ट्र्याकिङका साथ देखा पर्नेछ।' : 'Your placed orders will appear here with live tracking steps.'}
                  </Text>
                </View>
              ) : (
                displayedOrders.map((order) => {
                  const badge = getStatusBadgeStyle(order.status);
                  const steps = Array.isArray(order.tracking_steps) ? order.tracking_steps : [];

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
                      <View style={{ marginTop: 8 }}>
                        <Text style={[styles.productCategoryText, { color: isDarkMode ? '#81c784' : '#2e7d32' }]}>
                          {order.product_category}
                        </Text>
                        <Text style={[styles.productTitleText, { color: isDarkMode ? colors.text : '#1c231b' }]}>
                          {order.product_title}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.secondaryText, marginTop: 2 }}>
                          {order.quantity} {order.dosage ? `(${order.dosage})` : 'Unit(s)'} • <Text style={{ color: isDarkMode ? '#81c784' : '#2e7d32', fontWeight: '800' }}>{order.total_price || order.price}</Text>
                        </Text>
                      </View>

                      {/* Delivery Address & ETA Banner */}
                      <View style={[styles.deliveryBanner, { backgroundColor: isDarkMode ? '#122017' : '#edf5f0', borderColor: isDarkMode ? '#1f3827' : '#d8e6dc' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="location" size={14} color="#2e7d32" />
                          <Text style={[styles.deliveryBannerText, { color: isDarkMode ? colors.text : '#1c231b' }]} numberOfLines={1}>
                            {order.field_name || order.delivery_address || 'Main Farm'}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: isDarkMode ? '#81c784' : '#2e7d32' }}>
                          {order.estimated_delivery || 'Tomorrow'}
                        </Text>
                      </View>

                      {/* Interactive Step Timeline */}
                      {steps.length > 0 && (
                        <View style={styles.timelineContainer}>
                          <Text style={[styles.timelineTitle, { color: colors.secondaryText }]}>
                            {language === 'ne' ? 'अर्डर स्थिति प्रगति:' : 'Tracking Timeline:'}
                          </Text>

                          {steps.map((step: any, idx: number) => {
                            const isLast = idx === steps.length - 1;
                            const isDone = step.status === 'completed';
                            const isActive = step.status === 'active';

                            return (
                              <View key={idx} style={styles.timelineRow}>
                                {/* Left Line & Circle */}
                                <View style={{ alignItems: 'center', marginRight: 12 }}>
                                  <View style={[
                                    styles.timelineCircle,
                                    isDone && { backgroundColor: '#16a34a', borderColor: '#16a34a' },
                                    isActive && { backgroundColor: '#2563eb', borderColor: '#93c5fd' },
                                    !isDone && !isActive && { backgroundColor: isDarkMode ? '#24382a' : '#d1d5db', borderColor: 'transparent' }
                                  ]}>
                                    {isDone ? (
                                      <Ionicons name="checkmark" size={10} color="#ffffff" />
                                    ) : (
                                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isActive ? '#ffffff' : '#9ca3af' }} />
                                    )}
                                  </View>
                                  {!isLast && (
                                    <View style={[
                                      styles.timelineLine,
                                      { backgroundColor: isDone ? '#16a34a' : (isDarkMode ? '#24382a' : '#e5e7eb') }
                                    ]} />
                                  )}
                                </View>

                                {/* Step Label & Details */}
                                <View style={{ flex: 1, paddingBottom: isLast ? 0 : 12 }}>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={[
                                      styles.stepTitle,
                                      { color: isDarkMode ? colors.text : '#1c231b' },
                                      isActive && { color: '#2563eb', fontWeight: '900' }
                                    ]}>
                                      {step.title}
                                    </Text>
                                    <Text style={{ fontSize: 10, color: colors.secondaryText, fontWeight: '600' }}>
                                      {step.time}
                                    </Text>
                                  </View>
                                  {step.desc && (
                                    <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 2 }}>
                                      {step.desc}
                                    </Text>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {/* Helpline Support CTA */}
                      <TouchableOpacity 
                        onPress={() => Alert.alert('Anavi Agri Delivery Support', 'Call Delivery Agent: +977-9801234567\nDelivery Hub: Chitwan Regional Express')} 
                        style={[styles.supportBtn, { borderColor: isDarkMode ? '#284632' : '#d4e2d8' }]}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="call-outline" size={14} color={isDarkMode ? '#81c784' : '#2e7d32'} />
                        <Text style={[styles.supportBtnText, { color: isDarkMode ? '#81c784' : '#2e7d32' }]}>
                          {language === 'ne' ? 'डेलिभरी प्रतिनिधिसँग कुरा गर्नुहोस्' : 'Contact Delivery Support'}
                        </Text>
                      </TouchableOpacity>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
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
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
  productCategoryText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  productTitleText: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  deliveryBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
  },
  deliveryBannerText: {
    fontSize: 11.5,
    fontWeight: '700',
    flex: 1,
  },
  timelineContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  timelineTitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
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
