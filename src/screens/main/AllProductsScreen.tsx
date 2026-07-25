import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
  Animated,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 44) / 2;
const BATCH_SIZE = 14; // Load 14 items per batch to prevent memory spikes & lag

const BRAND_ICON = require('../../../assets/icon.png');
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
  return getCategoryBg(item?.category);
};

const getCategoryEmoji = (category: string) => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('seed') || cat.includes('बीउ')) return '🌾';
  if (cat.includes('fertilizer') || cat.includes('मल')) return '🧪';
  if (cat.includes('pesticide') || cat.includes('कीटनाशक')) return '🛡️';
  if (cat.includes('tool') || cat.includes('औजार')) return '🎒';
  if (cat.includes('nutrient') || cat.includes('vitamin')) return '⚡';
  return '🍃';
};

const COLORS = {
  paper: '#f4f2ec',
  ink: '#1c231b',
  inkSoft: '#5a6558',
  forest900: '#1b382b',
  forest700: '#2d5a45',
  forest600: '#3d785a',
  forest500: '#4caf79',
  white: '#ffffff',
};

const CATEGORIES = ['All', 'Seeds', 'Fertilizer', 'Micronutrient', 'Tools', 'Pesticides', 'Other'];

const SkeletonLoaderGrid: React.FC<{ isDarkMode: boolean; language: string; colors: any }> = ({ isDarkMode, language, colors }) => {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  const skeletonItems = [1, 2, 3, 4, 5, 6];
  const blockBg = isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 100 }}>
      {/* Search Bar Skeleton */}
      <Animated.View style={[styles.searchBar, { backgroundColor: isDarkMode ? '#1a291f' : '#ffffff', borderColor: isDarkMode ? '#2d4a35' : '#e6e3d8', opacity: pulseAnim, marginBottom: 12 }]}>
        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: blockBg }} />
        <View style={{ width: 140, height: 12, borderRadius: 6, backgroundColor: blockBg }} />
      </Animated.View>

      {/* Filter Chips Skeleton */}
      <Animated.View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, opacity: pulseAnim }}>
        {[60, 75, 90, 65, 80].map((w, idx) => (
          <View key={idx} style={{ width: w, height: 32, borderRadius: 10, backgroundColor: isDarkMode ? '#1f3325' : '#e2eadf' }} />
        ))}
      </Animated.View>

      <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? colors.text : COLORS.ink, marginBottom: 12 }}>
        {language === 'ne' ? 'सामग्री लोड हुँदैछ...' : 'loading the product'}
      </Text>

      {/* Skeleton Product Grid */}
      <View style={styles.gridContainer}>
        {skeletonItems.map((k) => (
          <Animated.View
            key={k}
            style={[
              styles.productCard,
              {
                width: CARD_WIDTH,
                backgroundColor: isDarkMode ? '#17271c' : '#f0f5f1',
                borderColor: isDarkMode ? '#27422f' : '#d8e4dc',
                opacity: pulseAnim,
                padding: 12,
                justifyContent: 'space-between',
              },
            ]}
          >
            {/* Top Row Skeleton */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ width: 56, height: 18, borderRadius: 6, backgroundColor: blockBg }} />
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: blockBg }} />
            </View>

            {/* Title & Subtitle Skeleton */}
            <View style={{ gap: 6, marginVertical: 10 }}>
              <View style={{ width: '92%', height: 14, borderRadius: 4, backgroundColor: blockBg }} />
              <View style={{ width: '65%', height: 14, borderRadius: 4, backgroundColor: blockBg }} />
              <View style={{ width: '45%', height: 11, borderRadius: 4, backgroundColor: blockBg, marginTop: 4 }} />
            </View>

            {/* Footer Price & Button Skeleton */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
              <View style={{ width: 62, height: 16, borderRadius: 4, backgroundColor: blockBg }} />
              <View style={{ width: 34, height: 32, borderRadius: 10, backgroundColor: isDarkMode ? '#2e4e37' : '#2d5a45' }} />
            </View>
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
};

