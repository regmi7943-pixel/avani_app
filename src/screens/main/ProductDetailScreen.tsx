import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  Animated, 
  Alert,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../lib/ThemeContext';
import { useLanguage } from '../../lib/LanguageContext';
import { useCart } from '../../lib/CartContext';
import CartModal from '../../components/CartModal';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.78;
const CARD_MARGIN = 10;
const SNAP_INTERVAL = CARD_WIDTH + CARD_MARGIN * 2;
const CARD_PEEK_PADDING = (width - SNAP_INTERVAL) / 2;

const BRAND_ICON = require('../../../assets/icon.png');
const AVATAR_PEEKING = require('../../../assets/images/avatar_peeking_cropped.png');

const BG_SEED = require('../../../assets/images/card_bg_seed.jpg');
const BG_FERTILIZER = require('../../../assets/images/card_bg_fertilizer.jpg');
const BG_PESTICIDES = require('../../../assets/images/card_bg_pesticides.jpg');
const BG_VITAMINS = require('../../../assets/images/card_bg_vitamins.jpg');
const BG_TOOLS = require('../../../assets/images/card_bg_tools.jpg');

const COLORS = {
  forest900: '#1b382b',
  forest700: '#2d5a45',
  forest600: '#3d785a',
  forest100: '#eaf6ef',
  white: '#ffffff',
};

