import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../lib/ThemeContext';
import { useLanguage } from '../../lib/LanguageContext';
import { useCart } from '../../lib/CartContext';
import { supabase } from '../../lib/supabase';
import CartModal from '../../components/CartModal';
import { useUserAvatar } from '../../hooks/useUserAvatar';
import UserProfileIcon from '../../components/UserProfileIcon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_WIDTH = SCREEN_WIDTH - 32;

const BRAND_ICON = require('../../../assets/icon.png');
const AVATAR_PEEKING = require('../../../assets/images/avatar_peeking_cropped.png');
const CAROUSEL_CHITWAN = require('../../../assets/images/carousel_chitwan.jpg');
const CAROUSEL_POKHARA = require('../../../assets/images/carousel_pokhara.jpg');
const CAROUSEL_KATHMANDU = require('../../../assets/images/carousel_kathmandu.jpg');

const BG_SEED = require('../../../assets/images/card_bg_seed.jpg');
const BG_FERTILIZER = require('../../../assets/images/card_bg_fertilizer.jpg');
const BG_PESTICIDES = require('../../../assets/images/card_bg_pesticides.jpg');
const BG_VITAMINS = require('../../../assets/images/card_bg_vitamins.jpg');
const BG_TOOLS = require('../../../assets/images/card_bg_tools.jpg');

const getCategoryBg = (category: string) => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('seed') || cat.includes('बीउ')) return BG_SEED;
  if (cat.includes('fertilizer') || cat.includes('मल')) return BG_FERTILIZER;
  if (cat.includes('pesticide') || cat.includes('pest') || cat.includes('कीटनाशक')) return BG_PESTICIDES;
  if (cat.includes('nutrient') || cat.includes('vitamin') || cat.includes('पोषक') || cat.includes('micro')) return BG_VITAMINS;
  return BG_TOOLS;
};

const isDarkPlaceholderUrl = (url: string) => {
  if (!url) return false;
  return (
    url.includes('1585314062340') ||
    url.includes('1592417817098') ||
    url.includes('1615485290382') ||
    url.includes('1530595467537') ||
    url.includes('1599599810769')
  );
};

const getCardImageSource = (item: any) => {
  const url = item?.image_url;
  if (url && typeof url === 'string' && url.trim().length > 10 && url.startsWith('http') && !isDarkPlaceholderUrl(url)) {
    return { uri: url.trim() };
  }
  return undefined;
};

const COLORS = {
  paper: '#f4f2ec',
  ink: '#1c231b',
  inkSoft: '#5a6558',
  forest900: '#1b382b',
  forest700: '#2d5a45',
  forest600: '#3d785a',
  forest500: '#4caf79',
  forest100: '#eaf6ef',
  creamCard: '#faf8f3',
  creamCardDark: '#1a291f',
  white: '#ffffff',
};

const FALLBACK_PRODUCTS: any[] = [];
const FALLBACK_SUBSIDIZED_PRODUCTS: any[] = [];

