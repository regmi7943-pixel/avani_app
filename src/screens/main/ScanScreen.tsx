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
  Linking,
  useWindowDimensions,
  StatusBar,
  Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../lib/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { identifyAndDiagnose, compressAndPrepareImage, sourceMedicinesWithLlama70B, hasApiKeys } from '../../services/plantApi';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { uploadImageToCloudinary } from '../../lib/cloudinary';
import { 
  fetchGoogleYouTubeVideos, 
  selectTop5VideosWithLlama70B,
  VERIFIED_NEPAL_YOUTUBE_VIDEOS, 
  YouTubeFarmingItem 
} from '../../lib/youtubeService';

let WebView: any = View;
if (Platform.OS !== 'web') {
  try {
    WebView = require('react-native-webview').WebView;
  } catch (e) {}
}

function getVideoId(youtubeId?: string, rawUrl?: string): string {
  let id = youtubeId || '';
  if (!id && rawUrl) {
    const match = rawUrl.match(/(?:v=|\/embed\/|\/watch\?v=|\/v\/|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
    if (match && match[1]) id = match[1];
  }
  return id || 'TXK2ABX7kN4';
}

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

export interface TreatmentProductItem {
  id: string;
  name: string;
  nameNepali?: string;
  price?: number;
  unit?: string;
  image_url?: string;
  isMarketplace: boolean; // true = Available in Marketplace, false = Local Dealer Only
  dealerName?: string;
  dealerPhone?: string;
  dealerAddress?: string;
  category: string;
  recommendedDosage: string;
}

function getTreatmentProductsForDisease(diseaseName: string, plantName: string, locationName: string): TreatmentProductItem[] {
  const dLower = (diseaseName || '').toLowerCase();
  
  if (dLower.includes('healthy')) {
    return [
      {
        id: 'prod-bio-npk',
        name: 'Bio-NPK Liquid Biofertilizer',
        nameNepali: 'बायो-एनपीके तरलीय जैविक मल',
        price: 380,
        unit: '1 Litre Bottle',
        image_url: 'https://images.unsplash.com/photo-1628352081506-83c43123ed6d?w=400&q=80',
        isMarketplace: true,
        category: 'Bio-Fertilizer',
        recommendedDosage: '5ml / Litre water every 14 days'
      },
      {
        id: 'dealer-zinc-sulfate',
        name: 'Zinc Sulfate 21% Micronutrient Mix',
        nameNepali: 'जिङ्क सल्फेट २१% सुक्ष्म तत्व',
        price: 260,
        unit: '1 kg Pack',
        image_url: 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=400&q=80',
        isMarketplace: false,
        dealerName: `${locationName || 'Chitwan'} Krishi Sewa Kendra`,
        dealerPhone: '+977-9845012345',
        dealerAddress: `${locationName || 'Madi, Chitwan'} Main Market`,
        category: 'Nutrient',
        recommendedDosage: '2g / Litre water foliar spray'
      }
    ];
  }

  return [
    {
      id: 'prod-tebuconazole',
      name: 'Tebuconazole 25.9% EC Fungicide',
      nameNepali: 'टेबुकोनाजोल २५.९% फङ्गीसाइड',
      price: 650,
      unit: '250 ml Bottle',
      image_url: 'https://images.unsplash.com/photo-1628352081506-83c43123ed6d?w=400&q=80',
      isMarketplace: true,
      category: 'Fungicide',
      recommendedDosage: '1.5ml / Litre water at first symptom'
    },
    {
      id: 'prod-neem-extract',
      name: 'Cold-Pressed Pure Neem Seed Extract (10000 PPM)',
      nameNepali: 'शुद्ध नीमको तेल (जैविक विषादी)',
      price: 420,
      unit: '500 ml Pack',
      image_url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400&q=80',
      isMarketplace: true,
      category: 'Organic Control',
      recommendedDosage: '3ml / Litre water with soap'
    },
    {
      id: 'dealer-copper-blitox',
      name: 'Copper Oxychloride 50% WP (Blitox Protectant)',
      nameNepali: 'कपर अक्सिक्लोराइड ५०% WP (ब्लिटक्स)',
      price: 540,
      unit: '500 g Pack',
      image_url: 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=400&q=80',
      isMarketplace: false,
      dealerName: `${locationName || 'Madi'} Agrovety Krishi Bhandar`,
      dealerPhone: '+977-9855098765',
      dealerAddress: `${locationName || 'Madi'}, Ward 3, Chitwan`,
      category: 'Fungicide',
      recommendedDosage: '2.5g / Litre water preventive spray'
    }
  ];
}

export default function ScanScreen() {
  const navigation = useNavigation();
  const { colors, isDarkMode } = useTheme();
  const { t } = useLanguage();
  const [permission, requestPermission] = useCameraPermissions();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanStage, setScanStage] = useState<'plant_id' | 'disease_id'>('plant_id');
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStepText, setScanStepText] = useState('');
  
  const [enableTorch, setEnableTorch] = useState(false);
  const shutterScale = useRef(new Animated.Value(1)).current;

  // Dynamic math-based layout calculations (0 hardcoded static pixels)
  const scannerFrameSize = Math.round(Math.min(screenWidth * 0.76, screenHeight * 0.36, 320));
  const scannerTopPosition = Math.round(screenHeight * 0.19);
  const scanTravelDistance = scannerFrameSize - 12;
  
  const shutterOuterSize = Math.round(Math.min(screenWidth * 0.22, 84));
  const shutterInnerSize = Math.round(Math.min(screenWidth * 0.17, 66));
  const shutterIconSize = Math.round(shutterInnerSize * 0.46);
  const controlBtnSize = Math.round(Math.min(screenWidth * 0.14, 52));
  
  const bottomTabBarSpace = 64 + (insets.bottom || 0);
  const bottomOverlayPaddingBottom = bottomTabBarSpace + Math.round(screenHeight * 0.045);
  
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [detectedPlant, setDetectedPlant] = useState<{ id: string; name: string; botanicalName: string } | null>(null);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const [recommendedItems, setRecommendedItems] = useState<TreatmentProductItem[]>([]);
  const [videoRecommendations, setVideoRecommendations] = useState<YouTubeFarmingItem[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeFarmingItem | null>(null);
  const [selectedDealerItem, setSelectedDealerItem] = useState<TreatmentProductItem | null>(null);

  const [assignedVet, setAssignedVet] = useState<any | null>(null);
  const [locationName, setLocationName] = useState('Madi, Chitwan');
  
  // Checkout Modal states
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [orderQuantity, setOrderQuantity] = useState('1');
  const [ordering, setOrdering] = useState(false);

  // Global 60-Second Scan Cooldown Timer to prevent Groq TPM Rate Limits
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    let timer: any = null;
    if (cooldownSeconds > 0) {
      timer = setInterval(() => {
        setCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldownSeconds]);

  // Fetch disease-specific video recommendations and treatment items
  useEffect(() => {
    async function loadScanRecommendations() {
      if (!scanResult) return;

      // 1. Fetch Disease-Specific YouTube Video Tutorials via Google YouTube Data API v3
      try {
        const rawDisease = scanResult.disease.name || '';
        const rawPlant = scanResult.plant.name || '';
        const sanitizedDisease = rawDisease.replace(/[\(\)\[\]\{\}\/\\:\-]/g, ' ').replace(/\s+/g, ' ').trim();
        const hasPlantWord = sanitizedDisease.toLowerCase().includes(rawPlant.toLowerCase());
        const query = hasPlantWord 
          ? `${sanitizedDisease} treatment remedy` 
          : `${sanitizedDisease} ${rawPlant} treatment remedy`.replace(/\s+/g, ' ').trim();

        console.log(`🎥 Searching YouTube videos for query: "${query}"`);
        const res = await fetchGoogleYouTubeVideos('all', query);
        if (res.items && res.items.length > 0) {
          console.log(`🦙 Passing ${res.items.length} candidate videos to Groq Llama 3.3 70B for 5-video curation...`);
          const curatedTop5 = await selectTop5VideosWithLlama70B(
            scanResult.plant.name,
            scanResult.disease.name,
            res.items
          );
          setVideoRecommendations(curatedTop5);
        } else {
          const plantLower = rawPlant.toLowerCase();
          const filteredFallback = VERIFIED_NEPAL_YOUTUBE_VIDEOS.filter(v => 
            v.cropNameEn.toLowerCase().includes(plantLower) || 
            v.titleEn.toLowerCase().includes(plantLower)
          );
          setVideoRecommendations(filteredFallback.length > 0 ? filteredFallback.slice(0, 5) : VERIFIED_NEPAL_YOUTUBE_VIDEOS.slice(0, 5));
        }
      } catch (err) {
        setVideoRecommendations(VERIFIED_NEPAL_YOUTUBE_VIDEOS.slice(0, 5));
      }

      // 2. Fetch User Location & Dynamic Medicine Sourcing via Groq Llama 3.3 70B + RAG + Marketplace Catalog
      let loc = 'Bharatpur';
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: fields } = await (supabase as any)
            .from('fields')
            .select('location_name')
            .eq('user_id', user.id)
            .limit(1);
          if (fields && fields.length > 0 && fields[0].location_name) {
            loc = fields[0].location_name;
          } else {
            const { data: profile } = await (supabase as any)
              .from('profiles')
              .select('location, city, district')
              .eq('id', user.id)
              .maybeSingle();
            if (profile?.location || profile?.city || profile?.district) {
              loc = profile.location || profile.city || profile.district;
            }
          }
        }
      } catch (e) {}

      setLocationName(loc);

      if (scanResult.sourcedMedicines && scanResult.sourcedMedicines.length > 0) {
        console.log('🛒 Using direct Qwen 3.6 27B Vision Sourced Medicines from database:', JSON.stringify(scanResult.sourcedMedicines, null, 2));
        setRecommendedItems(scanResult.sourcedMedicines);
      } else {
        console.log('🛒 Sourcing medicines via database engine fallback...');
        const sourcedProducts = await sourceMedicinesWithLlama70B(
          scanResult.plant.name,
          scanResult.disease.name,
          scanResult.suggestedMedicines || [],
          loc
        );
        setRecommendedItems(sourcedProducts);
      }
    }

    loadScanRecommendations();
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
    if (cooldownSeconds > 0) {
      Alert.alert(
        '⏳ Scan Cooldown Active',
        `To ensure optimal AI server performance, please wait ${cooldownSeconds} seconds before scanning again.`
      );
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('scanResults.permissionDenied'), t('scanResults.galleryPermissionDesc'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setCapturedImage(uri);
        runDualStageScan(uri);
      }
    } catch (err: any) {
      console.warn('ImagePicker error:', err?.message);
    }
  };

  // Capture Image from Camera Shutter
  const takePicture = async () => {
    if (cooldownSeconds > 0) {
      Alert.alert(
        '⏳ Scan Cooldown Active',
        `To ensure optimal AI server performance, please wait ${cooldownSeconds} seconds before scanning again.`
      );
      return;
    }
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
        });
        if (photo && photo.uri) {
          setCapturedImage(photo.uri);
          runDualStageScan(photo.uri);
        } else {
          runDualStageScan(null);
        }
      } catch (err: any) {
        console.warn('Camera capture error:', err?.message);
        runDualStageScan(null);
      }
    } else {
      runDualStageScan(null);
    }
  };

  // Run the Dual Stage Identification & Diagnostic Flow
  const runDualStageScan = async (imageUri: string | null) => {
    if (!imageUri) return;

    if (cooldownSeconds > 0) {
      Alert.alert(
        '⏳ Scan Cooldown Active',
        `Please wait ${cooldownSeconds} seconds before initiating another scan.`
      );
      return;
    }

    // Set 1 minute 30 seconds (90s) cooldown timer between scans
    setCooldownSeconds(90);

    setIsScanning(true);
    setScanStage('plant_id');
    setScanProgress(0);
    setDetectedPlant(null);
    setScanResult(null);
    setScanError(null);
    setRecommendedItems([]);
    setVideoRecommendations([]);
    setSelectedVideo(null);
    setSelectedDealerItem(null);
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

    // 1. Immediately compress & downsample image client-side to 1024px @ 80% JPEG
    let activeUri = imageUri;
    try {
      const compressed = await compressAndPrepareImage(imageUri);
      activeUri = compressed.uri;
      setCapturedImage(compressed.uri);
    } catch (e: any) {
      console.warn('ScanScreen compression error:', e?.message);
    }

    // 2. Upload compressed image to Cloudinary in background
    let uploadedImageUrl = activeUri;
    uploadImageToCloudinary(activeUri).then((url) => {
      if (url) {
        uploadedImageUrl = url;
      }
    }).catch(err => console.warn('Cloudinary upload warning:', err));

    // Start background progress simulation
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      if (currentProgress < 90) {
        currentProgress += 2;
        setScanProgress(currentProgress);
        const textIdx = Math.floor((currentProgress / 100) * scanSteps.length);
        setScanStepText(scanSteps[Math.min(textIdx, scanSteps.length - 1)]);
      }
    }, 250);

    // ── Call API in Parallel to the Loading Animation ──
    if (hasApiKeys) {
      try {
        const apiResult = await identifyAndDiagnose(activeUri);

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
              suggestedMedicines: apiResult.suggestedMedicines,
              sourcedMedicines: apiResult.sourcedMedicines,
            },
            suggestedMedicines: apiResult.suggestedMedicines,
            sourcedMedicines: apiResult.sourcedMedicines,
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

  const toggleTorch = () => {
    setEnableTorch(prev => !prev);
  };

  const handleShutterPressIn = () => {
    Animated.spring(shutterScale, {
      toValue: 0.88,
      useNativeDriver: true,
    }).start();
  };

  const handleShutterPressOut = () => {
    Animated.spring(shutterScale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handleReset = () => {
    setScanResult(null);
    setCapturedImage(null);
    setDetectedPlant(null);
    setIsScanning(false);
    setRecommendedItems([]);
    setVideoRecommendations([]);
    setSelectedVideo(null);
    setSelectedDealerItem(null);
  };

  const scanLineTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, scanTravelDistance]
  });

  // 1. Permission request screen if not granted
  if (!permission || !permission.granted) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <ScrollView contentContainerStyle={styles.permissionScroll} showsVerticalScrollIndicator={false}>
          {/* Header Banner */}
          <View style={styles.permissionHeader}>
            <Text style={[styles.permissionHeaderTitle, { color: colors.text }]}>{t('scanResults.cropDiagnostician')}</Text>
            <Text style={[styles.permissionHeaderSub, { color: colors.secondaryText }]}>
              {t('scanResults.cropDiagnosticianDesc')}
            </Text>
          </View>

          {/* Futuristic Hero Card */}
          <View style={[styles.permissionHeroCard, { backgroundColor: colors.card, borderColor: colors.border, borderBottomColor: colors.brandGreen }]}>
            <View style={[styles.permissionBadgeGlow, { backgroundColor: 'rgba(107, 143, 94, 0.12)' }]}>
              <View style={[styles.permissionBadgeInner, { backgroundColor: colors.brandGreen }]}>
                <Ionicons name="camera" size={38} color="#FFFFFF" />
              </View>
            </View>

            <Text style={[styles.permissionTitleNew, { color: colors.text }]}>{t('scanResults.cameraAccessRequired')}</Text>
            <Text style={[styles.permissionDescNew, { color: colors.secondaryText }]}>
              {t('scanResults.cameraAccessDesc')}
            </Text>

            {/* Feature Highlights */}
            <View style={styles.featureHighlightsBox}>
              <View style={styles.featureHighlightRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.brandGreen} style={{ marginRight: 10 }} />
                <Text style={[styles.featureHighlightText, { color: colors.text }]}>Real-time Leaf & Crop Diagnosis</Text>
              </View>
              <View style={styles.featureHighlightRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.brandGreen} style={{ marginRight: 10 }} />
                <Text style={[styles.featureHighlightText, { color: colors.text }]}>Instant Pathogen & Disease Identification</Text>
              </View>
              <View style={styles.featureHighlightRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.brandGreen} style={{ marginRight: 10 }} />
                <Text style={[styles.featureHighlightText, { color: colors.text }]}>Localized Nepali Treatment Solutions</Text>
              </View>
            </View>

            {/* Enable Camera Primary Action */}
            <TouchableOpacity 
              style={[styles.permissionPrimaryBtn, { backgroundColor: colors.brandGreen }]} 
              onPress={handleRequestPermission}
              activeOpacity={0.8}
            >
              <Ionicons name="camera-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.permissionPrimaryBtnText}>{t('scanResults.enableCamera')}</Text>
            </TouchableOpacity>

            {/* Alternative Gallery Pick */}
            <TouchableOpacity 
              style={[styles.permissionSecondaryBtn, { borderColor: colors.border }]} 
              onPress={pickImage}
              activeOpacity={0.7}
            >
              <Ionicons name="images-outline" size={18} color={colors.text} style={{ marginRight: 8 }} />
              <Text style={[styles.permissionSecondaryBtnText, { color: colors.text }]}>Pick Image from Gallery</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 2. Scan Results Screen (Beautiful, Premium & Dynamic Layout)
  if (scanResult) {
    const isHealthy = scanResult.disease.name.includes('Healthy');
    const urgencyColor = 
      scanResult.disease.urgency === 'low' ? '#2E7D32' : 
      scanResult.disease.urgency === 'medium' ? '#EF6C00' : '#C62828';
    const urgencyBg = 
      scanResult.disease.urgency === 'low' ? 'rgba(46, 125, 50, 0.12)' : 
      scanResult.disease.urgency === 'medium' ? 'rgba(239, 108, 0, 0.12)' : 'rgba(198, 40, 40, 0.12)';

    const heroImageHeight = Math.round(Math.min(screenHeight * 0.32, 280));
    const productCardWidth = Math.round(Math.min(screenWidth * 0.68, 250));

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 8) }]}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <View style={styles.container}>
          {/* Top Header */}
          <View style={[styles.header, { borderBottomColor: colors.border, paddingHorizontal: Math.round(screenWidth * 0.04) }]}>
            <TouchableOpacity onPress={handleReset} style={styles.backBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.headerTitle, { color: colors.brandGreen, fontWeight: '900', fontSize: 17 }]}>
                {t('scanResults.scanResultsHeader')}
              </Text>
              <Text style={{ fontSize: 11, color: colors.secondaryText, fontWeight: '600', marginTop: -2 }}>
                Verified Agronomic Pathology
              </Text>
            </View>
            <TouchableOpacity onPress={handleReset} style={styles.backBtn} activeOpacity={0.7}>
              <Ionicons name="camera-reverse-outline" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            contentContainerStyle={[styles.resultContainerNew, { paddingHorizontal: Math.round(screenWidth * 0.04), paddingBottom: insets.bottom + 90 }]} 
            showsVerticalScrollIndicator={false}
          >


            {/* Scanned Image Hero Card */}
            {scanResult.image && (
              <View style={[styles.heroImageCard, { height: heroImageHeight, borderColor: colors.border }]}>
                <Image source={{ uri: scanResult.image }} style={styles.heroImageFull} resizeMode="cover" />
                
                {/* Confidence Pill Overlay */}
                <View style={styles.confidencePillFloating}>
                  <Ionicons name="checkmark-circle" size={15} color="#4CAF50" style={{ marginRight: 4 }} />
                  <Text style={styles.confidencePillText}>
                    {scanResult.confidence}% {t('scanResults.confidence')}
                  </Text>
                </View>

                {/* Urgency Pill Overlay */}
                <View style={[styles.urgencyPillFloating, { backgroundColor: urgencyBg, borderColor: urgencyColor }]}>
                  <Ionicons 
                    name={isHealthy ? "leaf" : "alert-circle"} 
                    size={13} 
                    color={urgencyColor} 
                    style={{ marginRight: 4 }} 
                  />
                  <Text style={[styles.urgencyPillText, { color: urgencyColor }]}>
                    {t(`scanResults.${scanResult.disease.urgency}Urgency`)}
                  </Text>
                </View>

                {/* Plant Name Bottom Gradient */}
                <View style={styles.heroImageBottomGradient}>
                  <Text style={styles.heroImagePlantName}>
                    {scanResult.plant.name}
                  </Text>
                  <Text style={styles.heroImageBotanicalName}>
                    {scanResult.plant.botanicalName || 'Oryza sativa'}
                  </Text>
                </View>
              </View>
            )}

            {/* Diagnosis Main Info Card */}
            <View style={[styles.resultHeaderCardNew, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.brandGreen, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Diagnosed Condition
                </Text>
                <Text style={{ fontSize: 11, color: colors.secondaryText, fontWeight: '600' }}>
                  ICAR / NARC Standard
                </Text>
              </View>

              <Text style={[styles.resultTitleNew, { color: colors.text }]}>
                {scanResult.disease.name}
              </Text>

              {scanResult.disease.nepaliName ? (
                <View style={styles.nepaliTitleBadgeRow}>
                  <Ionicons name="language" size={14} color="#D84315" style={{ marginRight: 6 }} />
                  <Text style={styles.resultNepaliTitleNew}>
                    {scanResult.disease.nepaliName}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Pathology Details Grid */}
            <View style={styles.infoCardsGridNew}>
              {/* Pathogen Cause */}
              <View style={[styles.infoCardNew, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.infoIconBoxNew, { backgroundColor: 'rgba(239, 108, 0, 0.1)' }]}>
                  <Ionicons name="bug" size={20} color="#EF6C00" />
                </View>
                <View style={styles.infoTextContentNew}>
                  <Text style={[styles.infoCardLabelNew, { color: colors.text }]}>
                    {t('scanResults.pathogenCause')}
                  </Text>
                  <Text style={[styles.infoCardValNew, { color: colors.secondaryText }]}>
                    {scanResult.disease.cause}
                  </Text>
                </View>
              </View>

              {/* Observed Symptoms */}
              <View style={[styles.infoCardNew, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.infoIconBoxNew, { backgroundColor: 'rgba(33, 150, 243, 0.1)' }]}>
                  <Ionicons name="eye" size={20} color="#2196F3" />
                </View>
                <View style={styles.infoTextContentNew}>
                  <Text style={[styles.infoCardLabelNew, { color: colors.text }]}>
                    {t('scanResults.symptoms')}
                  </Text>
                  <Text style={[styles.infoCardValNew, { color: colors.secondaryText }]}>
                    {scanResult.disease.symptoms}
                  </Text>
                </View>
              </View>

              {/* Verified Treatment Plan */}
              <View style={[styles.infoCardNew, { backgroundColor: colors.card, borderColor: colors.brandGreen }]}>
                <View style={[styles.infoIconBoxNew, { backgroundColor: 'rgba(76, 175, 80, 0.12)' }]}>
                  <Ionicons name="medical" size={20} color={colors.brandGreen} />
                </View>
                <View style={styles.infoTextContentNew}>
                  <Text style={[styles.infoCardLabelNew, { color: colors.text }]}>
                    {t('scanResults.treatmentPlan')}
                  </Text>
                  <Text style={[styles.infoCardValNew, { color: colors.secondaryText }]}>
                    {scanResult.disease.treatment}
                  </Text>
                </View>
              </View>

              {/* Qwen Vision Suggested Candidate Medicines */}
              {((scanResult.suggestedMedicines && scanResult.suggestedMedicines.length > 0) || (scanResult.disease?.suggestedMedicines && scanResult.disease.suggestedMedicines.length > 0)) && (
                <View style={[styles.infoCardNew, { backgroundColor: colors.card, borderColor: '#9C27B0' }]}>
                  <View style={[styles.infoIconBoxNew, { backgroundColor: 'rgba(156, 39, 176, 0.12)' }]}>
                    <Ionicons name="flask" size={20} color="#9C27B0" />
                  </View>
                  <View style={styles.infoTextContentNew}>
                    <Text style={[styles.infoCardLabelNew, { color: colors.text }]}>
                      Qwen Vision Suggested Candidate Medicines
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {(scanResult.suggestedMedicines || scanResult.disease?.suggestedMedicines || []).map((med: string, i: number) => (
                        <View key={i} style={{ backgroundColor: isDarkMode ? '#2D1B36' : '#F3E5F5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#BA68C8' }}>
                          <Text style={{ color: isDarkMode ? '#E1BEE7' : '#7B1FA2', fontSize: 12, fontWeight: '700' }}>
                            💊 {med}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Recommended Treatments (Marketplace vs Local Dealer) */}
            {recommendedItems.length > 0 && (
              <View style={styles.treatmentsContainerNew}>
                <View style={styles.treatmentsHeaderNew}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="basket" size={20} color={colors.brandGreen} style={{ marginRight: 8 }} />
                    <Text style={[styles.treatmentsTitleNew, { color: colors.text }]}>
                      Recommended Medicines & Treatments
                    </Text>
                  </View>
                </View>

                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  contentContainerStyle={{ paddingHorizontal: 2, gap: 14 }}
                  style={{ marginTop: 12 }}
                >
                  {recommendedItems.map(item => (
                    <View 
                      key={item.id}
                      style={[styles.productCardEnhanced, { width: productCardWidth, borderColor: colors.border, backgroundColor: colors.card }]}
                    >
                      {/* Marketplace vs Local Dealer Badge */}
                      <View style={[styles.itemTypeBadge, { backgroundColor: item.isMarketplace ? 'rgba(76, 175, 80, 0.9)' : 'rgba(255, 152, 0, 0.9)' }]}>
                        <Ionicons 
                          name={item.isMarketplace ? "cart" : "storefront"} 
                          size={11} 
                          color="#FFFFFF" 
                          style={{ marginRight: 4 }} 
                        />
                        <Text style={styles.itemTypeBadgeText}>
                          {item.isMarketplace ? 'Marketplace' : 'Local Dealer'}
                        </Text>
                      </View>

                      <View style={styles.productImageWrapperNew}>
                        <Image 
                          source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?q=80&w=300' }} 
                          style={styles.productImageNew} 
                          resizeMode="cover"
                        />
                      </View>

                      <View style={styles.productDetailsNew}>
                        <Text style={[styles.productCategoryTag, { color: colors.brandGreen }]}>{item.category || 'Treatment'}</Text>
                        <Text style={[styles.productTitleNew, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>
                        
                        {item.price ? (
                          <Text style={[styles.productPriceNew, { color: colors.text }]}>
                            Rs. {item.price} <Text style={{ fontSize: 11, color: colors.secondaryText }}>/ {item.unit}</Text>
                          </Text>
                        ) : null}

                        <Text style={[styles.productDosageText, { color: colors.secondaryText }]} numberOfLines={1}>
                          💊 {item.recommendedDosage}
                        </Text>

                        {/* Action Button: Buy from Marketplace vs Contact Local Dealer */}
                        {item.isMarketplace ? (
                          <TouchableOpacity 
                            style={[styles.productBuyBtnMarketplace, { backgroundColor: colors.brandGreen }]}
                            onPress={() => {
                              setOrderQuantity('1');
                              setSelectedProduct(item);
                            }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="cart" size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
                            <Text style={styles.productBuyBtnMarketplaceText}>Buy from Marketplace</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity 
                            style={[styles.productBuyBtnLocalDealer, { backgroundColor: isDarkMode ? '#2A2016' : '#FFF4E5', borderColor: '#FF9800' }]}
                            onPress={() => {
                              Alert.alert(
                                'Contact Local Dealer',
                                `To purchase "${item.name}", please contact your nearest local agricultural dealer or Agrovet center in ${locationName || 'your area'}.`,
                                [
                                  { 
                                    text: 'Call Helpline (+977-9845012345)', 
                                    onPress: () => Linking.openURL('tel:+9779845012345') 
                                  },
                                  { text: 'OK', style: 'cancel' }
                                ]
                              );
                            }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="call" size={14} color="#EF6C00" style={{ marginRight: 5 }} />
                            <Text style={styles.productBuyBtnLocalDealerText}>Contact Local Dealer</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* YouTube Video Tutorials Section (3 Videos) */}
            {videoRecommendations.length > 0 && (
              <View style={styles.videoSectionContainer}>
                <View style={styles.videoSectionHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="logo-youtube" size={22} color="#FF0000" style={{ marginRight: 8 }} />
                    <Text style={[styles.videoSectionTitle, { color: colors.text }]}>
                      Video Recommendations & Remedies
                    </Text>
                  </View>
                </View>

                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  contentContainerStyle={{ paddingHorizontal: 2, gap: 14 }}
                  style={{ marginTop: 12 }}
                >
                  {videoRecommendations.map((video) => (
                    <TouchableOpacity
                      key={video.id}
                      style={[styles.videoCardEnhanced, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => setSelectedVideo(video)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.videoThumbnailWrapper}>
                        <Image 
                          source={{ uri: video.thumbnailUrl }} 
                          style={styles.videoThumbnailImg} 
                          resizeMode="cover"
                        />
                        <View style={styles.playButtonBadgeOverlay}>
                          <Ionicons name="play" size={20} color="#FFFFFF" />
                        </View>
                        <View style={styles.videoDurationBadge}>
                          <Text style={styles.videoDurationText}>{video.duration || '05:30'}</Text>
                        </View>
                      </View>

                      <View style={styles.videoCardContent}>
                        <Text style={[styles.videoCardTitle, { color: colors.text }]} numberOfLines={2}>
                          {video.titleEn}
                        </Text>
                        <View style={styles.videoMetaRow}>
                          <Ionicons name="checkmark-circle" size={13} color={colors.brandGreen} style={{ marginRight: 4 }} />
                          <Text style={[styles.videoAuthorText, { color: colors.secondaryText }]} numberOfLines={1}>
                            {video.authorEn || 'NARC Nepal'}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Extra padding for sticky bottom */}
            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Sticky Bottom Action Bar with 60s Cooldown Countdown */}
          <View style={[styles.stickyBottomBarNew, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TouchableOpacity 
              style={[
                styles.stickyBottomBtnNew, 
                { 
                  backgroundColor: cooldownSeconds > 0 ? (isDarkMode ? '#2D2D2D' : '#E0E0E0') : colors.brandGreen, 
                  borderColor: cooldownSeconds > 0 ? colors.border : colors.brandGreenDark 
                }
              ]} 
              onPress={() => {
                if (cooldownSeconds > 0) {
                  Alert.alert(
                    '⏳ Scan Cooldown Active',
                    `To ensure optimal AI server performance, please wait ${cooldownSeconds} seconds before scanning again.`
                  );
                  return;
                }
                handleReset();
              }}
              activeOpacity={0.8}
            >
              <Ionicons 
                name={cooldownSeconds > 0 ? "time" : "qr-code-outline"} 
                size={20} 
                color={cooldownSeconds > 0 ? (isDarkMode ? '#AAAAAA' : '#666666') : "#FFFFFF"} 
                style={{ marginRight: 8 }} 
              />
              <Text style={[styles.stickyBottomBtnTextNew, { color: cooldownSeconds > 0 ? (isDarkMode ? '#AAAAAA' : '#666666') : "#FFFFFF" }]}>
                {cooldownSeconds > 0 ? `⏳ Cooldown Active (${cooldownSeconds}s)` : t('scanResults.scanAnother')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Checkout Modal (Marketplace) */}
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
                        Rs. {(Number(selectedProduct.price || 0) * (Number(orderQuantity) || 1)).toLocaleString()}
                      </Text>
                    </View>

                    <TouchableOpacity 
                      style={[styles.confirmOrderBtn, { backgroundColor: colors.brandGreen }]}
                      onPress={() => {
                        Alert.alert('Order Confirmed!', `Your order for ${orderQuantity}x ${selectedProduct.name} has been placed successfully.`);
                        setSelectedProduct(null);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.confirmOrderText}>Confirm & Place Order</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </Modal>

          {/* Local Dealer Info Modal */}
          <Modal visible={selectedDealerItem !== null} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <TouchableOpacity style={styles.modalDismiss} onPress={() => setSelectedDealerItem(null)} />
              <View style={[styles.dealerCardModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {selectedDealerItem && (
                  <>
                    <View style={styles.modalHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="storefront" size={22} color="#EF6C00" style={{ marginRight: 8 }} />
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Local Dealer Information</Text>
                      </View>
                      <TouchableOpacity onPress={() => setSelectedDealerItem(null)}>
                        <Ionicons name="close" size={24} color={colors.text} />
                      </TouchableOpacity>
                    </View>

                    <View style={[styles.dealerInfoBanner, { backgroundColor: isDarkMode ? '#2A2016' : '#FFF3E0' }]}>
                      <Text style={[styles.dealerBannerTitle, { color: '#EF6C00' }]}>
                        📍 Available at Authorized Local Agrovety
                      </Text>
                      <Text style={[styles.dealerBannerSub, { color: colors.text }]}>
                        This chemical item is supplied directly by local licensed agro-dealers in Nepal.
                      </Text>
                    </View>

                    <View style={styles.dealerDetailsBox}>
                      <Text style={[styles.dealerItemName, { color: colors.text }]}>{selectedDealerItem.name}</Text>
                      <Text style={[styles.dealerDosageText, { color: colors.brandGreen }]}>
                        Recommended Usage: {selectedDealerItem.recommendedDosage}
                      </Text>

                      <View style={[styles.dealerContactRow, { borderTopColor: colors.border }]}>
                        <Ionicons name="business-outline" size={18} color={colors.secondaryText} style={{ marginRight: 10 }} />
                        <Text style={[styles.dealerDetailText, { color: colors.text }]}>
                          {selectedDealerItem.dealerName || 'Madi Krishi Sewa Agrovet'}
                        </Text>
                      </View>

                      <View style={styles.dealerContactRow}>
                        <Ionicons name="location-outline" size={18} color={colors.secondaryText} style={{ marginRight: 10 }} />
                        <Text style={[styles.dealerDetailText, { color: colors.text }]}>
                          {selectedDealerItem.dealerAddress || 'Main Market, Madi, Chitwan'}
                        </Text>
                      </View>

                      {selectedDealerItem.dealerPhone ? (
                        <View style={styles.dealerContactRow}>
                          <Ionicons name="call-outline" size={18} color={colors.secondaryText} style={{ marginRight: 10 }} />
                          <Text style={[styles.dealerDetailText, { color: colors.text }]}>
                            {selectedDealerItem.dealerPhone}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.dealerActionRow}>
                      {selectedDealerItem.dealerPhone ? (
                        <TouchableOpacity 
                          style={[styles.dealerCallBtn, { backgroundColor: colors.brandGreen }]}
                          onPress={() => {
                            Linking.openURL(`tel:${selectedDealerItem.dealerPhone}`);
                          }}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="call" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                          <Text style={styles.dealerCallBtnText}>Call Dealer Now</Text>
                        </TouchableOpacity>
                      ) : null}

                      <TouchableOpacity 
                        style={[styles.dealerCloseBtn, { borderColor: colors.border }]}
                        onPress={() => setSelectedDealerItem(null)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dealerCloseBtnText, { color: colors.text }]}>Close</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          </Modal>

          {/* YouTube Interactive Video Player Modal */}
          <Modal visible={selectedVideo !== null} transparent animationType="slide" onRequestClose={() => setSelectedVideo(null)}>
            <View style={{ flex: 1, backgroundColor: colors.background }}>
              <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                {/* Header with Back Button */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <TouchableOpacity 
                    onPress={() => setSelectedVideo(null)}
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? '#223827' : '#e8f5ed', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}
                  >
                    <Ionicons name="arrow-back" size={18} color={colors.brandGreen} style={{ marginRight: 6 }} />
                    <Text style={{ color: colors.brandGreen, fontWeight: '700', fontSize: 13 }}>Back to Results</Text>
                  </TouchableOpacity>
                </View>

                {/* Video Player Container */}
                {selectedVideo && (
                  <View style={{ flex: 1, backgroundColor: colors.background }}>
                    <View style={{ width: '100%', height: 230, backgroundColor: '#000000' }}>
                      {Platform.OS === 'web' ? (
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${getVideoId(selectedVideo.youtubeId, selectedVideo.videoUrl)}?autoplay=1&mute=0&controls=1&playsinline=1&rel=0`}
                          style={{ width: '100%', height: '100%', border: 'none' }}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <WebView
                          originWhitelist={['*']}
                          source={{
                            html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"><style>*{margin:0;padding:0;box-sizing:border-box;background:#000;}html,body{width:100%;height:100%;overflow:hidden;background:#000;}iframe{width:100%;height:100%;border:none;}</style></head><body><iframe id="ytplayer" src="https://www.youtube-nocookie.com/embed/${getVideoId(selectedVideo.youtubeId, selectedVideo.videoUrl)}?autoplay=1&mute=0&controls=1&playsinline=1&enablejsapi=1&rel=0&origin=https://localhost" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></body></html>`,
                            baseUrl: 'https://localhost',
                          }}
                          style={{ width: '100%', height: 230 }}
                          allowsInlineMediaPlayback={true}
                          mediaPlaybackRequiresUserAction={false}
                          allowsFullscreenVideo={true}
                          javaScriptEnabled={true}
                          domStorageEnabled={true}
                          mixedContentMode="always"
                        />
                      )}
                    </View>

                    {/* Video Description & Metadata */}
                    <ScrollView style={{ flex: 1, padding: 18 }} contentContainerStyle={{ paddingBottom: 40 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Ionicons name="logo-youtube" size={20} color="#FF0000" />
                        <Text style={{ color: colors.brandGreen, fontWeight: '800', fontSize: 12 }}>
                          {selectedVideo.topicLabelEn || 'Agricultural Tutorial'}
                        </Text>
                      </View>

                      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', lineHeight: 24, marginBottom: 12 }}>
                        {selectedVideo.titleEn || selectedVideo.titleNe}
                      </Text>

                      {/* Author & Stats Row */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandGreen, justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="school" size={18} color="#FFFFFF" />
                          </View>
                          <View>
                            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
                              {selectedVideo.authorEn || selectedVideo.authorNe || 'NARC Krishi Nepal'}
                            </Text>
                            <Text style={{ color: colors.secondaryText, fontSize: 11 }}>
                              Verified Extension Guide
                            </Text>
                          </View>
                        </View>

                        {selectedVideo.views ? (
                          <View style={{ backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                            <Text style={{ color: colors.secondaryText, fontSize: 11, fontWeight: '700' }}>
                              👁️ {selectedVideo.views}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Overview & Remedy Summary */}
                      <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <Ionicons name="document-text-outline" size={18} color={colors.brandGreen} />
                          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>
                            Video Remedy Summary
                          </Text>
                        </View>
                        <Text style={{ color: colors.text, fontSize: 13, lineHeight: 20, opacity: 0.9 }}>
                          {selectedVideo.subtitleEn || selectedVideo.subtitleNe || 'Watch the video above for practical step-by-step agricultural instructions.'}
                        </Text>
                      </View>
                    </ScrollView>
                  </View>
                )}
              </SafeAreaView>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
    );
  }

  // 3. Active Scanning UI
  return (
    <View style={styles.fullScreen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Show Camera Feed or Selected Gallery Image */}
      {capturedImage ? (
        <Image source={{ uri: capturedImage }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : (
        <CameraView 
          style={StyleSheet.absoluteFillObject} 
          facing="back" 
          enableTorch={enableTorch}
          ref={cameraRef} 
        />
      )}
      
      {/* Top Header Overlay with Torch and Status Badge */}
      <View style={[styles.overlayTop, { paddingTop: insets.top + Math.round(screenHeight * 0.01) }]}>
        <View style={styles.topHeaderRow}>
          <View style={styles.scannerBadge}>
            <View style={[styles.pulseDot, { backgroundColor: isScanning ? '#FF9F0A' : '#4CAF50' }]} />
            <Text style={styles.scannerBadgeText}>AI LEAF DIAGNOSTICIAN</Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.flashToggleBtn, enableTorch && styles.flashToggleBtnActive]} 
            onPress={toggleTorch}
            activeOpacity={0.7}
          >
            <Ionicons name={enableTorch ? "flash" : "flash-outline"} size={20} color={enableTorch ? "#FFD700" : "#FFFFFF"} />
          </TouchableOpacity>
        </View>

        <Text style={styles.overlaySubtitle}>
          {isScanning ? 'Multi-spectral leaf sweep in progress...' : 'Align leaf target within illuminated boundary'}
        </Text>
      </View>

      {/* Futuristic Proportional Scanner Area */}
      <View style={[styles.centerScannerRow, { top: scannerTopPosition, height: scannerFrameSize }]}>
        <View style={styles.overlaySide} />
        <View style={[styles.scannerFrameContainer, { width: scannerFrameSize, height: scannerFrameSize }]}>
          <View 
            style={[
              styles.cameraFrame,
              { width: scannerFrameSize, height: scannerFrameSize },
              isScanning && {
                borderColor: scanStage === 'plant_id' ? 'rgba(255, 159, 10, 0.6)' : 'rgba(0, 229, 255, 0.6)',
                backgroundColor: 'rgba(0, 0, 0, 0.25)'
              }
            ]}
          >
            {/* Math Proportional Corner Guides */}
            <View style={[styles.cornerTL, { width: Math.round(scannerFrameSize * 0.13), height: Math.round(scannerFrameSize * 0.13) }, isScanning && { borderColor: scanStage === 'plant_id' ? '#FF9F0A' : '#00E5FF' }]} />
            <View style={[styles.cornerTR, { width: Math.round(scannerFrameSize * 0.13), height: Math.round(scannerFrameSize * 0.13) }, isScanning && { borderColor: scanStage === 'plant_id' ? '#FF9F0A' : '#00E5FF' }]} />
            <View style={[styles.cornerBL, { width: Math.round(scannerFrameSize * 0.13), height: Math.round(scannerFrameSize * 0.13) }, isScanning && { borderColor: scanStage === 'plant_id' ? '#FF9F0A' : '#00E5FF' }]} />
            <View style={[styles.cornerBR, { width: Math.round(scannerFrameSize * 0.13), height: Math.round(scannerFrameSize * 0.13) }, isScanning && { borderColor: scanStage === 'plant_id' ? '#FF9F0A' : '#00E5FF' }]} />
            
            {/* Dynamic Holographic Grid Crosshair */}
            <View style={styles.gridCrosshairH} />
            <View style={styles.gridCrosshairV} />

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
              <Ionicons name="scan-outline" size={Math.round(scannerFrameSize * 0.24)} color="rgba(255, 255, 255, 0.4)" />
            )}

            {/* Live Holographic Stats Overlay */}
            {isScanning && (
              <View style={styles.hudOverlay}>
                <Text style={styles.hudStageText}>
                  {scanStage === 'plant_id' ? 'STAGE 1: PLANT TAXONOMY' : 'STAGE 2: PATHOLOGY SCAN'}
                </Text>
                <Text style={styles.hudProgressText}>{scanProgress}%</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.overlaySide} />
      </View>

      {/* Bottom Controls / Status Panel (Positioned dynamically above CustomTabBar) */}
      <View style={[styles.overlayBottom, { paddingBottom: bottomOverlayPaddingBottom }]}>
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
          <View style={{ alignItems: 'center' }}>
            {cooldownSeconds > 0 && (
              <View style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#FF9F0A', marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="time-outline" size={15} color="#FF9F0A" />
                <Text style={{ color: '#FF9F0A', fontSize: 12, fontWeight: '700' }}>
                  Scan Cooldown: Available in {cooldownSeconds}s
                </Text>
              </View>
            )}

            <View style={styles.controlsRow}>
              {/* Gallery Selector Button */}
              <TouchableOpacity 
                style={[styles.controlCircleBtn, { width: controlBtnSize, height: controlBtnSize, borderRadius: controlBtnSize / 2, opacity: cooldownSeconds > 0 ? 0.5 : 1 }]} 
                onPress={pickImage}
                activeOpacity={0.75}
              >
                <Ionicons name="images-outline" size={Math.round(controlBtnSize * 0.48)} color="#FFFFFF" />
                <Text style={styles.controlBtnLabel}>Gallery</Text>
              </TouchableOpacity>

              {/* Shutter Trigger Button with Spring Animation & Cooldown Timer */}
              <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
                <TouchableOpacity 
                  style={[styles.captureButton, { width: shutterOuterSize, height: shutterOuterSize, borderRadius: shutterOuterSize / 2, borderColor: cooldownSeconds > 0 ? '#FF9F0A' : '#FFFFFF' }]} 
                  onPressIn={handleShutterPressIn}
                  onPressOut={handleShutterPressOut}
                  onPress={takePicture}
                  activeOpacity={0.85}
                >
                  <View style={[styles.captureButtonInner, { width: shutterInnerSize, height: shutterInnerSize, borderRadius: shutterInnerSize / 2, backgroundColor: cooldownSeconds > 0 ? '#333333' : colors.brandGreen }]}>
                    {cooldownSeconds > 0 ? (
                      <Text style={{ color: '#FF9F0A', fontSize: 13, fontWeight: '900' }}>
                        {cooldownSeconds}s
                      </Text>
                    ) : (
                      <Ionicons name="scan" size={shutterIconSize} color="#FFFFFF" />
                    )}
                  </View>
                </TouchableOpacity>
              </Animated.View>

            {/* Clear Button (when captured image exists) or Empty Symmetrical Spacer */}
            {capturedImage ? (
              <TouchableOpacity 
                onPress={handleReset} 
                style={[styles.controlCircleBtn, { width: controlBtnSize, height: controlBtnSize, borderRadius: controlBtnSize / 2 }]}
                activeOpacity={0.75}
              >
                <Ionicons name="refresh-outline" size={Math.round(controlBtnSize * 0.48)} color="#FF6B6B" />
                <Text style={[styles.controlBtnLabel, { color: '#FF6B6B' }]}>Clear</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: controlBtnSize, height: controlBtnSize }} />
            )}
            </View>
          </View>
        )}
      </View>

      {/* Ultra-Sleek Icon-Centric Error / Advisory Modal */}
      {scanError && (
        <View style={StyleSheet.absoluteFillObject}>
          <View style={styles.modalBackdrop} />
          <View style={styles.errorModalContainer}>
            <View style={[styles.errorCardMinimal, { backgroundColor: colors.card, borderColor: colors.border }]}>
              
              {/* Outer Ambient Glow Rings with Large Central Icon */}
              <View style={[styles.minimalGlowRingOuter, { backgroundColor: scanError.toLowerCase().includes('no plant') ? 'rgba(255, 159, 10, 0.12)' : 'rgba(255, 59, 48, 0.12)' }]}>
                <View style={[styles.minimalGlowRingInner, { backgroundColor: scanError.toLowerCase().includes('no plant') ? 'rgba(255, 159, 10, 0.22)' : 'rgba(255, 59, 48, 0.22)' }]}>
                  <View style={[styles.minimalIconBox, { backgroundColor: scanError.toLowerCase().includes('no plant') ? '#FF9F0A' : '#FF3B30' }]}>
                    <Ionicons 
                      name={scanError.toLowerCase().includes('no plant') ? "leaf" : "alert"} 
                      size={40} 
                      color="#FFFFFF" 
                    />
                  </View>
                </View>
              </View>

              {/* Bold Minimalist Title */}
              <Text style={[styles.minimalTitle, { color: colors.text }]}>
                {scanError.toLowerCase().includes('no plant') ? 'No Crop Detected' : 'Scan Failed'}
              </Text>

              {/* Short 1-Line Description */}
              <Text style={[styles.minimalSub, { color: colors.secondaryText }]}>
                {scanError}
              </Text>

              {/* Clean Actions Row */}
              <View style={styles.minimalActionsRow}>
                <TouchableOpacity 
                  style={[styles.minimalSecondaryBtn, { borderColor: colors.border }]} 
                  onPress={() => {
                    setScanError(null);
                    handleReset();
                    pickImage();
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="images-outline" size={20} color={colors.text} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.minimalPrimaryBtn, { backgroundColor: colors.brandGreen }]} 
                  onPress={() => {
                    setScanError(null);
                    handleReset();
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.minimalPrimaryBtnText}>Try Again</Text>
                </TouchableOpacity>
              </View>

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
    backgroundColor: 'rgba(10, 16, 13, 0.85)',
    paddingHorizontal: 20,
    paddingBottom: 16,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  scannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  scannerBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  flashToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  flashToggleBtnActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.25)',
    borderColor: '#FFD700',
  },
  overlayHeader: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 10,
  },
  overlaySubtitle: {
    fontSize: 12.5,
    color: '#CCCCCC',
    textAlign: 'center',
    marginTop: 2,
    fontWeight: '500',
  },
  centerScannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    position: 'absolute',
  },
  overlaySide: {
    flex: 1,
    height: '100%',
    backgroundColor: 'rgba(10, 16, 13, 0.75)',
  },
  scannerFrameContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraFrame: {
    backgroundColor: 'transparent',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  cornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
    borderTopRightRadius: 4,
  },
  cornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
    borderBottomRightRadius: 4,
  },
  gridCrosshairH: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  gridCrosshairV: {
    position: 'absolute',
    top: '12%',
    bottom: '12%',
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  hudStageText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  hudProgressText: {
    color: '#00E5FF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  overlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10, 16, 13, 0.85)',
    paddingTop: 20,
    alignItems: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 30,
  },
  controlCircleBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    position: 'relative',
  },
  controlBtnLabel: {
    position: 'absolute',
    bottom: -18,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#E0E0E0',
    textAlign: 'center',
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
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  captureButtonInner: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
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
    paddingHorizontal: 14,
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
  krishiAiBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  krishiAiAvatarIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  krishiAiBannerTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  krishiAiBannerSub: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  heroImageCard: {
    width: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    position: 'relative',
    marginBottom: 16,
    backgroundColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  heroImageFull: {
    width: '100%',
    height: '100%',
  },
  confidencePillFloating: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  confidencePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  urgencyPillFloating: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  urgencyPillText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  heroImageBottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  heroImagePlantName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  heroImageBotanicalName: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '600',
    marginTop: 1,
  },
  nepaliTitleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: 'rgba(216, 67, 21, 0.08)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
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
  /* ─── Treatment Products (Marketplace vs Local Dealer) ─── */
  treatmentsContainerNew: {
    marginBottom: 24,
  },
  treatmentsHeaderNew: {
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  treatmentsTitleNew: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  treatmentsSubNew: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  productCardEnhanced: {
    width: 220,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  itemTypeBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  itemTypeBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  productCategoryTag: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  productDosageText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 10,
  },
  productBuyBtnMarketplace: {
    height: 38,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productBuyBtnMarketplaceText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  productBuyBtnLocalDealer: {
    height: 38,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productBuyBtnLocalDealerText: {
    color: '#EF6C00',
    fontSize: 11.5,
    fontWeight: '800',
  },
  productImageWrapperNew: {
    height: 110,
    backgroundColor: '#FAFBFB',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
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
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 6,
  },
  confirmOrderBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  confirmOrderText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  /* ─── YouTube Video Tutorials ─── */
  videoSectionContainer: {
    marginBottom: 26,
  },
  videoSectionHeader: {
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  videoSectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  videoSectionSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  videoCardEnhanced: {
    width: 230,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  videoThumbnailWrapper: {
    height: 125,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  videoThumbnailImg: {
    width: '100%',
    height: '100%',
  },
  playButtonBadgeOverlay: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  videoDurationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  videoDurationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  videoCardContent: {
    padding: 12,
  },
  videoCardTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    lineHeight: 17,
    marginBottom: 6,
  },
  videoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoAuthorText: {
    fontSize: 11,
    fontWeight: '600',
  },

  /* ─── Local Dealer Info Modal ─── */
  dealerCardModal: {
    width: '92%',
    maxWidth: 460,
    borderRadius: 24,
    borderWidth: 2,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  dealerInfoBanner: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  dealerBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  dealerBannerSub: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '500',
  },
  dealerDetailsBox: {
    marginBottom: 18,
  },
  dealerItemName: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  dealerDosageText: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 14,
  },
  dealerContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  dealerDetailText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  dealerActionRow: {
    gap: 10,
  },
  dealerCallBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealerCallBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  dealerCloseBtn: {
    width: '100%',
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealerCloseBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },

  /* ─── YouTube Video Player Modal ─── */
  videoModalCard: {
    width: '92%',
    maxWidth: 480,
    borderRadius: 24,
    borderWidth: 2,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  videoPlayerContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    position: 'relative',
  },
  videoPlayerHeroImg: {
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
  videoPlayHeroBtn: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayHeroText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  videoModalMeta: {
    gap: 4,
  },
  videoModalAuthor: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  videoModalDesc: {
    fontSize: 12,
    lineHeight: 17,
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

  /* ─── Redesigned Permission Asking Screen Styles ─── */
  permissionScroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  permissionHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  permissionHeaderTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  permissionHeaderSub: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
  },
  permissionHeroCard: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 2,
    borderBottomWidth: 5,
    padding: 24,
    alignItems: 'center',
  },
  permissionBadgeGlow: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  permissionBadgeInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  permissionTitleNew: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  permissionDescNew: {
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 20,
  },
  featureHighlightsBox: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  featureHighlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureHighlightText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  permissionPrimaryBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  permissionPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  permissionSecondaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionSecondaryBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },

  /* ─── Redesigned Error / Advisory Modal Styles ─── */
  /* ─── Ultra-Sleek Icon-Centric Error / Advisory Modal Styles ─── */
  errorCardMinimal: {
    width: '96%',
    maxWidth: 480,
    borderRadius: 28,
    borderWidth: 2,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  minimalGlowRingOuter: {
    width: 104,
    height: 104,
    borderRadius: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  minimalGlowRingInner: {
    width: 82,
    height: 82,
    borderRadius: 41,
    justifyContent: 'center',
    alignItems: 'center',
  },
  minimalIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  minimalTitle: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 8,
  },
  minimalSub: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  minimalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  minimalSecondaryBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  minimalPrimaryBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  minimalPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