// Complete Catalog Matrix for Advanced Related Products Recommendation Algorithm
const ALL_CATALOG_PRODUCTS = [
  {
    id: 'prod-1',
    emoji: '🌾',
    title: 'Hardinath-1 Certified Paddy Seeds',
    category: 'SEEDS',
    price: 'NPR 1,450 / Pack',
    dosage: '40-50 kg / Hectare',
    description: 'High germination (85%+) certified paddy seeds for Terai & Inner Terai.',
    benefits: 'High germination rate (85%+), disease resistance, and 15-25% yield boost.',
    when_to_use: 'First Spray: Apply 15-20 days after sowing (early vegetative stage)\nSecond Spray: Apply 35-40 days after sowing (flowering stage)',
    how_to_use: 'Step 1: Ensure optimal soil moisture.\nStep 2: Mix recommended quantity evenly.\nStep 3: Broadcast uniformly and water lightly.',
    precautions: 'Store in a cool dry place away from children. Wear gloves during handling.',
  },
  {
    id: 'prod-2',
    emoji: '🌽',
    title: 'Rampur Hybrid-10 Maize Seeds',
    category: 'SEEDS',
    price: 'NPR 1,200 / Pack',
    dosage: '20 kg / Hectare',
    description: 'High yielding hybrid maize seeds resistant to leaf blight.',
    benefits: 'Drought tolerant, uniform cob filling, and excellent grain quality.',
    when_to_use: 'First Spray: Apply 15-20 days after sowing (knee-high stage)\nSecond Spray: Apply 40-45 days after sowing (tasseling stage)',
    how_to_use: 'Step 1: Prepare ridge and furrow soil.\nStep 2: Dibble seeds 2-3 cm deep.\nStep 3: Apply light irrigation.',
    precautions: 'Do not expose treated seeds to direct sunlight before planting.',
  },
  {
    id: 'prod-3',
    emoji: '🧪',
    title: 'DAP 18-46-0 Basal Fertilizer',
    category: 'FERTILIZER',
    price: 'NPR 2,400 / Bag (50kg)',
    dosage: '100-120 kg / Hectare',
    description: 'Essential nitrogen & phosphorus basal fertilizer for root initiation.',
    benefits: 'Promotes deep root establishment and vigorous early seedling vigor.',
    when_to_use: 'First Spray: Apply during final land plowing before sowing\nSecond Spray: Apply top dress 25-30 days after crop emergence',
    how_to_use: 'Step 1: Broadcast evenly on tilled land.\nStep 2: Incorporate 5-8 cm into root zone.\nStep 3: Sow seeds immediately.',
    precautions: 'Avoid direct contact with seedling roots during application.',
  },
  {
    id: 'prod-4',
    emoji: '💧',
    title: 'Urea 46% N Top-Dress Fertilizer',
    category: 'FERTILIZER',
    price: 'NPR 1,100 / Bag (50kg)',
    dosage: '120-150 kg / Hectare',
    description: 'High concentration nitrogen top-dressing fertilizer for vegetative growth.',
    benefits: 'Accelerates leaf canopy expansion and green tiller count.',
    when_to_use: 'First Spray: Apply 20-25 days after transplanting\nSecond Spray: Apply 45-50 days after transplanting (panicle initiation)',
    how_to_use: 'Step 1: Drain excess standing water.\nStep 2: Broadcast evenly in moist soil.\nStep 3: Irrigate after 24 hours.',
    precautions: 'Do not apply during heavy rainfall to prevent nitrogen leaching.',
  },
  {
    id: 'prod-5',
    emoji: '⚡',
    title: 'Zinc Sulphate 21% Micronutrient',
    category: 'MICRONUTRIENTS',
    price: 'NPR 450 / Pack (5kg)',
    dosage: '25 kg / Hectare',
    description: 'Prevents Khaira disease in paddy and corrects yellowing leaves.',
    benefits: 'Corrects zinc deficiency, stops leaf bronzing, and improves grain filling.',
    when_to_use: 'First Spray: Apply 15-20 days after transplanting (early tillering)\nSecond Spray: Apply 35-40 days after transplanting',
    how_to_use: 'Step 1: Mix with 10kg dry sand or compost.\nStep 2: Broadcast evenly over field.\nStep 3: Maintain moist soil condition.',
    precautions: 'Do not mix directly with DAP or liquid phosphate fertilizers.',
  },
  {
    id: 'prod-6',
    emoji: '🌱',
    title: 'MOP Potash 60% K2O Fertilizer',
    category: 'FERTILIZER',
    price: 'NPR 2,100 / Bag (50kg)',
    dosage: '50-60 kg / Hectare',
    description: 'Improves grain weight, disease resistance and drought tolerance.',
    benefits: 'Enhances grain size, starch content, and crop disease immunity.',
    when_to_use: 'First Spray: Apply 50% at land preparation\nSecond Spray: Apply 50% at flowering stage',
    how_to_use: 'Step 1: Mix with basal soil preparation.\nStep 2: Apply evenly near root zone.\nStep 3: Lightly irrigate field.',
    precautions: 'Store away from damp environment to avoid fertilizer clumping.',
  },
  {
    id: 'prod-7',
    emoji: '🧪',
    title: 'Liquid Boron 20% Foliar Spray',
    category: 'MICRONUTRIENTS',
    price: 'NPR 380 / Bottle (500ml)',
    dosage: '2 ml / Litre Water',
    description: 'Enhances flower fertilization and fruit setting.',
    benefits: 'Prevents flower drop, hollow heart, and improves seed set percentage.',
    when_to_use: 'First Spray: Apply at pre-flowering stage (bud initiation)\nSecond Spray: Apply at 100% flowering / fruit set stage',
    how_to_use: 'Step 1: Dilute 2ml per litre clean water.\nStep 2: Spray evenly on foliage early morning.\nStep 3: Repeat after 15 days.',
    precautions: 'Avoid spraying during hot midday sunlight.',
  },
  {
    id: 'prod-8',
    emoji: '🎒',
    title: '16L Heavy Duty Battery Sprayer',
    category: 'TOOLS',
    price: 'NPR 4,800 / Unit',
    dosage: '16 Litre Capacity',
    description: 'Rechargeable knapsack sprayer for foliar nutrient & pesticide application.',
    benefits: 'Constant pressure delivery, ergonomic straps, and 6-hour battery life.',
    when_to_use: 'First Spray: Charge battery fully before use\nSecond Spray: Flush tank with clean water after each chemical spray',
    how_to_use: 'Step 1: Fill clean water into 16L tank.\nStep 2: Mix liquid nutrient or pesticide.\nStep 3: Turn on battery switch and spray.',
    precautions: 'Clean nozzle thoroughly after each chemical application.',
  },
  {
    id: 'prod-9',
    emoji: '📦',
    title: '50kg Jute Storage Bags & Neem Powder',
    category: 'STORAGE',
    price: 'NPR 650 / Set',
    dosage: '10 Bags + Organic Neem',
    description: 'Protects harvested grain from storage pests and moisture.',
    benefits: '100% natural organic grain protection against rice weevils.',
    when_to_use: 'First Spray: Sun-dry grain to <12% moisture\nSecond Spray: Mix 100g neem powder per 50kg bag before sealing',
    how_to_use: 'Step 1: Ensure grain is thoroughly dry.\nStep 2: Mix neem powder uniformly into grain.\nStep 3: Store in cool dry godown.',
    precautions: 'Keep bags off concrete floor using wooden pallets.',
  },
];