// Instant Checkout Overlay Modal Component
function CheckoutDialogOverlay({
  visible,
  onClose,
  selectedProduct,
  selectedField,
  orderProcessing,
  confirmOrder,
  colors,
  isDarkMode,
  language
}: any) {
  if (!visible || !selectedProduct) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.checkoutModalOverlay}>
        <View style={[styles.checkoutModalCard, { backgroundColor: isDarkMode ? '#1a291f' : '#ffffff', borderColor: isDarkMode ? '#2d4d37' : '#e0ece3' }]}>
          {/* Top Handle Bar */}
          <View style={styles.modalHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.modalEmojiCircle, { backgroundColor: isDarkMode ? '#243626' : '#eaf6ef' }]}>
                <Text style={{ fontSize: 24 }}>{selectedProduct.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalCategoryTag, { color: isDarkMode ? '#81c784' : COLORS.forest700 }]}>
                  {selectedProduct.category}
                </Text>
                <Text style={[styles.modalProductTitle, { color: isDarkMode ? colors.text : COLORS.ink }]} numberOfLines={2}>
                  {selectedProduct?.title || selectedProduct?.name || 'Agricultural Product'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>

          {/* Pricing & Dosage Spec Box */}
          <View style={[styles.modalSpecBox, { backgroundColor: isDarkMode ? '#122017' : '#f4f8f5', borderColor: isDarkMode ? '#203627' : '#e2eae5' }]}>
            <View style={styles.modalSpecRow}>
              <Text style={[styles.modalSpecLabel, { color: colors.secondaryText }]}>
                {language === 'ne' ? 'सिफारिस गरिएको मात्रा:' : 'Recommended Application:'}
              </Text>
              <Text style={[styles.modalSpecValue, { color: isDarkMode ? colors.text : COLORS.ink }]}>
                {selectedProduct.dosage || selectedProduct.unit || 'Standard Pack'}
              </Text>
            </View>

            <View style={[styles.modalSpecRow, { marginTop: 8 }]}>
              <Text style={[styles.modalSpecLabel, { color: colors.secondaryText }]}>
                {language === 'ne' ? 'एकाइ मूल्य:' : 'Price:'}
              </Text>
              <Text style={[styles.modalPriceText, { color: isDarkMode ? '#81c784' : '#2e7d32' }]}>
                {selectedProduct.subsidized_price || selectedProduct.price}
              </Text>
            </View>
          </View>

          {/* Delivery Field Selection */}
          {selectedField && (
            <View style={[styles.fieldTargetPill, { backgroundColor: isDarkMode ? 'rgba(76,175,80,0.1)' : '#f0f9f4', borderColor: isDarkMode ? '#2c4c35' : '#cce8d7' }]}>
              <Ionicons name="location" size={16} color={colors.brandGreen} />
              <Text style={[styles.fieldTargetText, { color: isDarkMode ? colors.text : COLORS.forest900 }]} numberOfLines={1}>
                {language === 'ne' ? `डेलिभरी ठेगाना: ${selectedField.name}` : `Delivery Target: ${selectedField.name}`}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.modalActionsRow}>
            <TouchableOpacity 
              onPress={onClose} 
              style={[styles.modalCancelBtn, { borderColor: isDarkMode ? colors.border : '#dcd8cc' }]} 
              activeOpacity={0.7}
            >
              <Text style={[styles.modalCancelText, { color: isDarkMode ? colors.text : COLORS.inkSoft }]}>
                {language === 'ne' ? 'रद्द गर्नुहोस्' : 'Cancel'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={confirmOrder} 
              disabled={orderProcessing} 
              style={[styles.modalConfirmBtn, { backgroundColor: colors.brandGreen }]} 
              activeOpacity={0.8}
            >
              {orderProcessing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.modalConfirmText}>
                    {language === 'ne' ? 'अर्डर पक्का गर्नुहोस्' : 'Confirm Order'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Module-level RAM Cache for Instant 0ms Subsidies Load
let cachedProducts: any[] = [];
let cachedSubsidizedProducts: any[] = [];

export default function MarketplaceScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDarkMode } = useTheme();
  const { language } = useLanguage();
  const { addToCart, cartCount } = useCart();
  const { avatarUrl, avatarSource } = useUserAvatar();

  const [products, setProducts] = useState<any[]>(cachedProducts);
  const [subsidizedProducts, setSubsidizedProducts] = useState<any[]>(cachedSubsidizedProducts);
  const [loadingData, setLoadingData] = useState(cachedProducts.length === 0);
  const [currentField, setCurrentField] = useState<any>(null);

  // Typewriter animation state for header
  const [typedText, setTypedText] = useState('');
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  // Carousel scroll state
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselScrollRef = useRef<ScrollView>(null);

  // Order modal state
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [orderProcessing, setOrderProcessing] = useState(false);

  // Carousel Data
  const CAROUSEL_SLIDES = [
    {
      id: 'slide-1',
      city: language === 'ne' ? 'चितवन' : 'Chitwan',
      title: language === 'ne' 
        ? 'चितवनका कृषकहरूका लागि प्रमाणित बीउ र मल' 
        : 'High Yield Certified Paddy Seeds & Fertilizers for Chitwan Farmers',
      image: CAROUSEL_CHITWAN,
      cta: language === 'ne' ? 'बीउ हेर्नुहोस्' : 'Explore Seeds',
    },
    {
      id: 'slide-2',
      city: language === 'ne' ? 'पोखरा' : 'Pokhara',
      title: language === 'ne' 
        ? 'पोखराको पहाडी कृषि प्रणालीका लागि जैविक पोषण' 
        : 'Organic Soil Nutrients & Bio-Fertilizers tailored for Pokhara Valley',
      image: CAROUSEL_POKHARA,
      cta: language === 'ne' ? 'मल हेर्नुहोस्' : 'Explore Fertilizers',
    },
    {
      id: 'slide-3',
      city: language === 'ne' ? 'काठमाडौं' : 'Kathmandu',
      title: language === 'ne' 
        ? 'काठमाडौं उपत्यकाका लागि स्मार्ट ब्याट्री स्प्रेयर र औजारहरू' 
        : 'Modern Heavy Duty Battery Sprayers & Farm Tools for Kathmandu Valley',
      image: CAROUSEL_KATHMANDU,
      cta: language === 'ne' ? 'औजार हेर्नुहोस्' : 'Explore Tools',
    },
  ];

  // Fetch products & subsidized products from Supabase database + Realtime Listener
  useEffect(() => {
    async function loadData(isInitial = false) {
      if (isInitial && cachedProducts.length === 0) {
        setLoadingData(true);
      }

      try {
        const [mktRes, fieldRes] = await Promise.all([
          supabase.from('marketplace_items' as any).select('*').order('created_at', { ascending: false }),
          supabase.from('fields').select('*').limit(1)
        ]);

        const mktData = mktRes.data;
        
        if (mktData && mktData.length > 0) {
          // Format all marketplace products
          const formattedProducts = mktData.map((item: any) => ({
            id: item.id,
            emoji: item.category === 'Seeds' ? '🌾' : item.category === 'Fertilizer' ? '💧' : item.category === 'Pesticides' ? '🧪' : '🎒',
            title: item.name,
            name: item.name,
            category: (item.category || 'OTHER').toUpperCase(),
            price: `NPR ${item.price} / ${item.unit || 'Pack'}`,
            dosage: item.unit || 'Standard Pack',
            description: item.description || 'Chitwan Vet certified high yield agricultural supply.',
            image_url: item.image_url,
          }));

          // Filter items with discount_percentage > 0 for Subsidized / Discounted section
          const discountedItems = mktData
            .filter((item: any) => Number(item.discount_percentage || 0) > 0)
            .map((item: any) => {
              const origPrice = item.original_price || Math.round(item.price * (1 + (item.discount_percentage || 0)/100));
              return {
                id: item.id,
                title: item.name,
                name: item.name,
                category: (item.category || 'OTHER').toUpperCase(),
                original_price: `NPR ${origPrice} / ${item.unit || 'Pack'}`,
                subsidized_price: `NPR ${item.price} / ${item.unit || 'Pack'}`,
                subsidy_percentage: item.discount_percentage,
                unit: item.unit || 'Pack',
                emoji: item.category === 'Seeds' ? '🌾' : item.category === 'Fertilizer' ? '💧' : item.category === 'Pesticides' ? '🧪' : '🎒',
                description: item.description || 'Chitwan Vet Special Discounted Offer',
                image_url: item.image_url,
              };
            });

          cachedProducts = formattedProducts;
          cachedSubsidizedProducts = discountedItems;

          setProducts(formattedProducts);
          setSubsidizedProducts(discountedItems);
        } else {
          cachedProducts = [];
          cachedSubsidizedProducts = [];
          setProducts([]);
          setSubsidizedProducts([]);
        }

        if (fieldRes.data && fieldRes.data.length > 0) {
          setCurrentField(fieldRes.data[0]);
        }
      } catch (e) {
        console.warn('Database load error:', e);
      } finally {
        setLoadingData(false);
      }
    }

    loadData(true);

    // Realtime channel listener for instant background updates from Web Portal
    const channel = supabase
      .channel('mobile:marketplace_items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_items' }, () => {
        loadData(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Typewriter effect logic
  useEffect(() => {
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

    let index = 0;
    let isDeleting = false;
    let timer: NodeJS.Timeout;
    const targetText = language === 'ne' ? 'अवनि' : 'Anavi';

    const tick = () => {
      if (!isDeleting) {
        setTypedText(targetText.slice(0, index + 1));
        index++;
        if (index === targetText.length) {
          isDeleting = true;
          timer = setTimeout(tick, 3000);
          return;
        }
        timer = setTimeout(tick, 150);
      } else {
        setTypedText(targetText.slice(0, index - 1));
        index--;
        if (index === 0) {
          isDeleting = false;
          timer = setTimeout(tick, 500);
          return;
        }
        timer = setTimeout(tick, 100);
      }
    };

    timer = setTimeout(tick, 150);
    return () => clearTimeout(timer);
  }, [language]);

  // Handle Add to Cart button press -> Adds item to cart context silently without modal popup
  const handleAddToCart = (productItem: any) => {
    addToCart(productItem, 1);
  };

  const handleBuyNow = (productItem: any) => {
    setSelectedProduct(productItem);
    setCheckoutModalVisible(true);
  };

  // Confirm order execution for Featured & Subsidized Products
  const confirmOrder = async () => {
    if (!selectedProduct) return;
    setOrderProcessing(true);

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    const pTitle = selectedProduct.title || selectedProduct.name || 'Certified Agricultural Input';
    const pCategory = selectedProduct.category || 'Seeds';
    const pDosage = selectedProduct.dosage || selectedProduct.unit || 'Standard Pack';
    const rawPrice = selectedProduct.subsidized_price || selectedProduct.price || 'NPR 1,450';
    const pPrice = typeof rawPrice === 'number' ? `NPR ${rawPrice.toLocaleString()}` : String(rawPrice);
    const orderNum = `ANV-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      let farmerName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
      if (!farmerName && user?.email) {
        farmerName = user.email.split('@')[0];
      }
      if (!farmerName) {
        farmerName = 'Ram Shrestha';
      }
      const farmerPhone = user?.user_metadata?.phone || user?.phone || '+977-9855012345';

      const orderPayload: any = {
        order_number: orderNum,
        farmer_name: farmerName,
        farmer_phone: farmerPhone,
        product_title: pTitle,
        product_category: pCategory,
        dosage: pDosage,
        price: pPrice,
        quantity: 1,
        total_price: pPrice,
        status: 'processing',
        field_name: currentField?.name || 'Main Farm',
        delivery_address: 'Bharatpur Ward 5, Chitwan',
        shipping_address: 'Bharatpur Ward 5, Chitwan',
        estimated_delivery: 'Tomorrow by 3:00 PM',
        assigned_area: 'Chitwan',
        distributor_name: 'Chitwan Krishi Bhandar',
        distributor_email: 'vet@avani.np',
        tracking_steps: [
          { title: 'Order Confirmed', desc: `Order #${orderNum} confirmed`, status: 'completed', time: 'Just Now' },
          { title: 'Subsidized Quota Verification', desc: 'Government seed & fertilizer subsidy validated', status: 'active', time: 'In Progress' },
          { title: 'Dispatched from Hub', desc: 'Bharatpur Express Delivery', status: 'pending', time: 'Expected Today' },
          { title: 'Out for Farm Delivery', desc: 'Rider en route to field gate', status: 'pending', time: 'Expected Tomorrow' }
        ]
      };
      if (user?.id) orderPayload.user_id = user.id;

      const { error } = await supabase.from('orders' as any).insert([orderPayload]);

      if (error) {
        console.error('Supabase Order Insert Error in Marketplace:', error);
      }

      setCheckoutModalVisible(false);
      const title = language === 'ne' ? 'अर्डर सफलतापुर्वक प्राप्त भयो!' : 'Order Placed Successfully!';
      const msg = language === 'ne' 
        ? `${pTitle} को अर्डर सफलतापुर्वक प्राप्त भयो। सेटिङ्स > मेरो अर्डर ट्र्याकिङमा स्थिति हेर्नुहोस्।`
        : `Your order for ${pTitle} has been received. You can track it anytime under Settings > Order Tracking.`;
      Alert.alert(title, msg);
    } catch (err: any) {
      setCheckoutModalVisible(false);
      const title = language === 'ne' ? 'अर्डर सफल भयो!' : 'Order Placed!';
      const msg = language === 'ne' 
        ? `${pTitle} को अर्डर प्राप्त भयो।`
        : `Your order for ${pTitle} has been received.`;
      Alert.alert(title, msg);
    } finally {
      setOrderProcessing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: isDarkMode ? colors.background : COLORS.paper }]} edges={['top', 'left', 'right']}>
      {/* Top Navigation Header matching Home */}
      <View style={[styles.topHeader, { backgroundColor: isDarkMode ? colors.card : COLORS.paper, borderBottomColor: isDarkMode ? colors.border : '#e6e3d8' }]}>
        <View style={styles.headerLeft}>
          <Image 
            source={BRAND_ICON} 
            style={styles.headerLogo} 
            resizeMode="contain"
            fadeDuration={0}
          />
          <Text style={[styles.headerTitle, { color: isDarkMode ? colors.text : COLORS.forest900 }]}>
            {typedText}
            <Animated.Text style={[styles.cursor, { opacity: cursorOpacity }]}>|</Animated.Text>
          </Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity 
            onPress={() => setCartModalVisible(true)} 
            style={[styles.bagBtn, { backgroundColor: isDarkMode ? '#243626' : COLORS.white, borderColor: isDarkMode ? '#334c36' : '#e6e3d8' }]} 
            activeOpacity={0.7}
          >
            <Ionicons name="bag-handle-outline" size={21} color={isDarkMode ? '#81c784' : COLORS.forest900} />
            {cartCount > 0 && (
              <View style={styles.bagBadge}>
                <Text style={styles.bagBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <UserProfileIcon
            size={36}
            borderColor={isDarkMode ? colors.brandGreen : COLORS.forest600}
            onPress={() => navigation.navigate('SettingsTab' as any)}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* ── HERO CAROUSEL SECTION ── */}
        <View style={styles.carouselContainer}>
          <ScrollView
            ref={carouselScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const slide = Math.round(e.nativeEvent.contentOffset.x / CAROUSEL_WIDTH);
              if (slide !== activeSlide && slide >= 0 && slide < CAROUSEL_SLIDES.length) {
                setActiveSlide(slide);
              }
            }}
            scrollEventThrottle={16}
          >
            {CAROUSEL_SLIDES.map((slide) => {
              const title = slide.title;
              const cta = slide.cta;

              return (
                <TouchableOpacity 
                  key={slide.id} 
                  style={{ width: CAROUSEL_WIDTH }}
                  activeOpacity={0.9}
                  onPress={() => navigation.navigate('ProductDetail', { product: products[0] })}
                >
                  <View style={styles.carouselCardWrapper}>
                    <Image 
                      source={slide.image} 
                      style={styles.carouselBgImage} 
                      resizeMode="cover"
                      fadeDuration={0}
                    />
                    <LinearGradient
                      colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.75)']}
                      style={styles.carouselDarkOverlay}
                    >
                      <View style={styles.carouselCardContent}>
                        <Text style={styles.carouselCardTitle} numberOfLines={2}>
                          {title}
                        </Text>

                        <View style={[styles.carouselCtaPill, { backgroundColor: isDarkMode ? colors.brandGreen : COLORS.forest900 }]}>
                          <Text style={styles.carouselCtaText}>{cta}</Text>
                          <Ionicons name="arrow-forward" size={13} color="#ffffff" />
                        </View>
                      </View>
                    </LinearGradient>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Carousel Pagination Dots */}
          <View style={styles.paginationRow}>
            {CAROUSEL_SLIDES.map((_, idx) => (
              <View 
                key={idx}
                style={[
                  styles.paginationDot,
                  idx === activeSlide && styles.paginationDotActive,
                  { backgroundColor: idx === activeSlide ? (isDarkMode ? colors.brandGreen : COLORS.forest700) : (isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)') }
                ]}
              />
            ))}
          </View>
        </View>

        {/* ── FEATURED PRODUCTS SECTION ── */}
        <View style={styles.featureSectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? colors.text : COLORS.ink }]}>
              {language === 'ne' ? 'सिफारिस गरिएका सामग्रीहरू' : 'Featured Products'}
            </Text>

            <TouchableOpacity onPress={() => navigation.navigate('AllProducts')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }} activeOpacity={0.7}>
              <Text style={[styles.viewAllText, { color: isDarkMode ? '#81c784' : COLORS.forest700 }]}>
                {language === 'ne' ? 'सबै हेर्नुहोस्' : 'View All'}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={isDarkMode ? '#81c784' : COLORS.forest700} />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
            {products.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                onPress={() => navigation.navigate('ProductDetail', { product: item })}
                activeOpacity={0.88}
                style={styles.featuredProductCardWrapper}
              >
                {getCardImageSource(item) && (
                  <Image 
                    source={getCardImageSource(item)} 
                    style={styles.featuredCardBgImage}
                    resizeMode="cover"
                    fadeDuration={0}
                  />
                )}
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
                    {item.title || item.name}
                  </Text>

                  {/* Price in Row 1, Buy Now on Right-Hand Side in Row 2 */}
                  <View style={{ marginTop: 'auto' }}>
                    <Text style={{ color: '#81c784', fontSize: 14.5, fontWeight: '900', marginBottom: 6 }}>
                      {typeof item.price === 'number' ? `NPR ${item.price.toLocaleString()}` : item.price}
                    </Text>

                    <TouchableOpacity 
                      onPress={() => handleAddToCart(item)}
                      style={[styles.buyBtnGlassRight, { backgroundColor: colors.brandGreen }]}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="cart" size={14} color="#fff" />
                      <Text style={styles.buyBtnGlassText}>
                        {language === 'ne' ? '+ कार्ट' : '+ Cart'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── GOVERNMENT SUBSIDIZED PRODUCTS SECTION ── */}
        <View style={[styles.featureSectionContainer, { marginTop: 24 }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.sectionTitle, { color: isDarkMode ? colors.text : COLORS.ink }]}>
                {language === 'ne' ? 'सरकारी अनुदानित सामग्रीहरू' : 'Subsidized Products'}
              </Text>
              <View style={styles.subsidyGovBadge}>
                <Text style={styles.subsidyGovBadgeText}>
                  {language === 'ne' ? '५०% अनुदान' : 'Govt Subsidy'}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }} activeOpacity={0.7}>
              <Text style={[styles.viewAllText, { color: isDarkMode ? '#81c784' : COLORS.forest700 }]}>
                {language === 'ne' ? 'सबै हेर्नुहोस्' : 'View All'}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={isDarkMode ? '#81c784' : COLORS.forest700} />
            </TouchableOpacity>
          </View>

          {loadingData ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
              {[1, 2, 3].map((key) => (
                <View key={key} style={[styles.skeletonCardWrapper, { backgroundColor: isDarkMode ? '#1a291f' : '#e6e3d8' }]}>
                  <ActivityIndicator color={isDarkMode ? '#81c784' : COLORS.forest700} style={{ marginTop: 70 }} />
                </View>
              ))}
            </ScrollView>
          ) : subsidizedProducts.length === 0 ? (
            <View style={[styles.emptySubsidiesCard, { backgroundColor: isDarkMode ? '#1a291f' : '#ffffff', borderColor: isDarkMode ? '#2d4d37' : '#e0ece3' }]}>
              <View style={[styles.emptySubsidiesIconCircle, { backgroundColor: isDarkMode ? '#243626' : '#eaf6ef' }]}>
                <Ionicons name="pricetag-outline" size={26} color={isDarkMode ? '#81c784' : COLORS.forest700} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.emptySubsidiesTitle, { color: isDarkMode ? colors.text : COLORS.ink }]}>
                  {language === 'ne' ? 'हाल कुनै अनुदानित सामग्री उपलब्ध छैन' : 'No Subsidized Offers Currently Active'}
                </Text>
                <Text style={[styles.emptySubsidiesSub, { color: colors.secondaryText }]}>
                  {language === 'ne' ? 'एग्रोभेटले नयाँ छुट लागू गर्दा यहाँ तुरुन्त देखिनेछ।' : 'Special Agrovet discounts applied on the web portal will appear here in real time.'}
                </Text>
              </View>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
              {subsidizedProducts.map((item) => (
                <TouchableOpacity 
                  key={item.id} 
                  onPress={() => navigation.navigate('ProductDetail', { product: { ...item, price: item.subsidized_price } })}
                  activeOpacity={0.88}
                  style={styles.featuredProductCardWrapper}
                >
                  {getCardImageSource(item) && (
                    <Image 
                      source={getCardImageSource(item)} 
                      style={styles.featuredCardBgImage}
                      resizeMode="cover"
                      fadeDuration={0}
                    />
                  )}
                  <LinearGradient
                    colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.92)']}
                    style={styles.featuredCardOverlay}
                  >
                    {/* Top Row: Subsidy Badge Pill & Emoji */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={styles.subsidyBadgePill}>
                        <Text style={styles.subsidyBadgePillText}>
                          {item.subsidy_percentage}% {language === 'ne' ? 'अनुदान' : 'GOVT SUBSIDY'}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
                    </View>

                    {/* Title */}
                    <Text style={styles.featuredCardTitle} numberOfLines={2}>
                      {item.title}
                    </Text>

                    {/* Price & Buy Now Row */}
                    <View style={{ marginTop: 'auto' }}>
                      {/* Stacked Rows for Price to Prevent Text Cutoff */}
                      <View style={{ marginBottom: 6 }}>
                        <Text style={[styles.originalPriceText, { fontSize: 11, marginBottom: 1 }]}>
                          {item.original_price}
                        </Text>
                        <Text style={{ color: '#81c784', fontSize: 15, fontWeight: '900' }}>
                          {item.subsidized_price}
                        </Text>
                      </View>

                      {/* Row 2: Buy Now Button on Right-Hand Side */}
                      <TouchableOpacity 
                        onPress={() => handleAddToCart({ ...item, price: item.subsidized_price })}
                        style={[styles.buyBtnGlassRight, { backgroundColor: '#d97706' }]}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="cart" size={14} color="#fff" />
                        <Text style={styles.buyBtnGlassText}>
                          {language === 'ne' ? '+ कार्ट' : '+ Cart'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* Instant Checkout Order Dialog Overlay */}
      <CheckoutDialogOverlay
        visible={checkoutModalVisible}
        onClose={() => setCheckoutModalVisible(false)}
        selectedProduct={selectedProduct}
        selectedField={currentField}
        orderProcessing={orderProcessing}
        confirmOrder={confirmOrder}
        colors={colors}
        isDarkMode={isDarkMode}
        language={language}
      />

      {/* Shopping Cart Modal */}
      <CartModal
        visible={cartModalVisible}
        onClose={() => setCartModalVisible(false)}
        onOrderSuccess={() => navigation.navigate('Settings', { openOrderTracking: true })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 30,
    height: 30,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  cursor: {
    fontSize: 18,
    fontWeight: '300',
    color: '#3d785a',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bagBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  bagBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#e53935',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  bagBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '900',
  },
  profileBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  profilePic: {
    width: '100%',
    height: '100%',
  },

  /* Carousel Section */
  carouselContainer: {
    marginTop: 14,
    alignItems: 'center',
  },
  carouselCardWrapper: {
    height: 160,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  carouselBgImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  carouselDarkOverlay: {
    flex: 1,
    padding: 18,
    justifyContent: 'flex-end',
  },
  carouselCardContent: {
    alignItems: 'flex-start',
  },
  carouselCardTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
    lineHeight: 22,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  carouselCtaPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  carouselCtaText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },

  /* Featured Product Card Banner Styles */
  featuredProductCardWrapper: {
    width: 250,
    height: 205,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 14,
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
    padding: 16,
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
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginTop: 6,
  },
  buyBtnGlassRight: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  buyBtnGlassText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },

  /* Government Subsidy Badges */
  subsidyGovBadge: {
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  subsidyGovBadgeText: {
    color: '#d97706',
    fontSize: 10,
    fontWeight: '800',
  },
  subsidyBadgePill: {
    backgroundColor: '#d97706',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  subsidyBadgePillText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  originalPriceText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
    textDecorationLine: 'line-through',
  },

  /* Pagination Dots */
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  paginationDotActive: {
    width: 18,
  },

  /* Feature Sections */
  featureSectionContainer: {
    marginTop: 20,
    paddingLeft: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* Instant Checkout Dialog Overlay Styles */
  checkoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  checkoutModalCard: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalEmojiCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCategoryTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  modalProductTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSpecBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  modalSpecRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalSpecLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  modalSpecValue: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  modalPriceText: {
    fontSize: 16,
    fontWeight: '900',
  },
  fieldTargetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  fieldTargetText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  modalConfirmBtn: {
    flex: 1.6,
    paddingVertical: 13,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalConfirmText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
  },
  emptySubsidiesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 16,
    marginTop: 4,
  },
  emptySubsidiesIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySubsidiesTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  emptySubsidiesSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  skeletonCardWrapper: {
    width: 200,
    height: 220,
    borderRadius: 20,
    marginRight: 14,
    opacity: 0.6,
  },
});
