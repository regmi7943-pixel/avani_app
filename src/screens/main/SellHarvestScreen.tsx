import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  FlatList,
  Platform,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useTheme } from '../../lib/ThemeContext';
import { supabase } from '../../lib/supabase';
import { uploadImageToCloudinary } from '../../lib/cloudinary';

const { width: SW, height: SH } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'grains', labelEn: 'Grains & Paddy', icon: '🌾' },
  { id: 'vegetables', labelEn: 'Vegetables & Leafy Greens', icon: '🥬' },
  { id: 'fruits', labelEn: 'Fresh Fruits', icon: '🍎' },
  { id: 'pulses', labelEn: 'Pulses & Legumes', icon: '🫘' },
  { id: 'spices', labelEn: 'Spices & Condiments', icon: '🌶️' },
  { id: 'oilseeds', labelEn: 'Oilseeds & Mustard', icon: '🌻' },
  { id: 'dairy', labelEn: 'Dairy & Milk Products', icon: '🥛' },
  { id: 'honey', labelEn: 'Honey & Organic Bee Goods', icon: '🍯' },
  { id: 'cashcrops', labelEn: 'Cash Crops & Tea Leaf', icon: '🍃' },
  { id: 'mushrooms', labelEn: 'Organic Mushrooms', icon: '🍄' },
  { id: 'herbs', labelEn: 'Medicinal Herbs & Plants', icon: '🌿' },
  { id: 'nuts', labelEn: 'Nuts & Dry Fruits', icon: '🥜' },
  { id: 'poultry', labelEn: 'Poultry & Farm Eggs', icon: '🥚' },
  { id: 'fodder', labelEn: 'Livestock Feed & Fodder', icon: '🌾' },
  { id: 'tubers', labelEn: 'Tubers, Potato & Roots', icon: '🥔' },
  { id: 'fertilizer', labelEn: 'Organic Compost & Fertilizer', icon: '🪴' },
  { id: 'timber', labelEn: 'Plantation & Nursery Saplings', icon: '🌱' },
  { id: 'processed', labelEn: 'Processed Agricultural Goods', icon: '🧃' },
];

const UNITS = ['quintal', 'kg', 'sack', 'bag', 'crate', 'litre'];

type FeatureTab = 'home' | 'wizard' | 'harvests' | 'orders' | 'settings';