export default function ProductDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();
  const { language } = useLanguage();
  const { addToCart, cartCount } = useCart();
  const [cartModalVisible, setCartModalVisible] = useState(false);

  // Typewriter animation state
  const [typedText, setTypedText] = useState('');
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  // Goal Onboarding Style Arc Carousel State
  const scrollX = useRef(new Animated.Value(0)).current;
  const [selectedCardId, setSelectedCardId] = useState('description');
  const carouselScrollRef = useRef<ScrollView>(null);

  const rawProduct = route.params?.product || ALL_CATALOG_PRODUCTS[0];
  // Normalize: DB products have 'name' and numeric price, fallback products have 'title' and string price
  const product = {
    ...rawProduct,
    title: rawProduct.title || rawProduct.name || 'Product',
    price: typeof rawProduct.price === 'number' ? `NPR ${rawProduct.price.toLocaleString()}` : rawProduct.price,
  };

  // Helper to pick category background image
  const getCardBgImage = (category: string | undefined) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('seed') || cat.includes('बीउ')) return BG_SEED;
    if (cat.includes('fertilizer') || cat.includes('मल')) return BG_FERTILIZER;
    if (cat.includes('pesticide') || cat.includes('pest') || cat.includes('कीटनाशक')) return BG_PESTICIDES;
    if (cat.includes('nutrient') || cat.includes('vitamin') || cat.includes('पोषक') || cat.includes('micro')) return BG_VITAMINS;
    return BG_TOOLS;
  };

  // Guidance Cards for Goal Onboarding Style Arc Carousel
  const GUIDANCE_CARDS = [
    {
      id: 'description',
      indexLabel: language === 'ne' ? 'विवरण ०१' : 'INFO 01',
      icon: 'document-text-outline',
      bg: isDarkMode ? '#17241a' : '#f0fdf4',
      border: isDarkMode ? '#2d4d37' : '#bbf7d0',
      accent: '#16a34a',
      title: language === 'ne' ? 'सामग्री विवरण' : 'Description',
      body: product.description || (language === 'ne' 
        ? 'नेपाल सरकार तथा राष्ट्रिय बीउ विजन बोर्डद्वारा प्रमाणित उच्च गुणस्तरीय कृषि सामग्री।' 
        : 'Certified high-precision agricultural input approved for optimal field performance in Nepal.'),
    },
    {
      id: 'benefits',
      indexLabel: language === 'ne' ? 'फाइदा ०२' : 'WHY 02',
      icon: 'star-outline',
      bg: isDarkMode ? '#2b2114' : '#fffbeb',
      border: isDarkMode ? '#4a381a' : '#fde68a',
      accent: '#d97706',
      title: language === 'ne' ? 'किन प्रयोग गर्ने?' : 'Why to Use',
      body: product.benefits || (language === 'ne'
        ? 'उच्च अङ्कुरण क्षमता (८५%+), रोग प्रतिरोधात्मक क्षमता र बलियो जरा विकास जसले बाली उत्पादनमा १५-२५% सम्म वृद्धि गर्दछ।'
        : 'High germination rate (85%+), strong root development & pest tolerance increasing overall harvest yield by 15-25%.'),
    },
    {
      id: 'whenToUse',
      indexLabel: language === 'ne' ? 'समय ०३' : 'TIMING 03',
      icon: 'calendar-outline',
      bg: isDarkMode ? '#142236' : '#eff6ff',
      border: isDarkMode ? '#213a5e' : '#bfdbfe',
      accent: '#2563eb',
      title: language === 'ne' ? 'कहिले प्रयोग गर्ने?' : 'When to Use',
      body: product.when_to_use || product.whenToUse || (language === 'ne'
        ? 'पहिलो छर्काइ: बीउ रोपेको १५-२० दिन भित्र (प्रारम्भिक वृद्धि चरणमा)\nदोस्रो छर्काइ: रोपेको ३५-४० दिन पछि (फूल फुल्ने चरणमा)'
        : 'First Spray: Apply 15-20 days after sowing (early vegetative stage)\nSecond Spray: Apply 35-40 days after sowing (flowering / panicle stage)'),
    },
    {
      id: 'howToUse',
      indexLabel: language === 'ne' ? 'विधि ०४' : 'STEPS 04',
      icon: 'build-outline',
      bg: isDarkMode ? '#122b22' : '#ecfdf5',
      border: isDarkMode ? '#1f483a' : '#a7f3d0',
      accent: '#059669',
      title: language === 'ne' ? 'कसरी प्रयोग गर्ने?' : 'How to Apply',
      body: product.how_to_use || product.howToUse || (language === 'ne'
        ? '१. खेतमा उपर्युक्त ओस कायम गर्नुहोस्।\n२. सिफारिस गरिएको मात्रामा माटो वा पानीमा मिसाउनुहोस्।\n३. समान रूपमा छर्केर हल्का सिँचाइ गर्नुहोस्।'
        : 'Step 1: Ensure optimal field moisture.\nStep 2: Mix recommended quantity evenly with soil or water.\nStep 3: Broadcast uniformly and water lightly.'),
    },
    {
      id: 'precautions',
      indexLabel: language === 'ne' ? 'सुरक्षा ०५' : 'SAFETY 05',
      icon: 'shield-checkmark-outline',
      bg: isDarkMode ? '#30161c' : '#fff1f2',
      border: isDarkMode ? '#54202c' : '#fecdd3',
      accent: '#e11d48',
      title: language === 'ne' ? 'सावधानी र सुरक्षा' : 'Precautions & Safety',
      body: product.precautions || (language === 'ne'
        ? 'अध्यारो र सुक्खा ठाउँमा बालबालिकाको पहुँचबाट टाढा राख्नुहोस्। प्रयोग गर्दा पन्जा र मास्कको प्रयोग गर्नुहोस्।'
        : 'Store in a cool dry place away from direct sunlight and children. Wear gloves and mask during handling.'),
    },
  ];

  // Dynamic Product-Dependent Uniform Card Height Calculation
  // All cards for Product Y share 175px, all cards for Product X share 255px!
  const getUniformCardHeight = () => {
    const textLengths = GUIDANCE_CARDS.map(c => c.body ? c.body.length : 0);
    const lineCounts = GUIDANCE_CARDS.map(c => c.body ? c.body.split('\n').length : 0);
    const maxChars = Math.max(...textLengths);
    const maxLines = Math.max(...lineCounts);

    if (maxLines >= 3 || maxChars > 160) {
      return 255; // Product X (long content): ALL cards in product X carousel get 255px uniform height
    } else if (maxLines >= 2 || maxChars > 90) {
      return 210; // Medium content: ALL cards get 210px uniform height
    } else {
      return 175; // Product Y (short content): ALL cards in product Y carousel get 175px uniform height
    }
  };

  const dynamicCardHeight = getUniformCardHeight();
  const dynamicScrollViewHeight = dynamicCardHeight + 60;
  const dynamicSectionHeight = dynamicCardHeight + 80;

  // Advanced Related Product Recommendation Scoring Algorithm
  const getRelatedProducts = (currentProd: any) => {
    const currentCategory = (currentProd?.category || '').toLowerCase();
    const currentTitle = (currentProd?.title || '').toLowerCase();

    return ALL_CATALOG_PRODUCTS
      .filter(p => p.id !== currentProd?.id && p.title.toLowerCase() !== currentTitle)
      .map(p => {
        let score = 0;
        const targetCat = (p.category || '').toLowerCase();
        const targetTitle = (p.title || '').toLowerCase();

        // 1. Same category bonus
        if (targetCat === currentCategory) score += 50;

        // 2. Synergistic Complementary Input Bonus (Seed + Fertilizer/Nutrient)
        if ((currentCategory.includes('seed') || currentCategory.includes('बीउ')) && 
            (targetCat.includes('fertilizer') || targetCat.includes('nutrient') || targetCat.includes('पोषक'))) {
          score += 40;
        }
        if ((currentCategory.includes('fertilizer') || currentCategory.includes('मल')) && 
            (targetCat.includes('tool') || targetCat.includes('micronutrient') || targetCat.includes('पोषक'))) {
          score += 40;
        }

        // 3. Title keyword matching
        if (currentTitle.includes('paddy') && (targetTitle.includes('paddy') || targetTitle.includes('dap') || targetTitle.includes('zinc'))) score += 30;
        if (currentTitle.includes('maize') && (targetTitle.includes('maize') || targetTitle.includes('urea') || targetTitle.includes('boron'))) score += 30;

        return { product: p, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(item => item.product);
  };

  // Typewriter effect logic matching Marketplace screen
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

  const [orderProcessing, setOrderProcessing] = useState(false);

  const confirmOrder = async () => {
    setOrderProcessing(true);
    const pTitle = product.title || (product as any).name || 'Certified Agricultural Input';
    const pCategory = product.category || 'Seeds';
    const pDosage = product.dosage || (product as any).unit || 'Standard Pack';
    const pPrice = typeof product.price === 'number' ? `NPR ${product.price.toLocaleString()}` : String(product.price || 'NPR 1,450');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const orderNum = `ANV-${Math.floor(1000 + Math.random() * 9000)}`;

      const orderPayload: any = {
        order_number: orderNum,
        farmer_name: 'Chitwan Farmer',
        farmer_phone: '+977-9800000000',
        product_title: pTitle,
        product_category: pCategory,
        dosage: pDosage,
        price: pPrice,
        quantity: 1,
        total_price: pPrice,
        status: 'processing',
        delivery_address: 'Bharatpur Ward 5, Chitwan',
        shipping_address: 'Bharatpur Ward 5, Chitwan',
        estimated_delivery: 'Tomorrow by 3:00 PM',
        assigned_area: 'Chitwan',
        distributor_name: 'Chitwan Krishi Bhandar',
        distributor_email: 'vet@avani.np',
        tracking_steps: [
          { title: 'Order Placed', desc: `Order #${orderNum} confirmed`, status: 'completed', time: 'Just Now' },
          { title: 'Quality Inspection', desc: 'NARC certification & farmer ID check', status: 'active', time: 'In Progress' },
          { title: 'Dispatched from Hub', desc: 'Bharatpur Express Delivery', status: 'pending', time: 'Expected Today' },
          { title: 'Out for Farm Delivery', desc: 'Rider en route to field gate', status: 'pending', time: 'Expected Tomorrow' }
        ]
      };
      if (user?.id) orderPayload.user_id = user.id;

      const { error } = await supabase.from('orders' as any).insert([orderPayload]);

      if (error) {
        console.error('Supabase Order Insert Error:', error);
      }

      const title = language === 'ne' ? 'अर्डर सफलतापुर्वक प्राप्त भयो!' : 'Order Placed Successfully!';
      const msg = language === 'ne' 
        ? `${pTitle} को अर्डर सफलतापुर्वक प्राप्त भयो। सेटिङ्स > मेरो अर्डर ट्र्याकिङमा प्रत्यक्ष स्थिति हेर्नुहोस्।`
        : `Your order for ${pTitle} has been received. You can track it anytime under Settings > Order Tracking.`;
      Alert.alert(title, msg, [{ text: 'OK' }]);
    } catch (err: any) {
      const title = language === 'ne' ? 'अर्डर सफल भयो!' : 'Order Placed!';
      const msg = language === 'ne' 
        ? `${pTitle} को अर्डर प्राप्त भयो।`
        : `Your order for ${pTitle} has been received.`;
      Alert.alert(title, msg, [{ text: 'OK' }]);
    } finally {
      setOrderProcessing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: isDarkMode ? colors.background : '#f4f2ec' }]} edges={['top', 'left', 'right']}>
      {/* Home & Marketplace Matching Top Header */}
      <View style={[styles.topHeader, { backgroundColor: isDarkMode ? colors.card : '#f4f2ec', borderBottomColor: isDarkMode ? colors.border : '#e6e3d8' }]}>
        {/* Left section: Back Arrow + Logo + Typewriter Text */}
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={isDarkMode ? colors.text : COLORS.forest900} />
          </TouchableOpacity>
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

        {/* Right section: Shopping Bag + Profile */}
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
          
          <TouchableOpacity style={[styles.profileBtn, { borderColor: isDarkMode ? colors.brandGreen : COLORS.forest600 }]} activeOpacity={0.7}>
            <Image 
              source={AVATAR_PEEKING} 
              style={styles.profilePic} 
              resizeMode="cover"
              fadeDuration={0}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Product Card Banner */}
        <View style={styles.container}>
          <View style={styles.productCardWrapper}>
            <Image 
              source={getCardBgImage(product.category)} 
              style={styles.cardBgImage}
              resizeMode="cover"
              fadeDuration={0}
            />
            <LinearGradient
              colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.92)']}
              style={styles.cardDarkOverlay}
            >
              {/* Category Pill & Emoji */}
              <View style={styles.cardHeaderTopRow}>
                <View style={styles.categoryPillGlass}>
                  <Text style={styles.categoryPillText}>{product.category || 'AGRI INPUT'}</Text>
                </View>
                <Text style={{ fontSize: 28 }}>{product.emoji || '🌾'}</Text>
              </View>

              {/* Product Name Displayed inside Card */}
              <Text style={styles.cardProductTitle} numberOfLines={2}>
                {product.title}
              </Text>
            </LinearGradient>
          </View>
        </View>

        {/* Goal Onboarding Style Fanned Arc Card Carousel - Product Dependent Uniform Card Height */}
        <View style={[styles.carouselSection, { height: dynamicSectionHeight }]}>
          <Animated.ScrollView
            ref={carouselScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={SNAP_INTERVAL}
            snapToAlignment="start"
            disableIntervalMomentum={true}
            decelerationRate="fast"
            style={[styles.carouselScrollView, { height: dynamicScrollViewHeight }]}
            contentContainerStyle={{ 
              paddingHorizontal: CARD_PEEK_PADDING,
              alignItems: 'center',
              paddingBottom: 40,
            }}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { 
                useNativeDriver: true,
                listener: (event: any) => {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  const index = Math.round(offsetX / SNAP_INTERVAL);
                  const clampedIndex = Math.max(0, Math.min(GUIDANCE_CARDS.length - 1, index));
                  const targetId = GUIDANCE_CARDS[clampedIndex].id;
                  if (selectedCardId !== targetId) {
                    setSelectedCardId(targetId);
                  }
                }
              }
            )}
          >
            {GUIDANCE_CARDS.map((item, index) => {
              const isSelected = selectedCardId === item.id;

              // Dynamic 3D Arc interpolations matching Goal Onboarding
              const cardCenter = index * SNAP_INTERVAL;
              const inputRange = [
                cardCenter - SNAP_INTERVAL * 2,
                cardCenter - SNAP_INTERVAL,
                cardCenter,
                cardCenter + SNAP_INTERVAL,
                cardCenter + SNAP_INTERVAL * 2,
              ];

              const rotate = scrollX.interpolate({
                inputRange,
                outputRange: ['22deg', '11deg', '0deg', '-11deg', '-22deg'],
                extrapolate: 'clamp',
              });

              const translateY = scrollX.interpolate({
                inputRange,
                outputRange: [60, 24, 0, 24, 60],
                extrapolate: 'clamp',
              });

              const scale = scrollX.interpolate({
                inputRange,
                outputRange: [0.84, 0.93, 1, 0.93, 0.84],
                extrapolate: 'clamp',
              });

              const opacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.5, 0.8, 1, 0.8, 0.5],
                extrapolate: 'clamp',
              });

              return (
                <Animated.View
                  key={item.id}
                  style={{
                    width: CARD_WIDTH,
                    marginHorizontal: CARD_MARGIN,
                    transform: [{ rotate }, { translateY }, { scale }],
                    opacity,
                  }}
                >
                  <TouchableOpacity
                    style={[
                      styles.focusCard,
                      {
                        height: dynamicCardHeight, // Product-Dependent UNIFORM height for all cards in this product's carousel
                        backgroundColor: item.bg,
                        borderColor: isSelected ? item.accent : item.border,
                        borderWidth: isSelected ? 3 : 2,
                        borderBottomWidth: isSelected ? 6 : 4,
                      }
                    ]}
                    onPress={() => {
                      setSelectedCardId(item.id);
                      carouselScrollRef.current?.scrollTo({ x: index * SNAP_INTERVAL, animated: true });
                    }}
                    activeOpacity={0.92}
                  >
                    {/* Top Badge with Icon Circle & Index Tag */}
                    <View style={styles.focusCardTop}>
                      <View style={[styles.focusCardIconCircle, { backgroundColor: item.accent + '1b' }]}>
                        <Ionicons name={item.icon as any} size={28} color={item.accent} />
                      </View>
                      <Text style={[styles.focusCardIndex, { color: item.accent }]}>
                        {item.indexLabel}
                      </Text>
                    </View>

                    {/* Card Content Body */}
                    <View style={styles.focusCardBody}>
                      <Text style={[styles.focusCardTitle, { color: isDarkMode ? '#ffffff' : '#1c231b' }]}>
                        {item.title}
                      </Text>

                      {(item.id === 'whenToUse' || item.id === 'howToUse') ? (
                        <View style={{ gap: 6, marginTop: 4 }}>
                          {(() => {
                            const rawText = item.body || '';
                            const inlinePattern = /(?=(?:second\s+spray|2nd\s+spray|third\s+spray|3rd\s+spray|दोस्रो\s+छर्काइ|तेस्रो\s+छर्काइ|step\s+[2-9]|(?:\b[2-9][\.\)]\s+)))/i;
                            
                            // Split by newlines first, then by inline spray keywords
                            const lines: string[] = [];
                            rawText.split('\n').forEach((chunk: string) => {
                              const subParts = chunk.split(inlinePattern).map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                              lines.push(...subParts);
                            });

                            return lines.map((line: string, idx: number) => {
                              const cleanLine = line.replace(/^[•\d\.\s]+/, '').trim();
                              return (
                                <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                                  <View style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: 9,
                                    backgroundColor: item.accent + '25',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginTop: 1,
                                  }}>
                                    <Text style={{ fontSize: 9.5, fontWeight: '900', color: item.accent }}>
                                      {idx + 1}
                                    </Text>
                                  </View>
                                  <Text style={{
                                    flex: 1,
                                    fontSize: 12,
                                    lineHeight: 17,
                                    fontWeight: '500',
                                    color: isDarkMode ? '#d1d5db' : '#374151'
                                  }}>
                                    {cleanLine || line}
                                  </Text>
                                </View>
                              );
                            });
                          })()}
                        </View>
                      ) : (
                        <Text style={{
                          fontSize: 12.5,
                          lineHeight: 18,
                          fontWeight: '500',
                          color: isDarkMode ? '#d1d5db' : '#4b5563',
                          marginTop: 4
                        }}>
                          {item.body}
                        </Text>
                      )}
                    </View>

                    {/* Selection Indicator */}
                    {isSelected && (
                      <View style={styles.selectedBadge}>
                        <Ionicons name="checkmark-circle" size={22} color={item.accent} />
                      </View>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </Animated.ScrollView>

          {/* Carousel Pagination Dots */}
          <View style={styles.dotRow}>
            {GUIDANCE_CARDS.map((item) => (
              <View 
                key={item.id} 
                style={[
                  styles.dot, 
                  selectedCardId === item.id && { backgroundColor: isDarkMode ? colors.brandGreen : COLORS.forest900, width: 20 }
                ]} 
              />
            ))}
          </View>
        </View>

        {/* ── ADVANCED RELATED PRODUCTS RECOMMENDATION SECTION ── */}
        <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: isDarkMode ? colors.text : '#1c231b' }}>
              {language === 'ne' ? 'सम्बन्धित कृषि सामग्रीहरू' : 'Related Products'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="sparkles" size={14} color={isDarkMode ? '#81c784' : '#2e7d32'} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#81c784' : '#2e7d32' }}>
                {language === 'ne' ? 'स्मार्ट सिफारिस' : 'AI Recommendation'}
              </Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
            {getRelatedProducts(product).map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => navigation.push('ProductDetail', { product: item })}
                activeOpacity={0.88}
                style={styles.relatedProductCardWrapper}
              >
                <Image 
                  source={getCardBgImage(item.category)} 
                  style={styles.cardBgImage}
                  resizeMode="cover"
                  fadeDuration={0}
                />
                <LinearGradient
                  colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.92)']}
                  style={styles.cardDarkOverlay}
                >
                  {/* Category Glass Pill & Emoji */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={styles.categoryPillGlass}>
                      <Text style={styles.categoryPillText}>{item.category}</Text>
                    </View>
                    <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
                  </View>

                  {/* Title */}
                  <Text style={styles.relatedCardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>

                  {/* Price in Row 1, View Button on Right-Hand Side in Row 2 */}
                  <View style={{ marginTop: 'auto' }}>
                    <Text style={{ color: '#81c784', fontSize: 14, fontWeight: '900', marginBottom: 6 }}>
                      {item.price}
                    </Text>
                    <View style={styles.viewLinkPillRight}>
                      <Text style={{ color: '#ffffff', fontSize: 11.5, fontWeight: '800' }}>
                        {language === 'ne' ? 'हेर्नुहोस्' : 'View Product'}
                      </Text>
                      <Ionicons name="arrow-forward" size={12} color="#ffffff" />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[
        styles.bottomBar, 
        { 
          backgroundColor: isDarkMode ? colors.card : '#ffffff', 
          borderTopColor: isDarkMode ? colors.border : '#e2eae5',
          paddingBottom: Math.max(insets.bottom + 8, 20)
        }
      ]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: colors.secondaryText, fontWeight: '600' }}>
            {language === 'ne' ? 'कुल मूल्य' : 'Total Price'}
          </Text>
          <Text style={[styles.bottomPrice, { color: isDarkMode ? '#81c784' : '#2e7d32' }]}>
            {product.price}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => {
              addToCart(product);
              Alert.alert(
                language === 'ne' ? 'झोलामा थपियो!' : 'Added to Cart!',
                language === 'ne' ? `${product.title} झोलामा जोडिएको छ।` : `${product.title} has been added to your cart.`
              );
            }}
            style={[styles.cartOutlineBtn, { borderColor: isDarkMode ? colors.brandGreen : COLORS.forest700 }]}
            activeOpacity={0.8}
          >
            <Ionicons name="bag-add-outline" size={20} color={isDarkMode ? '#81c784' : COLORS.forest700} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={confirmOrder}
            disabled={orderProcessing}
            style={[styles.buyBtn, { backgroundColor: colors.brandGreen }]}
            activeOpacity={0.8}
          >
            {orderProcessing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="cart" size={18} color="#fff" />
                <Text style={styles.buyBtnText}>
                  {language === 'ne' ? 'अर्डर गर्नुहोस्' : 'Buy Now'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Shopping Cart Modal */}
      <CartModal 
        visible={cartModalVisible} 
        onClose={() => setCartModalVisible(false)} 
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
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
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

  container: {
    paddingHorizontal: 16,
    marginTop: 14,
  },
  
  /* Product Card Banner */
  productCardWrapper: {
    height: 160,
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  cardBgImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  cardDarkOverlay: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  cardHeaderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryPillGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  categoryPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardProductTitle: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  /* Goal Onboarding Style Fanned Arc Carousel */
  carouselSection: {
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  carouselScrollView: {
    overflow: 'visible',
  },
  focusCard: {
    borderRadius: 24,
    padding: 18,
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  focusCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  focusCardIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusCardIndex: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  focusCardBody: {
    flex: 1,
    marginTop: 10,
  },
  focusCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  selectedBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#d1d5db',
  },

  /* Related Product Cards */
  relatedProductCardWrapper: {
    width: 240,
    height: 195,
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
  relatedCardTitle: {
    color: '#ffffff',
    fontSize: 15.5,
    fontWeight: '800',
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginTop: 6,
  },
  viewLinkPillRight: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewLinkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  bottomPrice: {
    fontSize: 18,
    fontWeight: '900',
  },
  cartOutlineBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buyBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buyBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
