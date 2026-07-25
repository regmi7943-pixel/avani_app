import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Dimensions,
  Image,
  ScrollView,
  Alert,
  Animated,
  Easing,
  TextInput,
  Modal,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../lib/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { identifyAndDiagnose, hasApiKeys } from '../../services/plantApi';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { uploadImageToCloudinary } from '../../lib/cloudinary';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Mock Plant Identification Database
const PLANT_DB = [
  { id: 'p1', name: 'Rice (Paddy)', botanicalName: 'Oryza sativa' },
  { id: 'p2', name: 'Wheat', botanicalName: 'Triticum aestivum' },
  { id: 'p3', name: 'Maize (Corn)', botanicalName: 'Zea mays' },
  { id: 'p4', name: 'Potato', botanicalName: 'Solanum tuberosum' },
  { id: 'p5', name: 'Mustard', botanicalName: 'Brassica juncea' },
];

// Mock Disease Identification Database (linked by plant_id)
const DISEASE_DB = {
  'p1': [
    { 
      name: 'Rice Blast', 
      cause: 'Magnaporthe oryzae (Fungus)',
      symptoms: 'Spindle-shaped lesions with grayish centers on leaves; neck rot that turns brown/black and causes heads to fall over.',
      treatment: 'Apply tricyclazole or carbendazim fungicides. Avoid excessive nitrogen fertilizer. Plant resistant varieties.',
      urgency: 'high'
    },
    { 
      name: 'Bacterial Leaf Blight', 
      cause: 'Xanthomonas oryzae (Bacteria)',
      symptoms: 'Linear yellow-to-white stripes starting from leaf tips; wavy margins; leaves dry up and turn grey.',
      treatment: 'Use copper hydroxide spray. Drain the field to reduce humidity. Keep fields clean from weeds.',
      urgency: 'high'
    },
    {
      name: 'Healthy Crop',
      cause: 'Optimal growth conditions',
      symptoms: 'Vibrant green leaves, strong stalks, and normal growth pattern with no visible lesions or discoloration.',
      treatment: 'Maintain current water levels and periodic weeding. No chemical treatment required.',
      urgency: 'low'
    }
  ],
  'p2': [
    { 
      name: 'Wheat Rust (Yellow/Strip)', 
      cause: 'Puccinia striiformis (Fungus)',
      symptoms: 'Yellow-orange pustules arranged in long stripes along the veins of wheat leaves.',
      treatment: 'Use propiconazole fungicide spray. Rotate crops. Apply balanced fertilizer.',
      urgency: 'high'
    },
    {
      name: 'Healthy Crop',
      cause: 'Optimal growth conditions',
      symptoms: 'Sturdy golden-green leaves and heads, no rust spots, uniform crop height.',
      treatment: 'Regular irrigation and monitoring. No chemical treatment required.',
      urgency: 'low'
    }
  ],
  'p3': [
    { 
      name: 'Maize Northern Leaf Blight', 
      cause: 'Exserohilum turcicum (Fungus)',
      symptoms: 'Long, elliptical, grayish-green or tan lesions on leaves, resembling cigar shapes.',
      treatment: 'Spray mancozeb or azoxystrobin. Till crop residues after harvest. Rotate crops.',
      urgency: 'medium'
    },
    {
      name: 'Healthy Crop',
      cause: 'Optimal growth conditions',
      symptoms: 'Broad, strong green leaves, healthy tassels, robust stalk support.',
      treatment: 'Standard soil nourishment and irrigation. No treatment needed.',
      urgency: 'low'
    }
  ],
  'p4': [
    { 
      name: 'Late Blight of Potato', 
      cause: 'Phytophthora infestans (Oomycete)',
      symptoms: 'Dark water-soaked lesions on leaves with white mold growth on the undersides during humid weather.',
      treatment: 'Apply metalaxyl or mancozeb sprays immediately. Destroy infected plants. Avoid overhead watering.',
      urgency: 'critical'
    },
    {
      name: 'Healthy Crop',
      cause: 'Optimal growth conditions',
      symptoms: 'Clean green leaflets and white/purple blossoms, no leaf spot or stem rot.',
      treatment: 'Ensure good soil drainage and hilling. No treatment needed.',
      urgency: 'low'
    }
  ],
  'p5': [
    { 
      name: 'Alternaria Black Spot', 
      cause: 'Alternaria brassicae (Fungus)',
      symptoms: 'Concentric dark spots on leaves, stems, and pods; spots can merge and cause defoliation.',
      treatment: 'Apply iprodione or copper oxychloride. Keep plants spaced. Use clean seeds.',
      urgency: 'medium'
    },
    {
      name: 'Healthy Crop',
      cause: 'Optimal growth conditions',
      symptoms: 'Bright yellow flowers and healthy green foliage with no black spots.',
      treatment: 'Ensure proper watering and solarization. No treatment needed.',
      urgency: 'low'
    }
  ]
};