export default function SellHarvestScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  // Dynamic Layout Safe Area Math
  const topInsetMath = Math.max(insets.top, Platform.OS === 'android' ? 8 : 12);
  const bottomInsetMath = Math.max(insets.bottom, 12);

  // Feature Navigation Tab (Home Dashboard is default)
  const [activeTab, setActiveTab] = useState<FeatureTab>('home');

  // Step-by-step Quick Add Produce Wizard state (Step 1 to 4)
  const [currentStep, setCurrentStep] = useState(1);

  // Form Fields (English Only)
  const [cropName, setCropName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('grains');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('quintal');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('Bharatpur, Chitwan');
  const [farmName, setFarmName] = useState('Madi Organic Field');
  const [farmerName, setFarmerName] = useState('');
  const [farmerPhone, setFarmerPhone] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Category Dropdown Search & Sort State
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isSearchHeaderOpen, setIsSearchHeaderOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [categorySortOrder, setCategorySortOrder] = useState<'popular' | 'asc' | 'desc'>('popular');

  // Farmer's posted harvests list
  const [myHarvests, setMyHarvests] = useState<any[]>([]);
  const [loadingHarvests, setLoadingHarvests] = useState(false);
  const [wholesaleOrders, setWholesaleOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    async function loadWholesaleOrders() {
      setLoadingOrders(true);
      try {
        const { data, error } = await (supabase as any)
          .from('orders')
          .select('*')
          .eq('order_type', 'wholesale_produce')
          .order('created_at', { ascending: false });
        if (!error && data) {
          setWholesaleOrders(data);
        }
      } catch (e) {
        console.error('Error fetching wholesale orders:', e);
      } finally {
        setLoadingOrders(false);
      }
    }
    loadWholesaleOrders();
  }, []);

  const [detectingLocation, setDetectingLocation] = useState(false);

  const fetchCurrentGPSLocation = async () => {
    setDetectingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const [address] = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (address) {
          const area = address.district || address.subregion || address.city || address.region || 'Chitwan';
          const street = address.street || address.name || (address as any).sublocality || '';
          const fullLoc = street ? `${street}, ${area}` : area;
          if (fullLoc.trim()) {
            setLocation(fullLoc.trim());
          }
        }
      }
    } catch (e) {
      console.warn('GPS location error:', e);
    } finally {
      setDetectingLocation(false);
    }
  };

  // Load User Profile & GPS Location
  useEffect(() => {
    async function loadUserProfile() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const user = session.user;
          const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '';
          const phone = user.user_metadata?.phone || user.phone || '+977-9855012345';
          if (name) setFarmerName(name);
          if (phone) setFarmerPhone(phone);

          const { data } = await supabase
            .from('fields')
            .select('name, location_name')
            .eq('user_id', user.id)
            .limit(1)
            .single();

          if (data) {
            if (data.name) setFarmName(data.name);
            if (data.location_name) setLocation(data.location_name);
          }
        }
      } catch (e) {}
    }
    loadUserProfile();
    fetchCurrentGPSLocation();
    fetchMyHarvests();
  }, []);

  // Edit Harvest Modal State
  const [selectedHarvest, setSelectedHarvest] = useState<any | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editStock, setEditStock] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editImageUri, setEditImageUri] = useState('');
  const [updatingEditImage, setUpdatingEditImage] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Success Modal State
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [publishedCropDetails, setPublishedCropDetails] = useState<any | null>(null);

  // Fetch Listed Harvests with AsyncStorage Caching
  const fetchMyHarvests = async () => {
    setLoadingHarvests(true);
    try {
      const cached = await AsyncStorage.getItem('cached_my_harvests');
      if (cached) {
        setMyHarvests(JSON.parse(cached));
      }

      const { data } = await (supabase as any)
        .from('produce')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        setMyHarvests(data);
        await AsyncStorage.setItem('cached_my_harvests', JSON.stringify(data));
      }
    } catch (e) {
      console.warn('Error fetching harvests:', e);
    } finally {
      setLoadingHarvests(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'harvests' || activeTab === 'home') {
      fetchMyHarvests();
    }
  }, [activeTab]);

  const openEditHarvestModal = (item: any) => {
    setSelectedHarvest(item);
    setEditStock(String(item.stock ?? 0));
    setEditPrice(String(item.price ?? ''));
    setEditDescription(item.description || '');
    setEditImageUri(item.image_url || '');
    setIsEditModalVisible(true);
  };

  const handlePickEditImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Media permissions needed to select an image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUpdatingEditImage(true);
        const selectedUri = result.assets[0].uri;
        const uploadedUrl = await uploadImageToCloudinary(selectedUri);
        setEditImageUri(uploadedUrl || selectedUri);
      }
    } catch (e: any) {
      Alert.alert('Image Pick Error', e.message || 'Could not pick image');
    } finally {
      setUpdatingEditImage(false);
    }
  };

  const handleSaveHarvestEdits = async () => {
    if (!selectedHarvest) return;
    setSavingEdit(true);
    try {
      const parsedStock = Math.max(0, parseInt(editStock, 10) || 0);
      const parsedPrice = parseFloat(editPrice) || Number(selectedHarvest.price);

      const updatePayload = {
        stock: parsedStock,
        price: parsedPrice,
        description: editDescription,
        image_url: editImageUri || selectedHarvest.image_url,
        yield_label: `${parsedStock} ${selectedHarvest.unit || 'kg'} available`,
        is_active: parsedStock > 0,
      };

      const { error } = await (supabase as any)
        .from('produce')
        .update(updatePayload)
        .eq('id', selectedHarvest.id);

      if (error) throw error;

      Alert.alert('Harvest Updated! ✅', 'Your stock, image, and description were saved live to Supabase.');
      setIsEditModalVisible(false);
      fetchMyHarvests();
    } catch (err: any) {
      Alert.alert('Update Failed ❌', err.message || 'Could not update harvest.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera roll permissions are required to select photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingImage(true);
        const selectedUri = result.assets[0].uri;
        const uploadedUrl = await uploadImageToCloudinary(selectedUri);
        setImageUri(uploadedUrl || selectedUri);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to select image.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Step Validation & Navigation
  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!cropName.trim()) {
        Alert.alert('Missing Crop Name', 'Please enter crop name.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) {
        Alert.alert('Invalid Quantity', 'Please enter quantity.');
        return;
      }
      if (!price || isNaN(Number(price)) || Number(price) <= 0) {
        Alert.alert('Invalid Price', 'Please enter wholesale price.');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(4);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      setActiveTab('home');
    }
  };

  const startQuickAddWizard = (presetCrop?: string, presetCat?: string) => {
    if (presetCrop) setCropName(presetCrop);
    if (presetCat) setSelectedCategory(presetCat);
    setCurrentStep(1);
    setIsCategoryDropdownOpen(false);
    setActiveTab('wizard');
  };

  // Filtered & Sorted Categories for Dropdown
  const getFilteredCategories = () => {
    let list = CATEGORIES.filter(c => 
      c.labelEn.toLowerCase().includes(categorySearchQuery.toLowerCase())
    );

    if (categorySortOrder === 'asc') {
      list.sort((a, b) => a.labelEn.localeCompare(b.labelEn));
    } else if (categorySortOrder === 'desc') {
      list.sort((a, b) => b.labelEn.localeCompare(a.labelEn));
    }
    return list;
  };

  // Submit Harvest to Supabase
  const handleSubmitHarvest = async () => {
    setSubmitting(true);
    try {
      console.log('🌾 Initiating harvest publication...');
      let farmerId: string | null = null;
      const fName = farmerName.trim() || 'Avani Registered Farmer';

      const { data: existingFarmer, error: farmerCheckErr } = await (supabase as any)
        .from('farmers')
        .select('id')
        .eq('name', fName)
        .maybeSingle();

      if (farmerCheckErr) {
        console.warn('⚠️ Farmer check notice:', farmerCheckErr);
      }

      if (existingFarmer) {
        farmerId = existingFarmer.id;
      } else {
        const { data: newFarmer, error: farmerCreateErr } = await (supabase as any)
          .from('farmers')
          .insert([{
            name: fName,
            farm: farmName.trim() || 'Organic Farm',
            location: location.trim() || 'Chitwan, Nepal',
            since: 2022,
            quote: 'Direct harvest delivery via Avani Agritech Platform',
            is_active: true
          }])
          .select('id')
          .single();

        if (farmerCreateErr) {
          console.warn('⚠️ Farmer create notice:', farmerCreateErr);
        } else if (newFarmer) {
          farmerId = newFarmer.id;
        }
      }

      const cleanSlug = cropName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'harvest';
      const uniqueSlug = `${cleanSlug}-${Math.floor(1000 + Math.random() * 9000)}`;

      const producePayload: any = {
        slug: uniqueSlug,
        name: cropName.trim(),
        nepali_name: cropName.trim(),
        category_id: selectedCategory,
        price: Math.round(Number(price)),
        unit: unit,
        stock: Math.round(Number(quantity)),
        location: location.trim() || 'Chitwan, Nepal',
        farm: farmName.trim() || 'Local Farm',
        farmer_id: farmerId,
        description: description.trim() || `${cropName.trim()} freshly harvested from ${farmName.trim()}. Direct wholesale order available.`,
        story: `${cropName.trim()} grown locally with organic care.`,
        tags: ['Direct from farm', 'Fresh Harvest'],
        rating: 5.0,
        review_count: 0,
        harvest: 'Harvested this week',
        yield_label: `${quantity} ${unit} available`,
        is_featured: true,
        is_active: true,
        image_url: imageUri || null,
        tile_a: '#e3e8e0',
        tile_b: '#c0ccb8'
      };

      console.log('📦 Direct produce table insert payload:', producePayload);

      const { data: insertedData, error: insertErr } = await (supabase as any)
        .from('produce')
        .insert([producePayload])
        .select();

      if (insertErr) {
        console.error('❌ Direct produce insert failed:', insertErr);
        
        // Attempt RPC fallback
        console.log('🔄 Attempting RPC fallback insert_produce_listing...');
        const { error: rpcErr } = await (supabase as any).rpc('insert_produce_listing', {
          p_name: cropName.trim(),
          p_nepali_name: cropName.trim(),
          p_category_id: selectedCategory,
          p_price: Math.round(Number(price)),
          p_unit: unit,
          p_stock: Math.round(Number(quantity)),
          p_description: description.trim() || 'Fresh wholesale harvest',
          p_location: location.trim(),
          p_farm: farmName.trim(),
        });

        if (rpcErr) {
          console.error('❌ RPC fallback failed:', rpcErr);
          throw new Error(insertErr.message || rpcErr.message || 'Database error: Could not insert produce listing.');
        }
      }

      console.log('✅ Harvest successfully published to Supabase database!', insertedData);

      setPublishedCropDetails({
        name: cropName,
        quantity,
        unit,
        price,
        location,
        category: selectedCatObj.labelEn,
        icon: selectedCatObj.icon,
      });
      setIsSuccessModalVisible(true);
    } catch (err: any) {
      console.error('💥 Publish Harvest Error:', err);
      Alert.alert(
        'Publishing Failed ❌',
        err.message || 'Could not publish harvest to database. Please check your network connection.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCatObj = CATEGORIES.find(c => c.id === selectedCategory) || CATEGORIES[0];
  const totalStockValue = myHarvests.reduce((sum, item) => sum + (item.price * item.stock), 0);

  // Dynamic Real Database Category Metrics for Chart
  const categoryStats = CATEGORIES.slice(0, 6).map((cat) => {
    const catItems = myHarvests.filter((item) => item.category_id === cat.id);
    const totalStock = catItems.reduce((acc, item) => acc + (Number(item.stock) || 0), 0);
    const totalVal = catItems.reduce((acc, item) => acc + ((Number(item.price) || 0) * (Number(item.stock) || 0)), 0);
    return {
      ...cat,
      count: catItems.length,
      totalStock,
      totalVal,
    };
  });
  const maxCategoryVal = Math.max(...categoryStats.map((c) => c.totalVal), 1);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
      {/* Top Header Bar with Dynamic Notch & Safe Area Inset Math */}
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: Math.max(topInsetMath * 0.2, 4) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={Math.min(SW * 0.06, 24)} color={colors.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: colors.text, fontSize: Math.min(SW * 0.04, 15) }]}>
            {activeTab === 'home' && 'Harvest Home Dashboard'}
            {activeTab === 'wizard' && 'Quick Add Produce'}
            {activeTab === 'harvests' && 'Your Harvest Listings'}
            {activeTab === 'orders' && 'Wholesale Buyer Orders'}
            {activeTab === 'settings' && 'Seller Profile Settings'}
          </Text>
          <Text style={{ fontSize: Math.min(SW * 0.028, 11), color: colors.brandGreen, fontWeight: '700' }}>
            Avani Wholesale Hub
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.quickAddHeaderBtn} 
          onPress={() => startQuickAddWizard()}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={Math.min(SW * 0.065, 26)} color={colors.brandGreen} />
        </TouchableOpacity>
      </View>

      {/* TAB 1: HOME DASHBOARD */}
      {activeTab === 'home' && (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + bottomInsetMath }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Welcome Banner Card */}
          <View style={[styles.dashboardBannerCard, { backgroundColor: isDarkMode ? '#1e3825' : '#eaf6f0', borderColor: colors.brandGreen }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: Math.min(SW * 0.03, 12), fontWeight: '800', color: colors.brandGreen }}>
                WELCOME, FARMER
              </Text>
              <Text style={[styles.bannerTitle, { color: colors.text, fontSize: Math.min(SW * 0.04, 16) }]}>
                Sell Harvest Directly to Wholesale Distributors
              </Text>
              <Text style={{ fontSize: Math.min(SW * 0.03, 11.5), color: colors.secondaryText, marginTop: 4 }}>
                List your crops on Avani Web Portal with 0% middleman commission.
              </Text>

              {/* Big Primary Action: Quick Add Produce */}
              <TouchableOpacity
                style={[styles.primaryAddBtn, { backgroundColor: colors.brandGreen }]}
                onPress={() => startQuickAddWizard()}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={Math.min(SW * 0.055, 22)} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryAddBtnText}>
                  + Quick Add Produce
                </Text>
              </TouchableOpacity>
            </View>

            <Image
              source={require('../../../assets/images/avatar_thinking.png')}
              style={[styles.bannerMascotImg, { width: Math.min(SW * 0.2, 75), height: Math.min(SW * 0.2, 75) }]}
              resizeMode="contain"
            />
          </View>

          {/* Metrics Bento Grid */}
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16 }]}>
            📊 Wholesale Overview
          </Text>

          <View style={styles.bentoGridRow}>
            <View style={[styles.bentoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.bentoIconBg, { backgroundColor: '#eaf6f0' }]}>
                <Ionicons name="leaf-outline" size={20} color={colors.brandGreen} />
              </View>
              <Text style={styles.bentoValue}>{myHarvests.length}</Text>
              <Text style={[styles.bentoLabel, { color: colors.secondaryText }]}>
                Active Listings
              </Text>
            </View>

            <View style={[styles.bentoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.bentoIconBg, { backgroundColor: '#fef3e6' }]}>
                <Ionicons name="cash-outline" size={20} color="#e65100" />
              </View>
              <Text style={styles.bentoValue}>
                NPR {totalStockValue > 0 ? `${Math.round(totalStockValue / 1000)}k` : '0'}
              </Text>
              <Text style={[styles.bentoLabel, { color: colors.secondaryText }]}>
                Est. Stock Value
              </Text>
            </View>
          </View>

          {/* Dynamic Real Crop Category Inventory Chart */}
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 18 }]}>
            📊 Crop Distribution
          </Text>

          <View style={[styles.chartContainerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: Math.min(SW * 0.045, 18), fontWeight: '900', color: colors.brandGreen }}>
                NPR {totalStockValue.toLocaleString()}
              </Text>
              <View style={styles.chartGrowthBadge}>
                <Ionicons name="pulse-outline" size={13} color="#2e7d32" />
                <Text style={{ fontSize: 11, fontWeight: '900', color: '#2e7d32', marginLeft: 4 }}>
                  {myHarvests.length} Crops
                </Text>
              </View>
            </View>

            {/* Dynamic Visual Bar Chart */}
            <View style={[styles.chartBarTrackRow, { height: Math.min(SH * 0.16, 140) }]}>
              {categoryStats.map((cat) => {
                const fillPercent = totalStockValue > 0 ? Math.max(Math.round((cat.totalVal / maxCategoryVal) * 100), 8) : 8;
                const isSelected = cat.count > 0;
                return (
                  <View key={cat.id} style={styles.chartBarCol}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: isSelected ? colors.brandGreen : colors.secondaryText, marginBottom: 4 }}>
                      {cat.totalVal > 0 ? `${Math.round(cat.totalVal / 1000)}k` : '0'}
                    </Text>
                    <View style={styles.barBackground}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: `${fillPercent}%` as any,
                            backgroundColor: isSelected ? colors.brandGreen : (isDarkMode ? '#2d4a36' : '#d0e5d8'),
                          }
                        ]}
                      />
                    </View>
                    <Text style={{ fontSize: 16, marginTop: 6 }}>{cat.icon}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}

      {/* TAB 2: STEP-BY-STEP QUICK ADD PRODUCE (RESPONSIVE IN-SCREEN LAYOUT) */}
      {activeTab === 'wizard' && (
        <View style={{ flex: 1 }}>
          {/* Step Progress Bar */}
          <View style={styles.wizardProgressContainer}>
            <View style={styles.stepHeaderRow}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.brandGreen }}>
                STEP {currentStep} OF 4
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.secondaryText }}>
                {currentStep === 1 && 'Crop Identity & Category'}
                {currentStep === 2 && 'Quantity & Price'}
                {currentStep === 3 && 'Location & Photo'}
                {currentStep === 4 && 'Review & Publish'}
              </Text>
            </View>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(currentStep / 4) * 100}%`, backgroundColor: colors.brandGreen }]} />
            </View>
          </View>

          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + bottomInsetMath }]}
            showsVerticalScrollIndicator={false}
          >
            {/* STEP 1: CROP NAME & SEARCHABLE DROPDOWN CATEGORY */}
            {currentStep === 1 && (
              <View style={styles.stepCard}>
                <View style={styles.stepBanner}>
                  <Text style={{ fontSize: 32 }}>🌾</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stepBannerTitle, { color: colors.text }]}>
                      What crop are you harvesting?
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.secondaryText }}>
                      Enter crop title and select category
                    </Text>
                  </View>
                </View>

                <Text style={[styles.inputLabel, { color: colors.secondaryText, marginTop: 14 }]}>
                  Crop Name (English) *
                </Text>
                <TextInput
                  style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: isDarkMode ? '#233328' : '#F9FBF8' }]}
                  placeholder="e.g. Organic Paddy, Fresh Tomato, Wheat Seeds"
                  placeholderTextColor={colors.secondaryText}
                  value={cropName}
                  onChangeText={setCropName}
                  autoFocus
                />

                {/* SELECT CROP CATEGORY HEADER ROW WITH INLINE SEARCH BUTTON */}
                <View style={[styles.categoryHeaderRow, { marginTop: 16 }]}>
                  {!isSearchHeaderOpen ? (
                    <>
                      <Text style={[styles.inputLabel, { color: colors.secondaryText, marginBottom: 0 }]}>
                        Select Crop Category *
                      </Text>

                      <TouchableOpacity
                        style={[styles.headerSearchIconBtn, { backgroundColor: isDarkMode ? '#1e3825' : '#eaf6f0' }]}
                        onPress={() => {
                          setIsSearchHeaderOpen(true);
                          setIsCategoryDropdownOpen(true);
                        }}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="search" size={14} color={colors.brandGreen} style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 11, fontWeight: '800', color: colors.brandGreen }}>
                          Search Category
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={[styles.headerAnimatedSearchBox, { backgroundColor: isDarkMode ? '#233328' : '#F4F7F2', borderColor: colors.brandGreen }]}>
                      <Ionicons name="search" size={15} color={colors.brandGreen} style={{ marginRight: 6 }} />
                      <TextInput
                        style={[styles.headerSearchInput, { color: colors.text }]}
                        placeholder="Search 18+ categories..."
                        placeholderTextColor={colors.secondaryText}
                        value={categorySearchQuery}
                        onChangeText={(text) => {
                          setCategorySearchQuery(text);
                          if (!isCategoryDropdownOpen) setIsCategoryDropdownOpen(true);
                        }}
                        autoFocus
                      />
                      <TouchableOpacity
                        onPress={() => {
                          setIsSearchHeaderOpen(false);
                          setCategorySearchQuery('');
                        }}
                        style={{ padding: 2 }}
                      >
                        <Ionicons name="close-circle" size={18} color={colors.secondaryText} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Attached Category Dropdown Trigger */}
                <TouchableOpacity
                  style={[
                    styles.attachedDropdownTrigger,
                    {
                      borderColor: isCategoryDropdownOpen ? colors.brandGreen : colors.border,
                      backgroundColor: isDarkMode ? '#233328' : '#F9FBF8',
                      borderBottomLeftRadius: isCategoryDropdownOpen ? 0 : 14,
                      borderBottomRightRadius: isCategoryDropdownOpen ? 0 : 14,
                    }
                  ]}
                  onPress={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 20, marginRight: 8 }}>{selectedCatObj.icon}</Text>
                  <Text style={[styles.dropdownSelectedText, { color: colors.text }]}>
                    {selectedCatObj.labelEn}
                  </Text>
                  <Ionicons
                    name={isCategoryDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.secondaryText}
                  />
                </TouchableOpacity>

                {/* Attached Standard Category Dropdown Panel */}
                {isCategoryDropdownOpen && (
                  <View style={[styles.attachedDropdownPanel, { backgroundColor: colors.card, borderColor: colors.brandGreen }]}>
                    {/* Scrollable Category Options */}
                    <ScrollView style={{ maxHeight: Math.min(SH * 0.32, 230) }} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                      {getFilteredCategories().map((cat) => {
                        const isSelected = selectedCategory === cat.id;
                        return (
                          <TouchableOpacity
                            key={cat.id}
                            style={[
                              styles.dropdownItemRow,
                              isSelected && { backgroundColor: isDarkMode ? '#1e3825' : '#eaf6f0' }
                            ]}
                            onPress={() => {
                              setSelectedCategory(cat.id);
                              setIsCategoryDropdownOpen(false);
                              setIsSearchHeaderOpen(false);
                            }}
                          >
                            <Text style={{ fontSize: 20, marginRight: 10 }}>{cat.icon}</Text>
                            <Text style={[styles.dropdownItemText, { color: isSelected ? colors.brandGreen : colors.text }]}>
                              {cat.labelEn}
                            </Text>
                            {isSelected && <Ionicons name="checkmark-circle" size={18} color={colors.brandGreen} />}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            {/* STEP 2 */}
            {currentStep === 2 && (
              <View style={styles.stepCard}>
                <View style={styles.stepBanner}>
                  <Text style={{ fontSize: 32 }}>💰</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stepBannerTitle, { color: colors.text }]}>
                      Quantity & Wholesale Price
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.secondaryText }}>
                      Set your available harvest quantity & price per unit
                    </Text>
                  </View>
                </View>

                <Text style={[styles.inputLabel, { color: colors.secondaryText, marginTop: 14 }]}>
                  Total Available Quantity *
                </Text>
                <TextInput
                  style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: isDarkMode ? '#233328' : '#F9FBF8' }]}
                  placeholder="e.g. 50"
                  keyboardType="numeric"
                  placeholderTextColor={colors.secondaryText}
                  value={quantity}
                  onChangeText={setQuantity}
                />

                <Text style={[styles.inputLabel, { color: colors.secondaryText, marginTop: 12 }]}>
                  Measurement Unit *
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {UNITS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[
                        styles.unitPill,
                        {
                          backgroundColor: unit === u ? colors.brandGreen : (isDarkMode ? '#233328' : '#F0F4EF'),
                          borderColor: unit === u ? colors.brandGreen : colors.border
                        }
                      ]}
                      onPress={() => setUnit(u)}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: unit === u ? '#FFFFFF' : colors.text }}>
                        {u.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.inputLabel, { color: colors.secondaryText, marginTop: 16 }]}>
                  Wholesale Price per {unit} (NPR) *
                </Text>
                <TextInput
                  style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: isDarkMode ? '#233328' : '#F9FBF8' }]}
                  placeholder="e.g. 4500"
                  keyboardType="numeric"
                  placeholderTextColor={colors.secondaryText}
                  value={price}
                  onChangeText={setPrice}
                />
              </View>
            )}

            {/* STEP 3 */}
            {currentStep === 3 && (
              <View style={styles.stepCard}>
                <View style={styles.stepBanner}>
                  <Text style={{ fontSize: 32 }}>📍</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stepBannerTitle, { color: colors.text }]}>
                      Farm Origin & Crop Photo
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.secondaryText }}>
                      Pickup location & optional crop photo
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 4 }}>
                  <Text style={[styles.inputLabel, { color: colors.secondaryText, marginBottom: 0 }]}>
                    Farm Location / District *
                  </Text>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: isDarkMode ? '#1e3825' : '#eaf6f0' }}
                    onPress={fetchCurrentGPSLocation}
                    disabled={detectingLocation}
                    activeOpacity={0.7}
                  >
                    {detectingLocation ? (
                      <ActivityIndicator size="small" color={colors.brandGreen} />
                    ) : (
                      <>
                        <Ionicons name="location-sharp" size={13} color={colors.brandGreen} />
                        <Text style={{ fontSize: 11, fontWeight: '800', color: colors.brandGreen }}>
                          Detect GPS Location
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: isDarkMode ? '#233328' : '#F9FBF8' }]}
                  placeholder="e.g. Madi, Chitwan"
                  placeholderTextColor={colors.secondaryText}
                  value={location}
                  onChangeText={setLocation}
                />

                <Text style={[styles.inputLabel, { color: colors.secondaryText, marginTop: 12 }]}>
                  Harvest Description
                </Text>
                <TextInput
                  style={[styles.textInput, { height: 75, color: colors.text, borderColor: colors.border, backgroundColor: isDarkMode ? '#233328' : '#F9FBF8', textAlignVertical: 'top', paddingTop: 8 }]}
                  placeholder="e.g. Cleaned and sun-dried paddy ready for truck dispatch."
                  multiline
                  placeholderTextColor={colors.secondaryText}
                  value={description}
                  onChangeText={setDescription}
                />

                <Text style={[styles.inputLabel, { color: colors.secondaryText, marginTop: 14 }]}>
                  Crop Photo (Optional)
                </Text>
                <TouchableOpacity
                  style={[styles.photoBox, { borderColor: colors.brandGreen, backgroundColor: isDarkMode ? '#1e3023' : '#f2f8f4' }]}
                  onPress={handlePickImage}
                  activeOpacity={0.8}
                >
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color={colors.brandGreen} />
                  ) : imageUri ? (
                    <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%', borderRadius: 12 }} resizeMode="cover" />
                  ) : (
                    <View style={{ alignItems: 'center', gap: 4 }}>
                      <Ionicons name="camera-outline" size={28} color={colors.brandGreen} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.brandGreen }}>
                        Tap to Upload Crop Photo
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 4 */}
            {currentStep === 4 && (
              <View style={styles.stepCard}>
                <View style={styles.stepBanner}>
                  <Text style={{ fontSize: 32 }}>📋</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stepBannerTitle, { color: colors.text }]}>
                      Review & Confirm Listing
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.secondaryText }}>
                      Verify harvest info before publishing
                    </Text>
                  </View>
                </View>

                {/* Summary Card */}
                <View style={[styles.summaryCard, { backgroundColor: isDarkMode ? '#1a2e21' : '#eaf6f0', borderColor: colors.brandGreen }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 36 }}>{selectedCatObj.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>{cropName}</Text>
                      <Text style={{ fontSize: 12, color: colors.brandGreen, fontWeight: '700', marginTop: 2 }}>{selectedCatObj.labelEn}</Text>
                    </View>
                  </View>

                  <View style={styles.summaryDivider} />

                  <View style={styles.summaryRow}>
                    <Text style={{ fontSize: 12, color: colors.secondaryText }}>Quantity Available</Text>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: colors.brandGreen }}>{quantity} {unit}</Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={{ fontSize: 12, color: colors.secondaryText }}>Wholesale Unit Price</Text>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: colors.brandGreen }}>NPR {price} / {unit}</Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={{ fontSize: 12, color: colors.secondaryText }}>Farm Location</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{location}</Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={{ fontSize: 12, color: colors.secondaryText }}>Seller Farmer</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{farmerName || 'Registered Farmer'}</Text>
                  </View>
              </View>
              </View>
            )}
          </ScrollView>

          {/* FIXED POSITION BOTTOM CONTROL BAR WITH SAFE AREA INSET MATH */}
          <View style={[
            styles.wizardFixedBottomBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: bottomInsetMath,
            }
          ]}>
            {/* Back Button (Returns to Home tab on Step 1) */}
            <TouchableOpacity
              style={[styles.wizardBackFixedBtn, { borderColor: colors.border }]}
              onPress={handlePrevStep}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={16} color={colors.text} />
              <Text style={[styles.controlBtnText, { color: colors.text }]}>Back</Text>
            </TouchableOpacity>

            {currentStep < 4 ? (
              <TouchableOpacity
                style={[styles.wizardNextFixedBtn, { backgroundColor: colors.brandGreen }]}
                onPress={handleNextStep}
                activeOpacity={0.85}
              >
                <Text style={styles.controlBtnNextText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.wizardNextFixedBtn, { backgroundColor: colors.brandGreen }]}
                onPress={handleSubmitHarvest}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.controlBtnNextText}>Publish Listing</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* TAB 3: YOUR HARVESTS LIST */}
      {activeTab === 'harvests' && (
        <View style={{ flex: 1, padding: 16 }}>
          {loadingHarvests ? (
            <ActivityIndicator size="large" color={colors.brandGreen} style={{ marginTop: 40 }} />
          ) : myHarvests.length === 0 ? (
            <View style={[styles.emptyHarvestContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.emptyMascotWrapper}>
                <View style={[styles.emptyMascotGlowCircle, { backgroundColor: isDarkMode ? '#1a3324' : '#eaf6f0' }]} />
                <Image
                  source={require('../../../assets/images/avatar_thinking.png')}
                  style={styles.emptyMascotImg}
                  resizeMode="contain"
                />
              </View>

              <Text style={[styles.emptyHarvestTitle, { color: colors.text }]}>
                No Harvests Listed Yet
              </Text>
              <Text style={[styles.emptyHarvestSubtitle, { color: colors.secondaryText }]}>
                Start selling your crop yield directly to verified wholesale distributors across Nepal with zero middleman commissions.
              </Text>

              <TouchableOpacity
                style={[styles.emptyPrimaryBtn, { backgroundColor: colors.brandGreen }]}
                onPress={() => startQuickAddWizard()}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={22} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.emptyPrimaryBtnText}>
                  List Your First Harvest
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={myHarvests}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.harvestListItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => openEditHarvestModal(item)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    {item.image_url ? (
                      <Image source={{ uri: item.image_url }} style={{ width: 44, height: 44, borderRadius: 12 }} />
                    ) : (
                      <Text style={{ fontSize: 32 }}>🌾</Text>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{item.name}</Text>
                      <Text style={{ fontSize: 12, color: colors.secondaryText }}>{item.location || 'Chitwan'}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: item.stock > 0 ? colors.brandGreen : '#e53e3e', marginTop: 2 }}>
                        NPR {item.price} / {item.unit || 'kg'} • Stock: {item.stock} {item.stock === 0 ? '(Sold Out)' : ''}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <View style={[styles.liveBadge, { backgroundColor: item.stock > 0 ? '#eaf6f0' : '#fee2e2' }]}>
                        <Text style={[styles.liveBadgeText, { color: item.stock > 0 ? colors.brandGreen : '#e53e3e' }]}>
                          {item.stock > 0 ? 'LIVE ON WEB' : 'SOLD OUT'}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.brandGreen }}>
                        ✏️ Tap to edit
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}

      {/* TAB 4: ORDERS */}
      {activeTab === 'orders' && (
        <View style={{ flex: 1, padding: 16 }}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>
            📦 Wholesale Distributor Purchase Orders
          </Text>
          {loadingOrders ? (
            <ActivityIndicator size="small" color={colors.brandGreen} style={{ marginTop: 20 }} />
          ) : wholesaleOrders.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 }}>
              <Ionicons name="cube-outline" size={48} color={colors.brandGreen} />
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 12 }}>
                No Wholesale Orders Yet
              </Text>
              <Text style={{ fontSize: 12, color: colors.secondaryText, textAlign: 'center', marginTop: 4, paddingHorizontal: 20 }}>
                Direct buyer purchase orders from Avani Distributor Portal will appear here in real time.
              </Text>
            </View>
          ) : (
            <FlatList
              data={wholesaleOrders}
              keyExtractor={(item) => item.id || item.order_number}
              renderItem={({ item }) => (
                <View style={[styles.harvestListItem, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 12 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.brandGreen }}>
                      {item.order_number}
                    </Text>
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveBadgeText}>WHOLESALE PRODUCE</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 6 }}>
                    {item.product_title}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.brandGreen, marginTop: 2 }}>
                    {item.total_price} • Customer: {item.farmer_name || 'Buyer'}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 4 }}>
                    📍 Delivery: {item.delivery_address || 'Chitwan'} • Phone: {item.farmer_phone}
                  </Text>
                </View>
              )}
            />
          )}
        </View>
      )}

      {/* TAB 5: SETTINGS */}
      {activeTab === 'settings' && (() => {
        const realSales = wholesaleOrders.reduce((sum: number, order: any) => {
          const num = Number(String(order.total_price || '').replace(/[^0-9.]/g, '')) || 0;
          return sum + num;
        }, 0);
        const activeCount = myHarvests.filter((item: any) => item.is_active !== false).length;
        return (
          <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
            {/* Net Sales Overview Card */}
            <View style={[styles.dashboardBannerCard, { backgroundColor: isDarkMode ? '#1e3825' : '#eaf6f0', borderColor: colors.brandGreen, marginBottom: 16 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.brandGreen, letterSpacing: 0.8 }}>
                  WHOLESALE NET SALES (COMPLETED ORDERS)
                </Text>
                <Text style={{ fontSize: 26, fontWeight: '900', color: colors.text, marginTop: 2 }}>
                  NPR {realSales.toLocaleString()}
                </Text>
                <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 4 }}>
                  {wholesaleOrders.length} Sold Orders • {activeCount} Active Crops Listed
                </Text>
              </View>
              <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: colors.brandGreen }}>
                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>Live DB 🚀</Text>
              </View>
            </View>

          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              ⚙️ Farmer Seller Profile
            </Text>

            <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Seller Name</Text>
            <TextInput
              style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: isDarkMode ? '#233328' : '#F9FBF8' }]}
              value={farmerName}
              onChangeText={setFarmerName}
            />

            <Text style={[styles.inputLabel, { color: colors.secondaryText, marginTop: 12 }]}>Seller Contact Phone</Text>
            <TextInput
              style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: isDarkMode ? '#233328' : '#F9FBF8' }]}
              value={farmerPhone}
              onChangeText={setFarmerPhone}
            />
          </View>
        </ScrollView>
        );
      })()}

      {/* FEATURE BOTTOM NAVIGATION TAB BAR WITH DYNAMIC SAFE AREA INSET MATH */}
      {activeTab !== 'wizard' && (
        <View style={[
          styles.featureTabBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: bottomInsetMath,
            height: 52 + bottomInsetMath,
          }
        ]}>
          <TouchableOpacity
            style={styles.featureTabBtn}
            onPress={() => setActiveTab('home')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'home' ? 'home' : 'home-outline'}
              size={22}
              color={activeTab === 'home' ? colors.brandGreen : colors.secondaryText}
            />
            <Text style={[styles.featureTabLabel, { color: activeTab === 'home' ? colors.brandGreen : colors.secondaryText }]}>
              Home
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.featureTabBtn}
            onPress={() => setActiveTab('harvests')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'harvests' ? 'leaf' : 'leaf-outline'}
              size={22}
              color={activeTab === 'harvests' ? colors.brandGreen : colors.secondaryText}
            />
            <Text style={[styles.featureTabLabel, { color: activeTab === 'harvests' ? colors.brandGreen : colors.secondaryText }]}>
              My Harvests
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.featureTabBtn}
            onPress={() => setActiveTab('orders')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'orders' ? 'cube' : 'cube-outline'}
              size={22}
              color={activeTab === 'orders' ? colors.brandGreen : colors.secondaryText}
            />
            <Text style={[styles.featureTabLabel, { color: activeTab === 'orders' ? colors.brandGreen : colors.secondaryText }]}>
              Orders
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.featureTabBtn}
            onPress={() => setActiveTab('settings')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'settings' ? 'settings' : 'settings-outline'}
              size={22}
              color={activeTab === 'settings' ? colors.brandGreen : colors.secondaryText}
            />
            <Text style={[styles.featureTabLabel, { color: activeTab === 'settings' ? colors.brandGreen : colors.secondaryText }]}>
              Settings
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── EDIT HARVEST MODAL ── */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={[styles.formCard, { backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, maxHeight: '90%', borderTopWidth: 2, borderTopColor: colors.brandGreen }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDarkMode ? '#1e3825' : '#eaf6f0', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="create" size={20} color={colors.brandGreen} />
                </View>
                <View>
                  <Text style={{ fontSize: 17, fontWeight: '900', color: colors.text }}>
                    Edit Harvest Listing
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.brandGreen }}>
                    {selectedHarvest?.name}
                  </Text>
                </View>
              </View>

              <TouchableOpacity onPress={() => setIsEditModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={28} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Photo Upload Section */}
              <TouchableOpacity
                onPress={handlePickEditImage}
                activeOpacity={0.8}
                style={{ alignItems: 'center', marginVertical: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.brandGreen, borderRadius: 20, padding: 16, backgroundColor: isDarkMode ? '#1a2e21' : '#f0f9f4' }}
              >
                {updatingEditImage ? (
                  <ActivityIndicator size="small" color={colors.brandGreen} />
                ) : editImageUri ? (
                  <View style={{ alignItems: 'center' }}>
                    <Image source={{ uri: editImageUri }} style={{ width: 150, height: 105, borderRadius: 14 }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, backgroundColor: colors.brandGreen, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                      <Ionicons name="camera" size={13} color="#FFF" />
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFF' }}>Change Photo</Text>
                    </View>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: isDarkMode ? '#23442e' : '#dcfce7', justifyContent: 'center', alignItems: 'center', marginBottom: 6 }}>
                      <Ionicons name="camera" size={24} color={colors.brandGreen} />
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>Upload Crop Photo</Text>
                    <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 2 }}>Tap to choose high quality harvest image</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Stock Input Card */}
              <View style={{ backgroundColor: isDarkMode ? '#203327' : '#F9FBF8', padding: 14, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: colors.brandGreen, marginVertical: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.brandGreen }}>AVAILABLE STOCK ({selectedHarvest?.unit?.toUpperCase() || 'KG'})</Text>
                <TextInput
                  style={{ color: colors.text, fontWeight: '900', fontSize: 20, marginTop: 4, paddingVertical: 4 }}
                  keyboardType="numeric"
                  value={editStock}
                  onChangeText={setEditStock}
                  placeholder="e.g. 50"
                  placeholderTextColor={colors.secondaryText}
                />
              </View>

              {/* Price Input Card */}
              <View style={{ backgroundColor: isDarkMode ? '#203327' : '#F9FBF8', padding: 14, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: colors.brandGreen, marginVertical: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.brandGreen }}>WHOLESALE PRICE (NPR / {selectedHarvest?.unit?.toUpperCase() || 'KG'})</Text>
                <TextInput
                  style={{ color: colors.text, fontWeight: '900', fontSize: 20, marginTop: 4, paddingVertical: 4 }}
                  keyboardType="numeric"
                  value={editPrice}
                  onChangeText={setEditPrice}
                  placeholder="e.g. 500"
                  placeholderTextColor={colors.secondaryText}
                />
              </View>

              {/* Description Input Card */}
              <View style={{ backgroundColor: isDarkMode ? '#203327' : '#F9FBF8', padding: 14, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: colors.brandGreen, marginVertical: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.brandGreen }}>HARVEST NOTES & DESCRIPTION</Text>
                <TextInput
                  style={{ color: colors.text, fontSize: 14, marginTop: 6, minHeight: 70, textAlignVertical: 'top' }}
                  multiline
                  numberOfLines={3}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Describe farm origin, harvest quality, packaging..."
                  placeholderTextColor={colors.secondaryText}
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSaveHarvestEdits}
                disabled={savingEdit}
                activeOpacity={0.85}
                style={[styles.emptyPrimaryBtn, { backgroundColor: colors.brandGreen, marginTop: 14, marginBottom: 20, height: 50, borderRadius: 25, shadowColor: colors.brandGreen, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }]}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={22} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={[styles.emptyPrimaryBtnText, { fontSize: 15, fontWeight: '900' }]}>Save & Publish Changes Live</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── HARVEST PUBLISHED SUCCESS VICTORY MODAL ── */}
      <Modal
        visible={isSuccessModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsSuccessModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 360, backgroundColor: colors.card, borderRadius: 28, padding: 24, alignItems: 'center', borderWidth: 2, borderColor: colors.brandGreen, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 15, elevation: 8 }}>
            
            {/* Celebration Icon Header */}
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: isDarkMode ? '#1e3825' : '#dcfce7', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 42 }}>🚀</Text>
            </View>

            {/* Badge */}
            <View style={{ backgroundColor: colors.brandGreen, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 12 }}>
              <Text style={{ fontSize: 10, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 }}>LIVE ON WEB PORTAL</Text>
            </View>

            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text, textAlign: 'center' }}>
              Harvest Published!
            </Text>
            <Text style={{ fontSize: 13, color: colors.secondaryText, textAlign: 'center', marginTop: 6, paddingHorizontal: 10 }}>
              Your crop listing is now live for wholesale buyers and distributors across Nepal.
            </Text>

            {/* Crop Info Summary Chip */}
            {publishedCropDetails && (
              <View style={{ width: '100%', backgroundColor: isDarkMode ? '#1e3023' : '#f0f9f4', borderRadius: 16, padding: 14, marginVertical: 16, borderLeftWidth: 4, borderLeftColor: colors.brandGreen }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 24 }}>{publishedCropDetails.icon || '🌾'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: colors.text }}>{publishedCropDetails.name}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.brandGreen, marginTop: 2 }}>
                      {publishedCropDetails.quantity} {publishedCropDetails.unit} • NPR {publishedCropDetails.price} / {publishedCropDetails.unit}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 2 }}>
                      📍 {publishedCropDetails.location}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Primary Action Button */}
            <TouchableOpacity
              style={{ width: '100%', height: 48, borderRadius: 24, backgroundColor: colors.brandGreen, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6, marginBottom: 10 }}
              onPress={() => {
                setIsSuccessModalVisible(false);
                setCropName('');
                setQuantity('');
                setPrice('');
                setDescription('');
                setImageUri(null);
                setCurrentStep(1);
                setActiveTab('harvests');
                fetchMyHarvests();
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="leaf" size={18} color="#FFF" />
              <Text style={{ fontSize: 14, fontWeight: '900', color: '#FFF' }}>View My Harvest Listings</Text>
            </TouchableOpacity>

            {/* Secondary Action Button */}
            <TouchableOpacity
              style={{ width: '100%', height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}
              onPress={() => {
                setIsSuccessModalVisible(false);
                setCropName('');
                setQuantity('');
                setPrice('');
                setDescription('');
                setImageUri(null);
                setCurrentStep(1);
                setActiveTab('wizard');
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>+ Add Another Harvest</Text>
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
    paddingHorizontal: Math.min(SW * 0.04, 16),
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAddHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: Math.min(SW * 0.04, 16),
    paddingTop: 14,
  },
  dashboardBannerCard: {
    padding: Math.min(SW * 0.04, 16),
    borderRadius: 20,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
    lineHeight: 20,
  },
  bannerMascotImg: {
    width: 75,
    height: 75,
  },
  primaryAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 12,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  primaryAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  bentoGridRow: {
    flexDirection: 'row',
    gap: Math.round(SW * 0.025),
    marginTop: 6,
  },
  bentoBox: {
    flex: 1,
    padding: Math.min(SW * 0.035, 14),
    borderRadius: 16,
    borderWidth: 1,
  },
  bentoIconBg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  bentoValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  bentoLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  chartContainerCard: {
    padding: Math.min(SW * 0.04, 16),
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 6,
  },
  chartGrowthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  chartBarTrackRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 10,
  },
  chartBarCol: {
    alignItems: 'center',
    flex: 1,
  },
  barBackground: {
    width: Math.min(SW * 0.06, 24),
    height: '70%',
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 12,
  },

  categoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    height: 36,
  },
  headerSearchIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  headerAnimatedSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  headerSearchInput: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    paddingVertical: 0,
  },
  attachedDropdownTrigger: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  dropdownSelectedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  attachedDropdownPanel: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderWidth: 1.5,
    borderTopWidth: 0,
    marginTop: 0,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  dropdownSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 8,
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
  },
  sortPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sortPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  sortPillText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  dropdownItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  dropdownItemText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },

  /* Wizard Styles */
  wizardProgressContainer: {
    paddingHorizontal: Math.min(SW * 0.04, 16),
    paddingTop: 10,
    paddingBottom: 6,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E0ECE3',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  stepCard: {
    gap: 12,
  },
  stepBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  stepBannerTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  formCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  unitPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  photoBox: {
    height: 110,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    overflow: 'hidden',
  },
  summaryCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    gap: 10,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  publishBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  publishBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
  wizardFixedBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Math.min(SW * 0.04, 16),
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  wizardCancelFixedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#fff1f0',
  },
  wizardCancelFixedText: {
    color: '#d32f2f',
    fontSize: 12.5,
    fontWeight: '800',
  },
  wizardBackFixedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  wizardNextFixedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 12,
  },
  wizardControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  controlBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  controlBtnNext: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 12,
  },
  controlBtnNextText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },

  /* Feature Tab Bar Styles */
  featureTabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingHorizontal: Math.min(SW * 0.02, 12),
  },
  featureTabBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTabLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 2,
  },

  emptyHarvestContainer: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyMascotWrapper: {
    width: Math.min(SW * 0.3, 120),
    height: Math.min(SW * 0.3, 120),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  emptyMascotGlowCircle: {
    position: 'absolute',
    width: '90%',
    height: '90%',
    borderRadius: 55,
  },
  emptyMascotImg: {
    width: '85%',
    height: '85%',
  },
  emptyHarvestTitle: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyHarvestSubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  emptyPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  emptyPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  harvestListItem: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  liveBadge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  liveBadgeText: {
    color: '#2e7d32',
    fontSize: 9.5,
    fontWeight: '900',
  },
});