export default function AllProductsScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDarkMode } = useTheme();
  const { language } = useLanguage();
  const { addToCart, cartCount } = useCart();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cartModalVisible, setCartModalVisible] = useState(false);

  // Pagination Batching states
  const [displayedLimit, setDisplayedLimit] = useState(BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Fetch products from database
  useEffect(() => {
    async function loadAllProducts() {
      setLoading(true);
      try {
        const [{ data: itemsData }, { data: prodsData }] = await Promise.all([
          supabase.from('marketplace_items' as any).select('*').order('created_at', { ascending: false }),
          supabase.from('products' as any).select('*').order('created_at', { ascending: false })
        ]);

        const combinedList: any[] = [];
        const seenIds = new Set<string>();

        if (itemsData && itemsData.length > 0) {
          itemsData.forEach((item: any) => {
            const rawPrice = item.price;
            const priceStr = typeof rawPrice === 'number' 
              ? `NPR ${rawPrice.toLocaleString()}` 
              : String(rawPrice || 'NPR 0');

            combinedList.push({
              id: item.id,
              title: item.name || 'Agri Resource',
              category: item.category || 'Seeds',
              price: priceStr,
              rawPriceNum: typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0,
              unit: item.unit || 'Pack',
              stock: item.stock ?? 50,
              description: item.description || '',
              emoji: getCategoryEmoji(item.category),
              image_url: item.image_url,
              dosage: item.unit ? `${item.unit}` : undefined,
            });
            seenIds.add(item.id);
          });
        }

        if (prodsData && prodsData.length > 0) {
          prodsData.forEach((item: any) => {
            if (!seenIds.has(item.id)) {
              const rawPrice = item.price;
              const priceStr = typeof rawPrice === 'number' 
                ? `NPR ${rawPrice.toLocaleString()}` 
                : String(rawPrice || 'NPR 0');

              combinedList.push({
                id: item.id,
                title: item.name || item.title || 'Agri Product',
                category: item.category || 'Seeds',
                price: priceStr,
                rawPriceNum: typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0,
                unit: item.unit || 'Pack',
                stock: 100,
                description: item.description || '',
                emoji: item.emoji || getCategoryEmoji(item.category),
                image_url: item.image_url,
                dosage: item.dosage,
              });
            }
          });
        }

        setProducts(combinedList);
      } catch (e) {
        console.warn('Error loading combined products catalog:', e);
      } finally {
        setLoading(false);
      }
    }

    loadAllProducts();
  }, []);

  // Filter items by category & search query
  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const titleMatch = (item.title || '').toLowerCase().includes(searchQuery.toLowerCase());
      const descMatch = (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSearch = titleMatch || descMatch;

      const catNormalized = (item.category || '').toLowerCase();
      const selectedNormalized = selectedCategory.toLowerCase();
      const matchesCategory =
        selectedCategory === 'All' || catNormalized.includes(selectedNormalized);

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Reset pagination limit when search or category changes
  useEffect(() => {
    setDisplayedLimit(BATCH_SIZE);
  }, [searchQuery, selectedCategory]);

  // Current batch slice
  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, displayedLimit);
  }, [filteredProducts, displayedLimit]);

  // Automatic batch load (fast 150ms delay on scroll)
  const handleAutoLoadMore = useCallback(() => {
    if (isLoadingMore || displayedLimit >= filteredProducts.length) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setDisplayedLimit(prev => Math.min(prev + BATCH_SIZE, filteredProducts.length));
      setIsLoadingMore(false);
    }, 150);
  }, [isLoadingMore, displayedLimit, filteredProducts.length]);

  // Manual bottom button trigger (4.5s delay with loading indicator)
  const handleManualLoadMore = useCallback(() => {
    if (isLoadingMore || displayedLimit >= filteredProducts.length) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setDisplayedLimit(prev => Math.min(prev + BATCH_SIZE, filteredProducts.length));
      setIsLoadingMore(false);
    }, 4500);
  }, [isLoadingMore, displayedLimit, filteredProducts.length]);

  // Card item renderer for FlatList
  const renderProductCard = useCallback(({ item }: { item: any }) => {
    const hasCustomImage = item.image_url && 
      typeof item.image_url === 'string' && 
      item.image_url.trim().length > 10 && 
      item.image_url.startsWith('http') && 
      !isDarkPlaceholderUrl(item.image_url);

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('ProductDetail', { product: item })}
        activeOpacity={0.9}
        style={[
          styles.productCard,
          {
            width: CARD_WIDTH,
            borderColor: isDarkMode ? '#27422f' : '#d2dcd5',
          },
        ]}
      >
        {/* Base Layer: Category-Specific Local Image (ALWAYS VISIBLE GUARANTEED FALLBACK) */}
        <Image
          source={getCategoryBg(item.category)}
          style={styles.cardFullBgImage}
          resizeMode="cover"
          fadeDuration={0}
        />

        {/* Top Layer: Custom Remote Image if available */}
        {hasCustomImage && (
          <Image
            source={{ uri: item.image_url.trim() }}
            style={styles.cardFullBgImage}
            resizeMode="cover"
            fadeDuration={0}
          />
        )}

        {/* Subtle Light Black Overlay Gradient */}
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.82)']}
          style={styles.fullCardOverlay}
        >
        {/* Top: Category Pill + Emoji */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={styles.categoryPillGlass}>
            <Text style={styles.categoryPillText}>{item.category}</Text>
          </View>
          <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
        </View>

        {/* Middle: Title + Subtitle */}
        <View style={{ marginTop: 8 }}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>

          {item.dosage ? (
            <Text style={styles.cardSubText} numberOfLines={1}>
              {item.dosage}
            </Text>
          ) : (
            <Text style={styles.cardSubText} numberOfLines={1}>
              Stock: {item.stock} {item.unit || 'units'}
            </Text>
          )}
        </View>

        {/* Bottom: Price + Add to Cart Button */}
        <View style={{ marginTop: 'auto' }}>
          <Text style={styles.priceTag}>
            {item.price}
          </Text>

          <TouchableOpacity
            onPress={() => {
              addToCart(item);
              Alert.alert(
                language === 'ne' ? 'झोलामा थपियो!' : 'Added!',
                language === 'ne' ? `${item.title} झोलामा जोडिएको छ।` : `${item.title} added to cart.`
              );
            }}
            style={[styles.addBtnRight, { backgroundColor: colors.brandGreen }]}
            activeOpacity={0.8}
          >
            <Ionicons name="cart" size={14} color="#ffffff" />
            <Text style={styles.addBtnText}>
              {language === 'ne' ? 'थप्नुहोस्' : 'Add to Cart'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableOpacity>
    );
  }, [isDarkMode, colors, language, addToCart, navigation]);

  // List Header Component
  const renderListHeader = () => (
    <View>
      {/* Search Input Bar */}
      <View style={{ paddingTop: 8, paddingBottom: 4 }}>
        <View style={[styles.searchBar, { backgroundColor: isDarkMode ? '#1a291f' : '#ffffff', borderColor: isDarkMode ? '#2d4a35' : '#e6e3d8' }]}>
          <Ionicons name="search" size={18} color={isDarkMode ? '#5a7a63' : '#9ca89e'} />
          <TextInput
            placeholder={language === 'ne' ? 'बीउ, मल, औजार वा कीटनाशक खोज्नुहोस्...' : 'Search 100+ seeds, fertilizers, tools...'}
            placeholderTextColor={isDarkMode ? '#5a7a63' : '#9ca89e'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: isDarkMode ? colors.text : COLORS.ink }]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={isDarkMode ? '#5a7a63' : '#9ca89e'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Horizontal Category Filter Pills */}
      <View style={{ paddingTop: 8, paddingBottom: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive
                      ? (isDarkMode ? colors.brandGreen : COLORS.forest900)
                      : (isDarkMode ? '#1a291f' : '#ffffff'),
                    borderColor: isActive
                      ? 'transparent'
                      : (isDarkMode ? '#2d4a35' : '#e2ded5'),
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isActive ? '#ffffff' : (isDarkMode ? '#8aab8f' : COLORS.inkSoft),
                    },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

    </View>
  );

  // List Footer Loader Component
  const renderListFooter = () => {
    if (displayedLimit < filteredProducts.length) {
      return (
        <TouchableOpacity onPress={handleManualLoadMore} style={styles.batchFooterLoader} activeOpacity={0.8}>
          <ActivityIndicator size="small" color={colors.brandGreen} />
          <Text style={[styles.batchFooterText, { color: isDarkMode ? '#81c784' : COLORS.forest700 }]}>
            {language === 'ne' ? 'सामग्री लोड हुँदैछ...' : 'loading the product'}
          </Text>
        </TouchableOpacity>
      );
    }
    if (filteredProducts.length > 0) {
      return (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: isDarkMode ? '#5a7a63' : '#a0b0a3' }}>
            ✓ All {filteredProducts.length} products loaded
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: isDarkMode ? colors.background : COLORS.paper }]} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={[styles.topHeader, { backgroundColor: isDarkMode ? colors.card : COLORS.paper, borderBottomColor: isDarkMode ? colors.border : '#e6e3d8' }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={isDarkMode ? colors.text : COLORS.forest900} />
          </TouchableOpacity>
          <Image source={BRAND_ICON} style={styles.headerLogo} resizeMode="contain" fadeDuration={0} />
          <View>
            <Text style={[styles.headerTitle, { color: isDarkMode ? colors.text : COLORS.forest900 }]}>
              {language === 'ne' ? 'सबै कृषि सामग्रीहरू' : 'All Products'}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: isDarkMode ? '#81c784' : COLORS.forest700 }}>
              {language === 'ne' ? 'चितवन कृषि भण्डार' : 'Chitwan Agri Store'}
            </Text>
          </View>
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
        </View>
      </View>

      {/* Main FlatList Container */}
      {loading ? (
        <SkeletonLoaderGrid isDarkMode={isDarkMode} language={language} colors={colors} />
      ) : (
        <FlatList
          data={visibleProducts}
          renderItem={renderProductCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 12 }}
          ListHeaderComponent={renderListHeader}
          ListFooterComponent={renderListFooter}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="leaf-outline" size={48} color={isDarkMode ? '#2d4a35' : '#c8d4cb'} />
              <Text style={[styles.emptyTitle, { color: isDarkMode ? colors.text : COLORS.ink }]}>
                {language === 'ne' ? 'कुनै सामग्री भेटिएन' : 'No Products Found'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>
                {language === 'ne' ? 'फिल्टर वा खोज बदल्नुहोस्' : 'Try searching for paddy, urea, sprayer or seeds'}
              </Text>
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          onEndReached={handleAutoLoadMore}
          onEndReachedThreshold={1.5}
          initialNumToRender={14}
          maxToRenderPerBatch={14}
          windowSize={7}
          removeClippedSubviews={true}
        />
      )}

      {/* Cart Drawer */}
      <CartModal visible={cartModalVisible} onClose={() => setCartModalVisible(false)} />
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
    gap: 10,
    flex: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogo: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bagBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bagBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  bagBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  productCard: {
    height: 195,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
    backgroundColor: '#1b2d20',
  },
  cardFullBgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  fullCardOverlay: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  categoryPillGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  categoryPillText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardSubText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 10,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  priceTag: {
    color: '#81c784',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 6,
  },
  addBtnRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    alignSelf: 'flex-end',
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  batchFooterLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  batchFooterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  manualLoadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1b382b',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginVertical: 14,
    alignSelf: 'center',
  },
  manualLoadText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800',
  },
});
