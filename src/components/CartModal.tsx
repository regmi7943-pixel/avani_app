import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
  TextInput
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/ThemeContext';
import { useLanguage } from '../lib/LanguageContext';
import { useCart } from '../lib/CartContext';
import { supabase } from '../lib/supabase';
import { MapView, Marker, PROVIDER_DEFAULT } from './MapViewWrapper';
import * as Location from 'expo-location';

interface CartModalProps {
  visible: boolean;
  onClose: () => void;
  onOrderSuccess?: () => void;
}

export default function CartModal({ visible, onClose, onOrderSuccess }: CartModalProps) {
  const { colors, isDarkMode } = useTheme();
  const { language } = useLanguage();
  const { cartItems, updateQuantity, removeFromCart, clearCart, totalAmount } = useCart();
  const insets = useSafeAreaInsets();
  
  const [checkingOut, setCheckingOut] = useState(false);
  const [showCheckoutDetails, setShowCheckoutDetails] = useState(false);
  const [farmerPhone, setFarmerPhone] = useState('');
  const [farmerName, setFarmerName] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('Bharatpur Ward 5, Chitwan');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'esewa' | 'bank'>('cod');

  // Farm Location & Map Picker State
  const [userFields, setUserFields] = useState<any[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showOrderSuccessModal, setShowOrderSuccessModal] = useState(false);
  const [placedOrderNum, setPlacedOrderNum] = useState('');
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [fetchingGps, setFetchingGps] = useState(false);
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [reverseGeocodedAddress, setReverseGeocodedAddress] = useState('Bharatpur Ward 5, Chitwan');
  const [mapPinCoords, setMapPinCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: 27.6782,
    longitude: 84.4321,
  });

  const CHITWAN_LOCATIONS: Record<string, { lat: number; lng: number; name: string }> = {
    bharatpur: { lat: 27.6782, lng: 84.4321, name: 'Bharatpur, Chitwan' },
    rampur: { lat: 27.6472, lng: 84.3486, name: 'Rampur, Chitwan' },
    madi: { lat: 27.4611, lng: 84.3524, name: 'Madi, Chitwan' },
    ratnanagar: { lat: 27.6167, lng: 84.5167, name: 'Ratnanagar, Chitwan' },
    tandi: { lat: 27.6167, lng: 84.5167, name: 'Tandi, Chitwan' },
    narayangadh: { lat: 27.6989, lng: 84.4265, name: 'Narayangadh, Chitwan' },
    geetanagar: { lat: 27.6350, lng: 84.4100, name: 'Geetanagar, Chitwan' },
    chanauli: { lat: 27.6150, lng: 84.3320, name: 'Chanauli, Chitwan' },
  };

  const fetchAddressFromCoords = async (lat: number, lng: number) => {
    setGeocodingLoading(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results && results.length > 0) {
        const item = results[0];
        const placeName = item.name && !item.name.includes('+') ? item.name : (item.street || item.district || '');
        const city = item.city || item.subregion || 'Bharatpur';
        const region = item.region || 'Chitwan';
        
        const addressParts = [placeName, city, region].filter(Boolean);
        let fullAddr = addressParts.join(', ');
        if (!fullAddr.toLowerCase().includes('chitwan')) {
          fullAddr += ', Chitwan';
        }
        setReverseGeocodedAddress(fullAddr);
        return fullAddr;
      }
    } catch (e) {
      console.warn('Reverse geocode error:', e);
    } finally {
      setGeocodingLoading(false);
    }
    const fallback = `Bharatpur, Chitwan`;
    setReverseGeocodedAddress(fallback);
    return fallback;
  };

  const updatePinCoordinates = (lat: number, lng: number) => {
    setMapPinCoords({ latitude: lat, longitude: lng });
    fetchAddressFromCoords(lat, lng);
  };

  const handleSearchMapLocation = (text: string) => {
    setMapSearchQuery(text);
    const query = text.toLowerCase().trim();
    if (!query) return;

    const matchedKey = Object.keys(CHITWAN_LOCATIONS).find(k => k.includes(query) || query.includes(k));
    if (matchedKey) {
      const loc = CHITWAN_LOCATIONS[matchedKey];
      updatePinCoordinates(loc.lat, loc.lng);
      setReverseGeocodedAddress(loc.name);
    }
  };

  const handleGetCurrentLocationGPS = async () => {
    setFetchingGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          language === 'ne' ? 'अनुमति अस्वीकृत' : 'Location Permission Required',
          language === 'ne' ? 'नक्सामा तपाईंको खेतको स्थान देखाउन GPS अनुमति आवश्यक छ।' : 'Please grant location permission to center on your farm.'
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (loc?.coords) {
        updatePinCoordinates(loc.coords.latitude, loc.coords.longitude);
      }
    } catch (e) {
      console.warn('GPS location fetch error:', e);
    } finally {
      setFetchingGps(false);
    }
  };

  if (!visible) return null;

  // Open Step 2: Delivery & Payment Details Modal
  const handleOpenCheckoutDetails = async () => {
    if (cartItems.length === 0) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const savedPhone = user?.user_metadata?.phone || user?.phone || '';
      if (savedPhone) {
        setFarmerPhone(savedPhone);
      }

      const savedAddress = user?.user_metadata?.delivery_address || user?.user_metadata?.address || '';
      if (savedAddress) {
        setDeliveryAddress(savedAddress);
      }

      let name = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
      if (!name && user?.email) {
        name = user.email.split('@')[0];
      }
      setFarmerName(name || 'Ram Shrestha');

      if (user?.id) {
        const { data: fieldsData } = await supabase
          .from('fields')
          .select('id, name, location_name, boundaries')
          .eq('user_id', user.id);

        if (fieldsData && fieldsData.length > 0) {
          setUserFields(fieldsData);
          if (!selectedFieldId && !savedAddress) {
            setSelectedFieldId(fieldsData[0].id);
            setDeliveryAddress(fieldsData[0].location_name || `${fieldsData[0].name}, Chitwan`);
          }
        }
      }
    } catch (e) {}
    setShowCheckoutDetails(true);
  };

  // Final Order Execution
  const handleFinalCheckout = async () => {
    if (!farmerPhone || farmerPhone.trim().length < 7) {
      Alert.alert(
        language === 'ne' ? 'फोन नम्बर आवश्यक छ' : 'Phone Number Required',
        language === 'ne' ? 'कृपया अर्डर र डेलिभरीका लागि आफ्नो सम्पर्क फोन नम्बर राख्नुहोस्।' : 'Please enter a valid phone number for delivery confirmation.'
      );
      return;
    }

    setCheckingOut(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      let farmerName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
      if (!farmerName && user?.email) {
        farmerName = user.email.split('@')[0];
      }
      if (!farmerName) {
        farmerName = 'Ram Shrestha';
      }

      const orderNum = `ANV-${Math.floor(1000 + Math.random() * 9000)}`;
      const totalQty = cartItems.reduce((acc, item) => acc + item.quantity, 0);

      const productSummaries = cartItems.map(item => {
        const title = item.product.title || (item.product as any).name || 'Item';
        return `${title} (x${item.quantity})`;
      });
      const combinedTitle = productSummaries.join(', ');
      const mainCategory = cartItems[0]?.product?.category || 'Seeds';

      const paymentLabel = paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : paymentMethod === 'esewa' ? 'eSewa Digital Wallet' : 'Bank Transfer';

      const orderPayload: any = {
        order_number: orderNum,
        farmer_name: farmerName,
        farmer_phone: farmerPhone.trim(),
        product_title: combinedTitle,
        product_category: mainCategory,
        dosage: `${cartItems.length} Product Types (${totalQty} units)`,
        price: `NPR ${totalAmount.toLocaleString()}`,
        quantity: totalQty,
        total_price: `NPR ${totalAmount.toLocaleString()}`,
        status: 'processing',
        field_name: 'Main Farm',
        delivery_address: deliveryAddress.trim() || 'Bharatpur Ward 5, Chitwan',
        shipping_address: deliveryAddress.trim() || 'Bharatpur Ward 5, Chitwan',
        estimated_delivery: 'Tomorrow by 3:00 PM',
        assigned_area: 'Chitwan',
        distributor_name: 'Chitwan Krishi Bhandar',
        distributor_email: 'vet@avani.np',
        tracking_steps: [
          { title: 'Order Confirmed', desc: `Order #${orderNum} confirmed via ${paymentLabel}`, status: 'completed', time: 'Just Now' },
          { title: 'Quality Inspection', desc: 'NARC certification & farmer ID check', status: 'active', time: 'In Progress' },
          { title: 'Dispatched from Hub', desc: 'Handed over to Chitwan Agri Transport', status: 'pending', time: 'Expected Today, 5:00 PM' },
          { title: 'Out for Farm Delivery', desc: 'Rider en route to field address', status: 'pending', time: 'Expected Tomorrow' }
        ]
      };
      if (user?.id) orderPayload.user_id = user.id;

      const { error } = await supabase.from('orders' as any).insert([orderPayload]);

      if (error) {
        console.error('Supabase Order Insert Error in CartModal:', error);
      }

      // Automatically save delivery address and phone to user metadata for next checkout!
      if (user) {
        await supabase.auth.updateUser({
          data: {
            delivery_address: deliveryAddress.trim(),
            phone: farmerPhone.trim(),
            full_name: farmerName.trim()
          }
        }).catch(e => console.warn('User metadata save error:', e));
      }

      clearCart();
      setShowCheckoutDetails(false);
      setPlacedOrderNum(orderNum);
      setShowOrderSuccessModal(true);
    } catch (e: any) {
      clearCart();
      setShowCheckoutDetails(false);
      setPlacedOrderNum('ANV-9821');
      setShowOrderSuccessModal(true);
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <>
      <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#142218' : '#ffffff', borderColor: isDarkMode ? '#243c2a' : '#e2eae5' }]}>
            
            {showCheckoutDetails ? (
            <View style={{ flex: 1 }}>
              {/* Step 2 Header */}
              <View style={[styles.headerRow, { borderBottomColor: isDarkMode ? '#203627' : '#eaf0eb' }]}>
                <TouchableOpacity onPress={() => setShowCheckoutDetails(false)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="arrow-back" size={20} color={isDarkMode ? colors.text : '#1c231b'} />
                  <Text style={[styles.headerTitle, { color: isDarkMode ? colors.text : '#1c231b' }]}>
                    {language === 'ne' ? 'डेलिभरी र भुक्तानी विवरण' : 'Delivery & Payment Details'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={22} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                <View style={{ gap: 14, paddingTop: 4 }}>
                  
                  {/* Delivery Address Input + Map Icon Button */}
                  <View style={[styles.formSectionCard, { backgroundColor: isDarkMode ? '#1a2b1e' : '#f8faf7', borderColor: isDarkMode ? '#2b4733' : '#e4ece6' }]}>
                    <Text style={[styles.inputLabel, { color: isDarkMode ? colors.text : '#1c231b', marginBottom: 6 }]}>
                      {language === 'ne' ? 'फार्म डेलिभरी ठेगाना' : 'Delivery Address'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TextInput
                        style={[
                          styles.textInput,
                          { flex: 1, backgroundColor: isDarkMode ? '#152419' : '#ffffff', color: isDarkMode ? colors.text : '#1c231b', borderColor: isDarkMode ? '#2d4d37' : '#d8e4dc' }
                        ]}
                        value={deliveryAddress}
                        onChangeText={setDeliveryAddress}
                        placeholder="Bharatpur Ward 5, Chitwan"
                        placeholderTextColor="#999999"
                      />
                      <TouchableOpacity
                        onPress={() => setShowMapPicker(true)}
                        style={[styles.mapIconButton, { backgroundColor: isDarkMode ? '#223829' : '#eaf4ed', borderColor: '#16a34a' }]}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="map" size={20} color="#16a34a" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Contact Name & Phone Input */}
                  <View style={[styles.formSectionCard, { backgroundColor: isDarkMode ? '#1a2b1e' : '#f8faf7', borderColor: isDarkMode ? '#2b4733' : '#e4ece6' }]}>
                    <View style={{ gap: 10 }}>
                      <View>
                        <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>
                          {language === 'ne' ? 'कृषकको नाम' : 'Farmer Name'}
                        </Text>
                        <TextInput
                          style={[styles.textInput, { backgroundColor: isDarkMode ? '#152419' : '#ffffff', color: isDarkMode ? colors.text : '#1c231b', borderColor: isDarkMode ? '#2d4d37' : '#d8e4dc' }]}
                          value={farmerName}
                          onChangeText={setFarmerName}
                          placeholder="e.g. Ram Shrestha"
                          placeholderTextColor="#999999"
                        />
                      </View>

                      <View>
                        <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>
                          {language === 'ne' ? 'फोन नम्बर' : 'Phone Number'} <Text style={{ color: '#ef4444' }}>*</Text>
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={[styles.phonePrefixBadge, { backgroundColor: isDarkMode ? '#223829' : '#eaf4ed', borderColor: isDarkMode ? '#2d4d37' : '#d8e4dc' }]}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: isDarkMode ? '#81c784' : '#2e7d32' }}>+977</Text>
                          </View>
                          <TextInput
                            style={[styles.textInput, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, backgroundColor: isDarkMode ? '#152419' : '#ffffff', color: isDarkMode ? colors.text : '#1c231b', borderColor: isDarkMode ? '#2d4d37' : '#d8e4dc' }]}
                            value={farmerPhone}
                            onChangeText={setFarmerPhone}
                            keyboardType="phone-pad"
                            placeholder="9855012345"
                            placeholderTextColor="#999999"
                          />
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Payment Method: Cash on Delivery Only */}
                  <View style={[styles.formSectionCard, { backgroundColor: isDarkMode ? '#1a2b1e' : '#f8faf7', borderColor: isDarkMode ? '#2b4733' : '#e4ece6' }]}>
                    <Text style={[styles.inputLabel, { color: isDarkMode ? colors.text : '#1c231b', marginBottom: 6 }]}>
                      {language === 'ne' ? 'भुक्तानी माध्यम' : 'Payment Method'}
                    </Text>

                    <View
                      style={[
                        styles.paymentOptionCard,
                        { backgroundColor: isDarkMode ? '#1e3826' : '#edf7f0', borderColor: '#16a34a', borderWidth: 1.5 }
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Ionicons name="cash-outline" size={22} color="#16a34a" />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.paymentTitle, { color: isDarkMode ? colors.text : '#1c231b' }]}>
                            {language === 'ne' ? 'नगद डेलिभरी (Cash on Delivery)' : 'Cash on Delivery (COD)'}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.secondaryText }}>
                            {language === 'ne' ? 'सामान प्राप्त गर्दा नगद भुक्तानी गर्नुहोस्' : 'Pay cash to rider upon farm delivery'}
                          </Text>
                        </View>
                        <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                      </View>
                    </View>
                  </View>

                </View>
              </ScrollView>

              {/* Step 2 Bottom Footer Row: Total Payable Amount on Left + Submit Order Button on Right */}
              <View style={[styles.footerContainerRow, { borderTopColor: isDarkMode ? '#203627' : '#eaf0eb', paddingBottom: Math.max(insets.bottom, 12), paddingTop: 14 }]}>
                {/* Total Amount Payable (Left) */}
                <View>
                  <Text style={{ fontSize: 10, color: colors.secondaryText, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {language === 'ne' ? 'कुल जम्मा' : 'TOTAL PAYABLE'}
                  </Text>
                  <Text style={[styles.totalPriceText, { color: isDarkMode ? '#81c784' : '#16a34a', marginTop: 1 }]}>
                    NPR {totalAmount.toLocaleString()}
                  </Text>
                </View>

                {/* Submit Order Button (Right) */}
                <TouchableOpacity
                  onPress={handleFinalCheckout}
                  disabled={checkingOut}
                  style={[styles.submitBtnRight, { backgroundColor: colors.brandGreen }]}
                  activeOpacity={0.8}
                >
                  {checkingOut ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text style={styles.checkoutBtnText}>
                        {language === 'ne' ? 'अर्डर पठाउनुहोस्' : 'Submit Order'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <View style={[styles.headerRow, { borderBottomColor: isDarkMode ? '#203627' : '#eaf0eb' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? '#223829' : '#eaf6ef' }]}>
                    <Ionicons name="bag-handle" size={20} color={isDarkMode ? '#81c784' : '#2e7d32'} />
                  </View>
                  <View>
                    <Text style={[styles.headerTitle, { color: isDarkMode ? colors.text : '#1c231b' }]}>
                      {language === 'ne' ? 'खरीद झोला' : 'Shopping Cart'}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.secondaryText }}>
                      {cartItems.length} {language === 'ne' ? 'सामग्री जोडिएको छ' : 'items added'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={22} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>

              {cartItems.length === 0 ? (
                <View style={styles.emptyCartContainer}>
                  <Ionicons name="cart-outline" size={56} color={isDarkMode ? '#34523c' : '#c2d4c8'} />
                  <Text style={[styles.emptyTitle, { color: isDarkMode ? colors.text : '#1c231b' }]}>
                    {language === 'ne' ? 'तपाईंको झोला खाली छ' : 'Your Cart is Empty'}
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>
                    {language === 'ne' ? 'मार्केटप्लेसबाट बीउ, मल र कृषि सामग्रीहरू जोड्नुहोस्' : 'Explore seeds, fertilizers & tools from the marketplace'}
                  </Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                  {cartItems.map((item) => {
                    const p = item.product;
                    const isSubsidized = Boolean(p.subsidized_price || (p as any).subsidy_percentage);
                    const itemTitle = p.title || (p as any).name || 'Certified Input';
                    const hasImage = p.image_url && typeof p.image_url === 'string' && p.image_url.startsWith('http');
                    const unitPrice = p.subsidized_price || p.price;

                    return (
                      <View 
                        key={item.id} 
                        style={[
                          styles.itemCard, 
                          isSubsidized 
                            ? { backgroundColor: isDarkMode ? '#241400' : '#fffbeb', borderColor: isDarkMode ? '#f59e0b' : '#d97706', borderWidth: 1.5 }
                            : { backgroundColor: isDarkMode ? '#1a2b1e' : '#fafcf9', borderColor: isDarkMode ? '#2b4733' : '#e4ece6' }
                        ]}
                      >
                        <View style={[styles.itemImageWrapper, { backgroundColor: isSubsidized ? (isDarkMode ? '#381f00' : '#fef3c7') : (isDarkMode ? '#243c2c' : '#eaf4ed') }]}>
                          {hasImage ? (
                            <Image source={{ uri: p.image_url }} style={styles.itemImage} resizeMode="cover" />
                          ) : (
                            <Text style={{ fontSize: 32 }}>{p.emoji || '🌾'}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1, paddingLeft: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <Text style={[styles.itemCategoryTag, { color: isSubsidized ? (isDarkMode ? '#fbbf24' : '#b45309') : (isDarkMode ? '#81c784' : '#2e7d32') }]}>
                              {(p.category || 'INPUT').toUpperCase()}
                            </Text>
                            {isSubsidized && (
                              <View style={[styles.subsidyTagPill, { backgroundColor: '#d97706' }]}>
                                <Text style={[styles.subsidyTagPillText, { color: '#ffffff' }]}>🏷️ GOVT SUBSIDY</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.itemTitle, { color: isDarkMode ? colors.text : '#1c231b' }]} numberOfLines={2}>
                            {itemTitle}
                          </Text>
                          <View style={{ marginTop: 4, marginBottom: 2 }}>
                            {p.original_price ? (
                              <Text style={styles.itemOriginalPriceStacked}>{p.original_price}</Text>
                            ) : null}
                            <Text style={[styles.itemPriceStacked, { color: isSubsidized ? (isDarkMode ? '#f59e0b' : '#b45309') : (isDarkMode ? '#81c784' : '#2e7d32') }]}>
                              {unitPrice}
                            </Text>
                          </View>
                          <View style={styles.cardFooterRow}>
                            <View style={styles.stepperContainer}>
                              <TouchableOpacity 
                                onPress={() => updateQuantity(item.id, item.quantity - 1)} 
                                style={[styles.stepperBtn, { backgroundColor: isSubsidized ? (isDarkMode ? '#452600' : '#fef3c7') : (isDarkMode ? '#294331' : '#e6efe8') }]}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="remove" size={14} color={isSubsidized ? (isDarkMode ? '#f59e0b' : '#b45309') : (isDarkMode ? colors.text : '#1c231b')} />
                              </TouchableOpacity>
                              <Text style={[styles.stepperQty, { color: isDarkMode ? colors.text : '#1c231b' }]}>
                                {item.quantity}
                              </Text>
                              <TouchableOpacity 
                                onPress={() => updateQuantity(item.id, item.quantity + 1)} 
                                style={[styles.stepperBtn, { backgroundColor: isSubsidized ? '#d97706' : colors.brandGreen }]}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="add" size={14} color="#ffffff" />
                              </TouchableOpacity>
                            </View>
                            <TouchableOpacity 
                              onPress={() => removeFromCart(item.id)} 
                              style={styles.trashBtn}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="trash-outline" size={16} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              )}

              {cartItems.length > 0 && (
                <View style={[styles.footerContainerRow, { borderTopColor: isDarkMode ? '#203627' : '#eaf0eb', paddingBottom: Math.max(insets.bottom, 12), paddingTop: 14 }]}>
                  <View>
                    <Text style={{ fontSize: 10, color: colors.secondaryText, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {language === 'ne' ? 'कुल जम्मा' : 'TOTAL PAYABLE'}
                    </Text>
                    <Text style={[styles.totalPriceText, { color: isDarkMode ? '#81c784' : '#16a34a', marginTop: 1 }]}>
                      NPR {totalAmount.toLocaleString()}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={handleOpenCheckoutDetails}
                    style={[styles.submitBtnRight, { backgroundColor: colors.brandGreen }]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="arrow-forward-circle" size={18} color="#fff" />
                    <Text style={styles.checkoutBtnText}>
                      {language === 'ne' ? 'अर्डर अगाडि बढाउनुहोस्' : 'Place Order'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

        </View>
      </View>

      {showMapPicker && (
        <Modal animationType="slide" visible={showMapPicker} onRequestClose={() => setShowMapPicker(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: isDarkMode ? '#0d1910' : '#f8faf7' }}>
            
            {/* Top Navigation Header Row */}
            <View style={[styles.fullPageHeader, { borderBottomColor: isDarkMode ? '#203627' : '#eaf0eb', backgroundColor: isDarkMode ? '#142419' : '#ffffff' }]}>
              <TouchableOpacity onPress={() => setShowMapPicker(false)} style={styles.backBtn} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={24} color={isDarkMode ? colors.text : '#1c231b'} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fullPageTitle, { color: isDarkMode ? colors.text : '#1c231b' }]}>
                  {language === 'ne' ? 'नक्साबाट डेलिभरी स्थान छान्नुहोस्' : 'Select Delivery Location'}
                </Text>
                <Text style={{ fontSize: 11, color: colors.secondaryText }}>
                  {language === 'ne' ? 'चितवन क्षेत्र भित्र डेलिभरी स्थान पिन गर्नुहोस्' : 'Pin your exact farm delivery location in Chitwan'}
                </Text>
              </View>
            </View>

            {/* Map Search Bar */}
            <View style={[styles.fullPageSearchBar, { backgroundColor: isDarkMode ? '#1a2c1e' : '#ffffff', borderColor: isDarkMode ? '#2b4733' : '#d8e4dc' }]}>
              <Ionicons name="search-outline" size={18} color="#16a34a" />
              <TextInput
                style={[styles.mapSearchInput, { color: isDarkMode ? colors.text : '#1c231b' }]}
                value={mapSearchQuery}
                onChangeText={handleSearchMapLocation}
                placeholder={language === 'ne' ? 'स्थान खोज्नुहोस्...' : 'Search location...'}
                placeholderTextColor="#999999"
              />
              {mapSearchQuery ? (
                <TouchableOpacity onPress={() => setMapSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#999999" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Full Screen Interactive Map Canvas */}
            <View style={{ flex: 1, position: 'relative' }}>
              <MapView
                provider={PROVIDER_DEFAULT}
                mapType="hybrid"
                style={StyleSheet.absoluteFillObject}
                region={{
                  latitude: mapPinCoords.latitude,
                  longitude: mapPinCoords.longitude,
                  latitudeDelta: 0.012,
                  longitudeDelta: 0.012,
                }}
                onPress={(e: any) => {
                  if (e?.nativeEvent?.coordinate) {
                    const { latitude, longitude } = e.nativeEvent.coordinate;
                    updatePinCoordinates(latitude, longitude);
                  }
                }}
              >
                <Marker
                  coordinate={mapPinCoords}
                  draggable
                  onDragEnd={(e: any) => {
                    if (e?.nativeEvent?.coordinate) {
                      const { latitude, longitude } = e.nativeEvent.coordinate;
                      updatePinCoordinates(latitude, longitude);
                    }
                  }}
                  title="Delivery Location"
                  description={reverseGeocodedAddress}
                />
              </MapView>

              {/* Pin Address Badge Overlay displaying Human-Readable Address */}
              <View style={styles.fullPagePinBadge}>
                <Ionicons name="location" size={16} color="#16a34a" />
                {geocodingLoading ? (
                  <ActivityIndicator size="small" color="#16a34a" />
                ) : (
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#1c231b', maxWidth: 240 }} numberOfLines={1}>
                    {reverseGeocodedAddress}
                  </Text>
                )}
              </View>

              {/* Floating GPS Current Location Button */}
              <TouchableOpacity
                onPress={handleGetCurrentLocationGPS}
                disabled={fetchingGps}
                style={[styles.fullPageGpsBtn, { backgroundColor: isDarkMode ? '#1e3826' : '#ffffff' }]}
                activeOpacity={0.8}
              >
                {fetchingGps ? (
                  <ActivityIndicator size="small" color="#16a34a" />
                ) : (
                  <Ionicons name="locate-sharp" size={24} color="#16a34a" />
                )}
              </TouchableOpacity>
            </View>

            {/* Bottom Confirmation Bar */}
            <View style={[styles.fullPageFooter, { backgroundColor: isDarkMode ? '#142419' : '#ffffff', borderTopColor: isDarkMode ? '#203627' : '#eaf0eb' }]}>
              <TouchableOpacity
                onPress={() => {
                  const newAddr = reverseGeocodedAddress;
                  setDeliveryAddress(newAddr);
                  setShowMapPicker(false);
                  
                  supabase.auth.getUser().then(({ data: { user } }) => {
                    if (user) {
                      supabase.auth.updateUser({
                        data: { delivery_address: newAddr }
                      }).catch(() => {});
                    }
                  });
                }}
                style={[styles.checkoutBtn, { backgroundColor: colors.brandGreen }]}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.checkoutBtnText}>
                  {language === 'ne' ? 'यो स्थान निश्चित गर्नुहोस्' : 'Confirm Location'}
                </Text>
              </TouchableOpacity>
            </View>

          </SafeAreaView>
        </Modal>
      )}

      {/* Small & Beautiful Order Placed Success Modal */}
      {showOrderSuccessModal && (
        <Modal transparent animationType="fade" visible={showOrderSuccessModal} onRequestClose={() => setShowOrderSuccessModal(false)}>
          <View style={styles.successModalOverlay}>
            <View style={[styles.successModalCard, { backgroundColor: isDarkMode ? '#122417' : '#ffffff', borderColor: isDarkMode ? '#22c55e' : '#16a34a' }]}>
              
              {/* Green Animated Success Checkmark Badge */}
              <View style={[styles.successIconBadge, { backgroundColor: isDarkMode ? '#1a3d24' : '#eaf7ed' }]}>
                <Ionicons name="checkmark-circle" size={46} color="#16a34a" />
              </View>

              {/* Title */}
              <Text style={[styles.successTitle, { color: isDarkMode ? colors.text : '#1c231b' }]}>
                {language === 'ne' ? 'अर्डर सफलतापुर्वक प्राप्त भयो!' : 'Order Placed! 🎉'}
              </Text>

              {/* Message matching exact user request */}
              <Text style={[styles.successMessage, { color: colors.secondaryText }]}>
                {language === 'ne'
                  ? `तपाईंको अर्डर #${placedOrderNum} पठाइएको छ। तपाईं सेटिङ्समा गएर आफ्नो अर्डर हेर्न र ट्र्याक गर्न सक्नुहुन्छ।`
                  : `Your order #${placedOrderNum} is submitted. You can view & track your order in Settings.`}
              </Text>

              {/* Action Buttons */}
              <View style={{ gap: 10, width: '100%', marginTop: 16 }}>
                <TouchableOpacity
                  onPress={() => {
                    setShowOrderSuccessModal(false);
                    onClose();
                    if (onOrderSuccess) onOrderSuccess();
                  }}
                  style={[styles.checkoutBtn, { backgroundColor: colors.brandGreen }]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="bag-check" size={18} color="#fff" />
                  <Text style={styles.checkoutBtnText}>
                    {language === 'ne' ? 'अर्डर ट्र्याक गर्नुहोस्' : 'Track Order'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setShowOrderSuccessModal(false);
                    onClose();
                  }}
                  style={[styles.doneBtn, { borderColor: isDarkMode ? '#2b4733' : '#d8e4dc' }]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.doneBtnText, { color: isDarkMode ? colors.text : '#1c231b' }]}>
                    {language === 'ne' ? 'ठिक छ' : 'Done'}
                  </Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </Modal>
      )}
      </Modal>
    </>
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
    maxHeight: '88%',
    flexShrink: 1,
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
    marginBottom: 14,
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
  emptyCartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  itemCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  itemImageWrapper: {
    width: 74,
    height: 74,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemCategoryTag: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  subsidyTagPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  subsidyTagPillText: {
    fontSize: 8.5,
    fontWeight: '900',
  },
  itemTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    marginTop: 2,
    lineHeight: 18,
  },
  itemOriginalPriceStacked: {
    fontSize: 11,
    color: '#888888',
    textDecorationLine: 'line-through',
    fontWeight: '700',
    marginBottom: 1,
  },
  itemPriceStacked: {
    fontSize: 14,
    fontWeight: '900',
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQty: {
    fontSize: 14,
    fontWeight: '800',
    minWidth: 20,
    textAlign: 'center',
  },
  trashBtn: {
    padding: 6,
  },
  footerContainer: {
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 8,
  },
  footerContainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 14,
  },
  submitBtnRight: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deliveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
  },
  deliveryBannerText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  totalPriceText: {
    fontSize: 19,
    fontWeight: '900',
  },
  checkoutBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  checkoutBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '800',
  },
  formSectionCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  formSectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  mapIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapSearchBarOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  mapSearchInput: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    padding: 0,
  },
  mapGpsFloatingBtn: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  mapIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    padding: 6,
    borderRadius: 10,
  },
  fullPageTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  fullPageSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginVertical: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  fullPagePinBadge: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  fullPageGpsBtn: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1.5,
    borderColor: '#16a34a',
  },
  fullPageFooter: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  mapPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  mapPickerBtnText: {
    color: '#16a34a',
    fontSize: 11.5,
    fontWeight: '800',
  },
  farmChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  farmChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  phonePrefixBadge: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderRightWidth: 0,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountCalloutCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    marginBottom: 6,
  },
  textInput: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 13.5,
    fontWeight: '600',
  },
  paymentOptionCard: {
    padding: 14,
    borderRadius: 14,
  },
  paymentTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  mapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 20,
  },
  mapModalContent: {
    borderRadius: 22,
    padding: 16,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  mapHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  mapHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  mapWrapperContainer: {
    height: 330,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.3)',
  },
  mapPinBadge: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    elevation: 4,
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successModalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  successIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 17.5,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
  },
  doneBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
});