export default function ScanScreen() {
  const navigation = useNavigation();
  const { colors, isDarkMode } = useTheme();
  const { t } = useLanguage();
  const [permission, requestPermission] = useCameraPermissions();
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanStage, setScanStage] = useState<'plant_id' | 'disease_id'>('plant_id');
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStepText, setScanStepText] = useState('');
  
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [detectedPlant, setDetectedPlant] = useState<{ id: string; name: string; botanicalName: string } | null>(null);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const [recommendedItems, setRecommendedItems] = useState<any[]>([]);
  const [assignedVet, setAssignedVet] = useState<any | null>(null);
  const [locationName, setLocationName] = useState('Madi, Chitwan');
  
  // Checkout Modal states
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [orderQuantity, setOrderQuantity] = useState('1');
  const [ordering, setOrdering] = useState(false);

  // Fetch local pesticides/fertilizers when scanResult changes
  useEffect(() => {
    async function loadRecommendedTreatments() {
      if (!scanResult || scanResult.disease.name.includes('Healthy')) {
        setRecommendedItems([]);
        return;
      }
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: fields } = await (supabase as any)
            .from('fields')
            .select('location_name')
            .eq('user_id', user.id)
            .limit(1);
            
          const location = (fields && fields.length > 0 && fields[0].location_name) 
            ? fields[0].location_name 
            : 'Madi, Chitwan';
            
          setLocationName(location);
          
          const { data: items } = await (supabase as any)
            .from('marketplace_items')
            .select('*')
            .eq('assigned_area', location);
            
          if (items) {
            // Filter: Categories: Pesticides or Fertilizer
            const treatments = items.filter((item: any) => 
              item.category === 'Pesticides' || item.category === 'Fertilizer'
            );
            setRecommendedItems(treatments);
          }
          
          // Get Vet
          const { data: vets } = await (supabase as any)
            .from('vets')
            .select('*')
            .eq('assigned_area', location)
            .limit(1);
            
          if (vets && vets.length > 0) {
            setAssignedVet(vets[0]);
          } else {
            setAssignedVet(null);
          }
        }
      } catch (err) {
        console.warn('Failed to load scan-based recommendations', err);
      }
    }
    loadRecommendedTreatments();
  }, [scanResult]);
  
  const cameraRef = useRef<any>(null);
  const scanAnim = useRef(new Animated.Value(0)).current;

  // Camera check
  const handleRequestPermission = async () => {
    const status = await requestPermission();
    if (!status.granted) {
      Alert.alert(t('scanResults.permissionDenied'), t('scanResults.cameraPermissionDesc'));
    }
  };

  const startScanAnimation = () => {
    scanAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // Image Selection from Library
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('scanResults.permissionDenied'), t('scanResults.galleryPermissionDesc'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setCapturedImage(uri);
      runDualStageScan(uri);
    }
  };

  // Capture Image from Camera Shutter
  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
        });
        if (photo && photo.uri) {
          setCapturedImage(photo.uri);
          runDualStageScan(photo.uri);
        }
      } catch (err) {
        console.warn('Camera capture error:', err);
        // Fallback for emulator / simulator
        runDualStageScan(null);
      }
    } else {
      runDualStageScan(null);
    }
  };

  // Run the Dual Stage Identification & Diagnostic Flow
  const runDualStageScan = async (imageUri: string | null) => {
    if (!imageUri) return;

    setIsScanning(true);
    setScanStage('plant_id');
    setScanProgress(0);
    setDetectedPlant(null);
    setScanResult(null);
    setScanError(null);
    startScanAnimation();

    const scanSteps = [
      'Scanning leaf outline geometry...',
      'Isolating target leaf veins...',
      'Matching botanical database taxonomy...',
      'Resolving crop characteristics...',
      'Checking pathology indexes...',
      'Scanning for necrotic spots & rust lesions...',
      'Cross-referencing pathogen databases...',
      'Contacting localized disease nodes...',
      'Finalizing treatment advice...',
    ];

    // Upload to Cloudinary in background
    let uploadedImageUrl = imageUri;
    uploadImageToCloudinary(imageUri).then((url) => {
      if (url) uploadedImageUrl = url;
    }).catch(console.warn);

    // Start background progress simulation (animates to 90% while waiting for network)
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      if (currentProgress < 90) {
        currentProgress += 2;
        setScanProgress(currentProgress);
        const textIdx = Math.floor((currentProgress / 100) * scanSteps.length);
        setScanStepText(scanSteps[Math.min(textIdx, scanSteps.length - 1)]);
      }
    }, 250); // Reaches 90% in ~11 seconds

    // ── Call API in Parallel to the Loading Animation ──
    if (hasApiKeys) {
      try {
        const apiResult = await identifyAndDiagnose(imageUri);
        
        clearInterval(progressInterval);

        if (apiResult.error) {
          setScanError(apiResult.error);
          setIsScanning(false);
          scanAnim.stopAnimation();
          return;
        }

        // Complete the stages with visual delay for futuristic experience
        setScanProgress(100);
        setScanStepText('Analysis complete!');
        setDetectedPlant({
          id: 'api',
          name: apiResult.plantName || 'Crop',
          botanicalName: apiResult.botanicalName || '',
        });

        setTimeout(() => {
          scanAnim.stopAnimation();
          setIsScanning(false);
          setScanResult({
            plant: { name: apiResult.plantName || 'Crop', botanicalName: apiResult.botanicalName || '' },
            disease: {
              name: apiResult.diseaseName,
              cause: apiResult.cause,
              symptoms: apiResult.symptoms,
              treatment: apiResult.treatment,
              urgency: apiResult.urgency,
              nepaliName: apiResult.nepaliName,
            },
            confidence: apiResult.confidence?.toString() || '90',
            image: uploadedImageUrl,
          });
        }, 600);

      } catch (err: any) {
        clearInterval(progressInterval);
        setScanError(err.message || 'An error occurred during analysis.');
        setIsScanning(false);
        scanAnim.stopAnimation();
      }
      return;
    }

    // Fallback: Local database mock scanner logic
    clearInterval(progressInterval);
    const plantSteps = [
      'Scanning leaf outline geometry...',
      'Isolating target leaf veins...',
      'Matching botanical database taxonomy...',
      'Resolving crop characteristics...',
    ];

    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setScanProgress(Math.min(progress, 100));
      const textIdx = Math.floor((progress / 100) * plantSteps.length);
      setScanStepText(plantSteps[Math.min(textIdx, plantSteps.length - 1)]);

      if (progress >= 100) {
        clearInterval(interval);

        // First step finished: Select plant
        const randomPlant = PLANT_DB[Math.floor(Math.random() * PLANT_DB.length)];
        setDetectedPlant(randomPlant);

        // Pause briefly, then transition to Stage 2: Disease ID
        setTimeout(() => {
          setScanStage('disease_id');
          setScanProgress(0);

          const diseaseSteps = [
            `Plant confirmed: ${randomPlant.name}`,
            'Checking leaf chlorophyll index...',
            'Scanning for necrotic spots & rust lesions...',
            'Cross-referencing pathogen databases...',
            'Drafting agricultural recommendation...',
          ];

          let diseaseProgress = 0;
          const diseaseInterval = setInterval(() => {
            diseaseProgress += 4;
            setScanProgress(Math.min(diseaseProgress, 100));
            const dTextIdx = Math.floor((diseaseProgress / 100) * diseaseSteps.length);
            setScanStepText(diseaseSteps[Math.min(dTextIdx, diseaseSteps.length - 1)]);

            if (diseaseProgress >= 100) {
              clearInterval(diseaseInterval);
              scanAnim.stopAnimation();
              setIsScanning(false);

              const diseases = DISEASE_DB[randomPlant.id as keyof typeof DISEASE_DB];
              const isHealthy = Math.random() > 0.7;
              const selectedDisease = isHealthy
                ? diseases.find(d => d.name === 'Healthy Crop') || diseases[diseases.length - 1]
                : diseases[Math.floor(Math.random() * (diseases.length - 1))];

              setScanResult({
                plant: randomPlant,
                disease: selectedDisease,
                confidence: (84 + Math.random() * 14).toFixed(1),
                image: uploadedImageUrl,
              });
            }
          }, 100);
        }, 1000);
      }
    }, 80);
  };

  const handleReset = () => {
    setScanResult(null);
    setCapturedImage(null);
    setDetectedPlant(null);
    setIsScanning(false);
  };

  const scanLineTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 246]
  });

  // 1. Permission request screen if not granted
  if (!permission || !permission.granted) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.container}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('scanResults.cropDiagnostician')}</Text>
          <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
            {t('scanResults.cropDiagnosticianDesc')}
          </Text>

          <View style={[styles.permissionCard, { backgroundColor: colors.card }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.inputBg }]}>
              <Ionicons name="scan" size={48} color={colors.brandGreen} />
            </View>
            <Text style={[styles.permissionTitle, { color: colors.text }]}>{t('scanResults.cameraAccessRequired')}</Text>
            <Text style={[styles.permissionDescription, { color: colors.secondaryText }]}>
              {t('scanResults.cameraAccessDesc')}
            </Text>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.brandGreen }]} onPress={handleRequestPermission}>
              <Text style={styles.primaryButtonText}>{t('scanResults.enableCamera')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // 2. Scan Results Screen
  if (scanResult) {
    const isHealthy = scanResult.disease.name.includes('Healthy');
    const urgencyColor = 
      scanResult.disease.urgency === 'low' ? '#2E7D32' : 
      scanResult.disease.urgency === 'medium' ? '#EF6C00' : '#C62828';
    const urgencyBg = 
      scanResult.disease.urgency === 'low' ? '#E8F5E9' : 
      scanResult.disease.urgency === 'medium' ? '#FFF3E0' : '#FFEBEE';

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.container}>
          {/* TopAppBar */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={handleReset} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.brandGreen, fontWeight: '900' }]}>{t('scanResults.scanResultsHeader')}</Text>
            <TouchableOpacity onPress={handleReset} style={styles.backBtn}>
              <Ionicons name="camera-outline" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.resultContainerNew} showsVerticalScrollIndicator={false}>
            {/* Scanned Image Card */}
            {scanResult.image && (
              <View style={[styles.imageCardNew, { borderColor: colors.border, borderBottomColor: isDarkMode ? '#1B272E' : '#CDCDCD' }]}>
                <Image source={{ uri: scanResult.image }} style={styles.resultImageNew} />
                <View style={styles.confidenceOverlayNew}>
                  <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.confidenceTextNew}>{scanResult.confidence}% {t('scanResults.confidence')}</Text>
                </View>
              </View>
            )}

            {/* Diagnosis Header */}
            <View style={[styles.resultHeaderCardNew, { backgroundColor: colors.card, borderColor: colors.border, borderBottomColor: isDarkMode ? '#1B272E' : '#CDCDCD' }]}>
              <View style={[styles.badgeNew, { backgroundColor: urgencyBg }]}>
                <Ionicons name="warning" size={12} color={urgencyColor} style={{ marginRight: 4 }} />
                <Text style={[styles.badgeTextNew, { color: urgencyColor }]}>
                  {t(`scanResults.${scanResult.disease.urgency}Urgency`)}
                </Text>
              </View>
              <Text style={[styles.resultTitleNew, { color: colors.text }]}>{scanResult.disease.name}</Text>
              
              {scanResult.disease.nepaliName ? (
                <Text style={styles.resultNepaliTitleNew}>
                  {scanResult.disease.nepaliName}
                </Text>
              ) : null}

              <View style={[styles.plantMetadataRowNew, { borderTopColor: colors.border }]}>
                <Ionicons name="leaf-outline" size={16} color={colors.secondaryText} style={{ marginRight: 6 }} />
                <Text style={[styles.resultSubNew, { color: colors.secondaryText }]}>
                  {scanResult.plant.name} • <Text style={{ fontFamily: 'Inter', fontStyle: 'italic' }}>{scanResult.plant.botanicalName || 'Oryza sativa'}</Text>
                </Text>
              </View>
            </View>

            {/* Info Cards Grid */}
            <View style={styles.infoCardsGridNew}>
              {/* Pathogen */}
              <View style={[styles.infoCardNew, { backgroundColor: colors.card, borderColor: colors.border, borderBottomColor: isDarkMode ? '#1B272E' : '#CDCDCD' }]}>
                <View style={[styles.infoIconBoxNew, { backgroundColor: colors.background }]}>
                  <Ionicons name="bug-outline" size={20} color={colors.accent} />
                </View>
                <View style={styles.infoTextContentNew}>
                  <Text style={[styles.infoCardLabelNew, { color: colors.text }]}>{t('scanResults.pathogenCause')}</Text>
                  <Text style={[styles.infoCardValNew, { color: colors.secondaryText }]}>{scanResult.disease.cause}</Text>
                </View>
              </View>

              {/* Symptoms */}
              <View style={[styles.infoCardNew, { backgroundColor: colors.card, borderColor: colors.border, borderBottomColor: isDarkMode ? '#1B272E' : '#CDCDCD' }]}>
                <View style={[styles.infoIconBoxNew, { backgroundColor: colors.background }]}>
                  <Ionicons name="eye-outline" size={20} color={colors.brandGreen} />
                </View>
                <View style={styles.infoTextContentNew}>
                  <Text style={[styles.infoCardLabelNew, { color: colors.text }]}>{t('scanResults.symptoms')}</Text>
                  <Text style={[styles.infoCardValNew, { color: colors.secondaryText }]}>{scanResult.disease.symptoms}</Text>
                </View>
              </View>

              {/* Treatment Plan */}
              <View style={[styles.infoCardNew, { backgroundColor: colors.card, borderColor: colors.brandGreen, borderBottomColor: colors.brandGreenDark }]}>
                <View style={[styles.infoIconBoxNew, { backgroundColor: 'rgba(107, 143, 94, 0.1)' }]}>
                  <Ionicons name="medical-outline" size={20} color={colors.brandGreen} />
                </View>
                <View style={styles.infoTextContentNew}>
                  <Text style={[styles.infoCardLabelNew, { color: colors.text }]}>{t('scanResults.treatmentPlan')}</Text>
                  <Text style={[styles.infoCardValNew, { color: colors.secondaryText }]}>{scanResult.disease.treatment}</Text>
                </View>
              </View>
            </View>

            {/* Recommended Pesticides */}
            {recommendedItems.length > 0 && (
              <View style={styles.localTreatmentsContainerNew}>
                <View style={styles.localTreatmentsHeaderNew}>
                  <Ionicons name="storefront-outline" size={20} color={colors.accent} style={{ marginRight: 6 }} />
                  <Text style={[styles.localTreatmentsTitleNew, { color: colors.accent }]}>
                    {t('scanResults.availableLocalTreatments')} ({locationName || 'Madi, Chitwan'})
                  </Text>
                </View>

                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  contentContainerStyle={styles.recommendationScrollNew}
                  style={{ marginTop: 12 }}
                >
                  {recommendedItems.map(item => (
                    <View 
                      key={item.id}
                      style={[styles.productCardNew, { borderColor: colors.border, backgroundColor: colors.card, borderBottomColor: isDarkMode ? '#1B272E' : '#CDCDCD' }]}
                    >
                      <View style={styles.productImageWrapperNew}>
                        <Image 
                          source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?q=80&w=300' }} 
                          style={styles.productImageNew} 
                          resizeMode="contain"
                        />
                      </View>
                      <View style={styles.productDetailsNew}>
                        <Text style={[styles.productTitleNew, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>
                        <Text style={[styles.productPriceNew, { color: colors.secondaryText }]}>Rs. {item.price} / {item.unit}</Text>
                        
                        <TouchableOpacity 
                          style={[styles.productBuyBtnNew, { backgroundColor: colors.card, borderColor: colors.brandGreen, borderBottomColor: colors.brandGreenDark }]}
                          onPress={() => {
                            setOrderQuantity('1');
                            setSelectedProduct(item);
                          }}
                        >
                          <Ionicons name="cart-outline" size={14} color={colors.brandGreen} style={{ marginRight: 4 }} />
                          <Text style={[styles.productBuyBtnTextNew, { color: colors.brandGreen }]}>{t('scanResults.buyNow')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Extra padding for sticky bottom */}
            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Sticky Bottom Action */}
          <View style={[styles.stickyBottomBarNew, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <TouchableOpacity 
              style={[styles.stickyBottomBtnNew, { backgroundColor: colors.brandGreen, borderColor: colors.brandGreenDark, borderBottomColor: '#3A5430' }]} 
              onPress={handleReset}
              activeOpacity={0.8}
            >
              <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.stickyBottomBtnTextNew}>{t('scanResults.scanAnother')}</Text>
            </TouchableOpacity>
          </View>

            {/* Checkout Modal */}
            <Modal visible={selectedProduct !== null} transparent animationType="slide">
              <View style={styles.modalOverlay}>
                <TouchableOpacity style={styles.modalDismiss} onPress={() => setSelectedProduct(null)} />
                <View style={[styles.checkoutCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {selectedProduct && (
                    <>
                      <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>{t('scanResults.confirmPurchase')}</Text>
                        <TouchableOpacity onPress={() => setSelectedProduct(null)}>
                          <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.checkoutSummary}>
                        <Text style={[styles.summaryName, { color: colors.text }]}>{selectedProduct.name}</Text>
                        <Text style={[styles.summaryPrice, { color: colors.text }]}>
                          Rs. {selectedProduct.price} / {selectedProduct.unit}
                        </Text>
                      </View>

                      <View style={styles.quantityContainer}>
                        <Text style={[styles.label, { color: colors.text }]}>{t('scanResults.quantityRequired')} ({selectedProduct.unit}):</Text>
                        <View style={styles.quantityRow}>
                          <TouchableOpacity 
                            onPress={() => setOrderQuantity(Math.max(1, Number(orderQuantity) - 1).toString())}
                            style={[styles.qtyBtn, { backgroundColor: colors.border }]}
                          >
                            <Ionicons name="remove" size={18} color={colors.text} />
                          </TouchableOpacity>
                          <TextInput
                            keyboardType="numeric"
                            value={orderQuantity}
                            onChangeText={setOrderQuantity}
                            style={[styles.qtyInput, { color: colors.text, borderColor: colors.border }]}
                          />
                          <TouchableOpacity 
                            onPress={() => setOrderQuantity((Number(orderQuantity) + 1).toString())}
                            style={[styles.qtyBtn, { backgroundColor: colors.border }]}
                          >
                            <Ionicons name="add" size={18} color={colors.text} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.subtotalRow}>
                        <Text style={[styles.subtotalLabel, { color: colors.secondaryText }]}>{t('scanResults.totalPrice')}:</Text>
                        <Text style={[styles.subtotalValue, { color: colors.text }]}>
                          Rs. {selectedProduct.price * (Number(orderQuantity) || 1)}
                        </Text>
                      </View>

                      <View style={[styles.vetContainer, { backgroundColor: colors.border }]}>
                        <Text style={[styles.vetHeader, { color: colors.secondaryText }]}>{t('scanResults.coordinatorDetails')}</Text>
                        {assignedVet ? (
                          <View style={styles.vetDetailsRow}>
                            <View style={styles.vetText}>
                              <Text style={[styles.vetName, { color: colors.text }]}>{assignedVet.full_name}</Text>
                              <Text style={[styles.vetPhone, { color: colors.secondaryText }]}>{t('scanResults.specialistOfficer')} • {assignedVet.phone}</Text>
                            </View>
                            <TouchableOpacity 
                              onPress={() => {
                                Linking.openURL(`tel:${assignedVet.phone}`).catch(() => {
                                  Alert.alert(t('scanResults.error'), t('scanResults.unableToCall'));
                                });
                              }}
                              style={[styles.callBtn, { backgroundColor: colors.brandGreen }]}
                            >
                              <Ionicons name="call" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <Text style={[styles.noVetText, { color: colors.secondaryText }]}>
                            {t('scanResults.noVetSpecialist')} {locationName}.
                          </Text>
                        )}
                      </View>

                      <View style={styles.checkoutActions}>
                        <TouchableOpacity 
                          onPress={() => setSelectedProduct(null)}
                          style={[styles.cancelBtn, { borderColor: colors.border }]}
                        >
                          <Text style={[styles.cancelBtnText, { color: colors.text }]}>{t('dashboard.cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => {
                            setOrdering(true);
                            setTimeout(() => {
                              setOrdering(false);
                              const alertTitle = t('scanResults.orderRequestSent');
                              const alertBody = t('scanResults.orderSubmittedDesc')
                                .replace('{qty}', orderQuantity)
                                .replace('{unit}', selectedProduct.unit)
                                .replace('{name}', selectedProduct.name)
                                .replace('{vetName}', assignedVet?.full_name || 'Assigned Vet')
                                .replace('{vetPhone}', assignedVet?.phone || 'N/A');
                              Alert.alert(
                                alertTitle,
                                alertBody,
                                [{ text: t('scanResults.ok'), onPress: () => setSelectedProduct(null) }]
                              );
                            }, 1500);
                          }}
                          disabled={ordering}
                          style={[styles.confirmBtn, { backgroundColor: colors.brandGreen }]}
                        >
                          {ordering ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.confirmBtnText}>{t('scanResults.requestOrder')}</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              </View>
            </Modal>
          </View>
        </SafeAreaView>
    );
  }

  // 3. Active Scanning UI
  return (
    <View style={styles.fullScreen}>
      {/* Show Camera Feed or Selected Gallery Image */}
      {capturedImage ? (
        <Image source={{ uri: capturedImage }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : (
        <CameraView style={StyleSheet.absoluteFillObject} facing="back" ref={cameraRef} />
      )}
      
      {/* Semi-transparent Dark Overlays */}
      <View style={styles.overlayTop}>
        <SafeAreaView edges={['top']}>
          <Text style={styles.overlayHeader}>AI Crop Diagnostician</Text>
          <Text style={styles.overlaySubtitle}>
            {isScanning ? 'Scanner sweep in progress...' : 'Align leaf within the guide marks'}
          </Text>
        </SafeAreaView>
      </View>

      {/* Futuristic Scan Area */}
      <View style={styles.centerScannerRow}>
        <View style={styles.overlaySide} />
        <View style={styles.scannerFrameContainer}>
          <View 
            style={[
              styles.cameraFrame,
              isScanning && {
                borderColor: scanStage === 'plant_id' ? '#FF9F0A50' : '#00E5FF50',
                backgroundColor: 'rgba(0, 0, 0, 0.2)'
              }
            ]}
          >
            {/* Guide Corners */}
            <View style={[styles.cornerTL, isScanning && { borderColor: scanStage === 'plant_id' ? '#FF9F0A' : '#00E5FF' }]} />
            <View style={[styles.cornerTR, isScanning && { borderColor: scanStage === 'plant_id' ? '#FF9F0A' : '#00E5FF' }]} />
            <View style={[styles.cornerBL, isScanning && { borderColor: scanStage === 'plant_id' ? '#FF9F0A' : '#00E5FF' }]} />
            <View style={[styles.cornerBR, isScanning && { borderColor: scanStage === 'plant_id' ? '#FF9F0A' : '#00E5FF' }]} />
            
            {/* Animated Laser Scanning Line */}
            {isScanning && (
              <Animated.View 
                style={[
                  styles.scanningLine,
                  {
                    backgroundColor: scanStage === 'plant_id' ? '#FF9F0A' : '#00E5FF',
                    shadowColor: scanStage === 'plant_id' ? '#FF9F0A' : '#00E5FF',
                    transform: [{ translateY: scanLineTranslateY }]
                  }
                ]} 
              />
            )}
            
            {/* Idle Scanner Icon */}
            {!isScanning && (
              <Ionicons name="scan-outline" size={64} color="rgba(255, 255, 255, 0.45)" />
            )}

            {/* Live Holographic Stats Overlay */}
            {isScanning && (
              <View style={styles.hudOverlay}>
                <Text style={styles.hudStageText}>
                  {scanStage === 'plant_id' ? 'STAGE 1: PLANT ID' : 'STAGE 2: PATHOLOGY'}
                </Text>
                <Text style={styles.hudProgressText}>{scanProgress}%</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.overlaySide} />
      </View>

      {/* Bottom Controls / Status Panel */}
      <View style={styles.overlayBottom}>
        {isScanning ? (
          <View style={styles.scanningLogsContainer}>
            <ActivityIndicator size="small" color={scanStage === 'plant_id' ? '#FF9F0A' : '#00E5FF'} style={{ marginBottom: 8 }} />
            <Text style={[styles.scanningLogHeader, { color: scanStage === 'plant_id' ? '#FF9F0A' : '#00E5FF' }]}>
              {scanStage === 'plant_id' ? 'IDENTIFYING SPECIES...' : 'DIAGNOSING HEALTH STATUS...'}
            </Text>
            <Text style={styles.scanningLogSub}>{scanStepText}</Text>
            {detectedPlant && scanStage === 'disease_id' && (
              <Text style={styles.detectedBadge}>✓ Species Match: {detectedPlant.name}</Text>
            )}
          </View>
        ) : (
          <View style={styles.controlsRow}>
            {/* Gallery Selector Button */}
            <TouchableOpacity style={[styles.galleryBtn, { borderColor: colors.border }]} onPress={pickImage}>
              <Ionicons name="images" size={24} color="#FFFFFF" />
              <Text style={styles.galleryBtnText}>Gallery</Text>
            </TouchableOpacity>

            {/* Shutter Shutter Trigger */}
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={[styles.captureButtonInner, { backgroundColor: colors.brandGreen }]}>
                <Ionicons name="scan" size={32} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <View style={{ width: 60, alignItems: 'center' }}>
              {capturedImage && (
                <TouchableOpacity onPress={handleReset} style={styles.resetMiniBtn}>
                  <Ionicons name="refresh" size={20} color="#FFFFFF" />
                  <Text style={styles.galleryBtnText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        <SafeAreaView edges={['bottom']} style={{ height: 16 }} />
      </View>

      {/* Custom Error Modal Overlay */}
      {scanError && (
        <View style={StyleSheet.absoluteFillObject}>
          <View style={styles.modalBackdrop} />
          <View style={styles.errorModalContainer}>
            <View style={[styles.errorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.errorIconCircle}>
                <Ionicons name="alert-circle" size={48} color="#FF3B30" />
              </View>
              <Text style={[styles.errorTitle, { color: colors.text }]}>Scan Failed</Text>
              <Text style={[styles.errorDescription, { color: colors.secondaryText }]}>{scanError}</Text>
              <TouchableOpacity 
                style={[styles.errorDismissButton, { backgroundColor: colors.brandGreen }]} 
                onPress={() => {
                  setScanError(null);
                  handleReset();
                }}
              >
                <Text style={styles.errorDismissText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  permissionCard: {
    borderRadius: 28,
    padding: 32,
    marginHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
    marginTop: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionDescription: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
  },
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignSelf: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  imageCard: {
    marginHorizontal: 24,
    height: 200,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
  },
  resultImage: {
    width: '100%',
    height: '100%',
  },
  confidenceOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  confidenceText: {
    color: '#00E5FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  resultContainer: {
    paddingBottom: 160,
    gap: 16,
  },
  resultHeaderCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 24,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  resultSub: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  infoCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    marginHorizontal: 24,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  infoVal: {
    fontSize: 14,
    fontWeight: '600',
  },
  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  overlayHeader: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 10,
  },
  overlaySubtitle: {
    fontSize: 13,
    color: '#BBBBBB',
    textAlign: 'center',
    marginTop: 4,
  },
  centerScannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 250,
    width: '100%',
    position: 'absolute',
    top: '30%',
  },
  overlaySide: {
    flex: 1,
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  scannerFrameContainer: {
    width: 250,
    height: 250,
  },
  cameraFrame: {
    width: 250,
    height: 250,
    backgroundColor: 'transparent',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  cornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 32,
    height: 32,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
  },
  cornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 32,
    height: 32,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
  },
  cornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 32,
    height: 32,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
  },
  cornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 32,
    height: 32,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
  },
  scanningLine: {
    position: 'absolute',
    top: 0,
    left: 4,
    right: 4,
    height: 4,
    borderRadius: 2,
    elevation: 8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  hudOverlay: {
    position: 'absolute',
    bottom: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  hudStageText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  hudProgressText: {
    color: '#00E5FF',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  overlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingTop: 24,
    paddingBottom: 140, // Elevated to sit comfortably above the CustomTabBar curve
    alignItems: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  galleryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  galleryBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  resetMiniBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  scanningLogsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  scanningLogHeader: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  scanningLogSub: {
    color: '#E0E0E0',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  detectedBadge: {
    color: '#81C784',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  errorModalContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorCard: {
    width: '100%',
    borderRadius: 28,
    borderWidth: 1.5,
    padding: 30,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  errorIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  errorDescription: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorDismissButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  errorDismissText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  recommendationScroll: {
    paddingVertical: 5,
    gap: 12,
  },
  recommendationCard: {
    width: 140,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 8,
    marginRight: 10,
    alignItems: 'center',
  },
  recommendationImage: {
    width: 124,
    height: 90,
    borderRadius: 10,
    objectFit: 'cover',
    marginBottom: 8,
  },
  recommendationTitle: {
    fontSize: 12,
    fontWeight: '800',
    width: '100%',
    textAlign: 'center',
    marginBottom: 2,
  },
  recommendationPrice: {
    fontSize: 10,
    fontWeight: '700',
    color: '#666c5d',
    marginBottom: 8,
  },
  recommendationBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  recommendationBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    flex: 1,
  },
  checkoutCard: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    borderTopWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  checkoutSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f2ec',
  },
  summaryName: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    marginRight: 10,
  },
  summaryPrice: {
    fontSize: 16,
    fontWeight: '900',
  },
  quantityContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    width: 60,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  subtotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  subtotalLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  subtotalValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  vetContainer: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  vetHeader: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  vetDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vetText: {
    flex: 1,
    marginRight: 10,
  },
  vetName: {
    fontSize: 14,
    fontWeight: '800',
  },
  vetPhone: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  noVetText: {
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '600',
  },
  checkoutActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  /* ─── Redesigned scan results styling tokens ─── */
  resultContainerNew: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  imageCardNew: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderBottomWidth: 4,
    position: 'relative',
    marginBottom: 16,
  },
  resultImageNew: {
    width: '100%',
    height: '100%',
  },
  confidenceOverlayNew: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(107, 143, 94, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  confidenceTextNew: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  resultHeaderCardNew: {
    padding: 20,
    borderRadius: 18,
    borderWidth: 2,
    borderBottomWidth: 4,
    marginBottom: 16,
  },
  badgeNew: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  badgeTextNew: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  resultTitleNew: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  resultNepaliTitleNew: {
    fontSize: 15,
    fontStyle: 'italic',
    color: '#C4704A',
    fontWeight: '700',
    marginTop: 4,
  },
  plantMetadataRowNew: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 12,
  },
  resultSubNew: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoCardsGridNew: {
    gap: 12,
    marginBottom: 20,
  },
  infoCardNew: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 18,
    borderWidth: 2,
    borderBottomWidth: 4,
    alignItems: 'flex-start',
  },
  infoIconBoxNew: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  infoTextContentNew: {
    flex: 1,
  },
  infoCardLabelNew: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 3,
  },
  infoCardValNew: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
  },
  localTreatmentsContainerNew: {
    marginBottom: 24,
  },
  localTreatmentsHeaderNew: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  localTreatmentsTitleNew: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  recommendationScrollNew: {
    paddingHorizontal: 4,
    gap: 14,
  },
  productCardNew: {
    width: 200,
    borderRadius: 18,
    borderWidth: 2,
    borderBottomWidth: 4,
    overflow: 'hidden',
  },
  productImageWrapperNew: {
    height: 110,
    backgroundColor: '#FAFBFB',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EFE9',
  },
  productImageNew: {
    width: '100%',
    height: '100%',
  },
  productDetailsNew: {
    padding: 12,
    flex: 1,
    justifyContent: 'space-between',
  },
  productTitleNew: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  productPriceNew: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 12,
  },
  productBuyBtnNew: {
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: 12,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productBuyBtnTextNew: {
    fontSize: 11,
    fontWeight: '800',
  },
  stickyBottomBarNew: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 2,
  },
  stickyBottomBtnNew: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderBottomWidth: 4,
  },
  stickyBottomBtnTextNew: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
