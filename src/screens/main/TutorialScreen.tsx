import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ImageBackground,
  Modal,
  Dimensions,
  StatusBar,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../lib/ThemeContext';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import { fetchGoogleYouTubeVideos, YouTubeFarmingItem } from '../../lib/youtubeService';
import { getDailyGrokVideoRecommendation, GrokMatchedVideoResult } from '../../lib/grokVideoRecommender';
import { filterYouTubeVideosWithGrokAI } from '../../lib/grokVideoCurator';
import { parseYouTubeVideoDetailsWithGrokAI, GrokParsedVideoDetails, preloadWakeupBackend } from '../../lib/grokSubtitleParser';
import { LiveAIPipelineInspectorModal } from '../../components/LiveAIPipelineInspectorModal';
import { DynamicAIVideoCard } from '../../components/DynamicAIVideoCard';
let WebView: any = View;
if (Platform.OS !== 'web') {
  try {
    WebView = require('react-native-webview').WebView;
  } catch (e) {}
}

const { width: SW } = Dimensions.get('window');

function getVideoId(youtubeId?: string, rawUrl?: string): string {
  let id = youtubeId || '';
  if (!id && rawUrl) {
    const match = rawUrl.match(/(?:v=|\/embed\/|\/watch\?v=|\/v\/|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
    if (match && match[1]) id = match[1];
  }
  return id || 'L2zFX4uWFic';
}

const SkeletonHeroCard = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.85, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const bg = isDarkMode ? '#233325' : '#dceddd';

  return (
    <Animated.View style={[{ width: SW * 0.84, height: 180, backgroundColor: bg, opacity: pulseAnim, borderRadius: 22 }]} />
  );
};

const SkeletonCard = ({ isDarkMode, colors }: { isDarkMode: boolean; colors: any }) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.85, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const bg = isDarkMode ? '#233325' : '#dceddd';

  return (
    <View style={[styles.guideCard, { backgroundColor: colors.card, borderColor: colors.border, gap: 12 }]}>
      <Animated.View style={[styles.cardThumbnail, { backgroundColor: bg, opacity: pulseAnim, borderRadius: 14 }]} />
      <View style={{ flex: 1, gap: 8, justifyContent: 'center' }}>
        <Animated.View style={{ width: '40%', height: 12, backgroundColor: bg, opacity: pulseAnim, borderRadius: 6 }} />
        <Animated.View style={{ width: '90%', height: 16, backgroundColor: bg, opacity: pulseAnim, borderRadius: 6 }} />
        <Animated.View style={{ width: '60%', height: 12, backgroundColor: bg, opacity: pulseAnim, borderRadius: 6 }} />
      </View>
    </View>
  );
};

export interface CropGuideItem {
  id: string;
  cropType: 'rice' | 'maize' | 'potato' | 'wheat' | 'vegetable' | 'mustard';
  topic: 'plantation' | 'irrigation' | 'pesticide' | 'fertilizer';
  titleEn: string;
  titleNe: string;
  subtitleEn: string;
  subtitleNe: string;
  cropNameEn: string;
  cropNameNe: string;
  topicLabelEn: string;
  topicLabelNe: string;
  duration: string;
  views: string;
  rating: string;
  authorEn: string;
  authorNe: string;
  image: any;
  timingBadgeEn: string;
  timingBadgeNe: string;
  dosageSummaryEn: string;
  dosageSummaryNe: string;
  stepsEn: string[];
  stepsNe: string[];
  precautionsEn: string[];
  precautionsNe: string[];
  youtubeId?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  viewsText?: string;
  dosageTable: {
    unit: string;
    basalEn: string;
    basalNe: string;
    topDressEn: string;
    topDressNe: string;
    sprayEn: string;
    sprayNe: string;
  };
}

const CROP_TUTORIAL_DATA: CropGuideItem[] = [
  // RICE / PADDY GUIDES
  {
    id: 'rice-plant-1',
    cropType: 'rice',
    topic: 'plantation',
    titleEn: 'Paddy Nursery Bed Preparation & High-Yield SRI Transplanting',
    titleNe: 'धानको बीउ ब्याड तयारी र वैज्ञानिक रोपाईं प्रविधि (SRI Method)',
    subtitleEn: 'Learn optimal seed soaking, Trichoderma treatment, nursery bed making, and 25x25 cm hill spacing.',
    subtitleNe: 'बीउ उपचार, बेर्ना ब्याड तयारी र २५x२५ सेमि फराकिलो हारमा कलिलो बेर्ना सार्ने तरिका।',
    cropNameEn: 'Paddy / Rice',
    cropNameNe: 'धान खेती',
    topicLabelEn: 'Plantation & Nursery',
    topicLabelNe: 'रोप्ने तथा ब्याड तयारी',
    duration: '06:15 min',
    views: '8.4k',
    rating: '4.9',
    authorEn: 'NARC Rice Station',
    authorNe: 'NARC धान अनुसन्धान',
    image: require('../../../assets/images/carousel_chitwan.jpg'),
    timingBadgeEn: 'Sowing Season: May - June',
    timingBadgeNe: 'रोप्ने समय: जेठ दोस्रो हप्ता देखि असारसम्म',
    dosageSummaryEn: 'Seed Rate: 2.5 kg per Kattha (75 kg / Bigha)',
    dosageSummaryNe: 'बीउ दर: प्रति कट्ठा २.५ केजी (प्रमाणित हर्दिनाथ-१ वा चैते-२)',
    stepsEn: [
      'Soak seeds in salt water (1 kg salt in 10L water) to separate light & empty seeds.',
      'Treat healthy seeds with Trichoderma viride (5g / kg seed) to prevent Bakanae foot rot.',
      'Prepare raised nursery beds of 1 meter width with rich compost and ash.',
      'Uproot young 10-14 day old seedlings gently with soil intact.',
      'Transplant single seedling per hill at 25 cm x 25 cm spacing in shallow 2 cm depth.'
    ],
    stepsNe: [
      '१ लिटर पानीमा १०० ग्राम नुन हालेर बीउ डुबाउनुहोस् र उत्रिएका फोका बीउ फाल्नुहोस्।',
      'निरोगी बीउलाई ट्राइकोडर्मा (५ ग्राम प्रति केजी बीउ) बाट सोधन गरी ब्याडमा छर्नुहोस्।',
      '१ मिटर चौडा अग्लो ब्याड बनाएर राम्ररी सडेको गोबर मल र खरानी मिसाउनुहोस्।',
      '१० देखि १४ दिनको कलिलो बेर्ना जरामा माटोसहित होसियारीपूर्वक उखेल्नुहोस्।',
      '२५ सेमि x २५ सेमि फराकिलो दूरीमा १-१ वटा बेर्ना २ सेमि गहिराइमा मात्र रोप्नुहोस्।'
    ],
    precautionsEn: [
      'Never transplant old seedlings above 25 days as tillering capacity drops drastically.',
      'Ensure field is leveled properly to avoid water pooling in patches.'
    ],
    precautionsNe: [
      '२५ दिनभन्दा पुरानो बेर्ना नरोप्नुहोस्, यसले झाङ हाल्ने क्षमता घटाउँछ।',
      'खेतलाई राम्ररी सम्याउनुहोस् (Leveling) ताकि पानी एकातिर मात्र नजमोस्।'
    ],
    dosageTable: {
      unit: 'Per Kattha',
      basalEn: 'Seed: 2.5 kg | Compost: 150 kg',
      basalNe: 'धानको बीउ: २.५ केजी | प्राङ्गारिक मल: १५० केजी',
      topDressEn: 'DAP: 3.5 kg | Potash: 1.5 kg',
      topDressNe: 'डी.ए.पी. मल: ३.५ केजी | पोटाश: १.५ केजी',
      sprayEn: 'Zinc Sulphate: 500g at transplanting',
      sprayNe: 'जिङ्क सल्फेट: ५०० ग्राम (रोपाईँको बेला)',
    }
  },
  {
    id: 'rice-irrig-1',
    cropType: 'rice',
    topic: 'irrigation',
    titleEn: 'Alternate Wetting & Drying (AWD) Smart Rice Irrigation',
    titleNe: 'धानमा पानी बचत गर्ने अलटरनेट वेटिङ एण्ड ड्राइङ (AWD) सिँचाइ तरिका',
    subtitleEn: 'Avoid continuous deep flooding; save 35% pump diesel by monitoring soil moisture perforations.',
    subtitleNe: 'खेतमा लगातार पानी जमाउनुको साटो माटो ओसिलो मात्र राखेर सिँचाइ खर्च ३५% घटाउनुहोस्।',
    cropNameEn: 'Paddy / Rice',
    cropNameNe: 'धान खेती',
    topicLabelEn: 'Smart Irrigation',
    topicLabelNe: 'सिँचाइ व्यवस्थापन',
    duration: '04:50 min',
    views: '6.1k',
    rating: '5.0',
    authorEn: 'Irrigation Dept Nepal',
    authorNe: 'सिँचाइ विभाग नेपाल',
    image: require('../../../assets/images/masterclass_smart_irrigation.jpg'),
    timingBadgeEn: 'Critical Stages: Tillering & Panicle Initiation',
    timingBadgeNe: 'मुख्य सिँचाइ समय: गछ्यान हाल्ने र बाला आउने चरण',
    dosageSummaryEn: 'Maintain 2-3 cm water depth; dry field when water drops below 15 cm soil depth',
    dosageSummaryNe: 'माटोको सतहमुनि १५ सेमि गहिराइमा पानीको तह पुगेपछि मात्र अर्को सिँचाइ दिनुहोस्',
    stepsEn: [
      'Install a 30 cm perforated field PVC pipe 15 cm deep into your rice field.',
      'Irrigate to 3-5 cm water standing depth right after transplanting for 10 days.',
      'Allow field water level to naturally drop until water table in pipe is 15 cm below ground.',
      'Re-apply 5 cm irrigation water once water level in pipe drops to bottom marker.',
      'Keep field flooded 2-5 cm during flowering stage to prevent empty chaff grains.'
    ],
    stepsNe: [
      'खेतमा १५ सेमि गहिराइमा प्वाल पारिएको ३० सेमि लामो प्लास्टिक पाइप (AWD Pipe) गाड्नुहोस्।',
      'रोपेको पहिलो १० दिनसम्म बिरुवा सप्रिन २-३ सेमि पानी जमाइराख्नुहोस्।',
      'त्यसपछि पानी सुक्न दिनुहोस् र पाइप भित्र १५ सेमि गहिराइमा पानी पुगेपछि मात्र सिँचाइ गर्नुहोस्।',
      'फूल फुल्ने र बाला भर्ने समयमा (Flowering Stage) खेतमा कम्तीमा २ सेमि पानी कायम राख्नुहोस्।',
      'धान पाक्नु भन्दा १०-१२ दिन अघि खेतबाट पूर्ण रूपमा पानी सुकाउनुहोस्।'
    ],
    precautionsEn: [
      'Do NOT allow field to crack dry during flowering stage as pollen fertility will drop.',
      'Drain water 12 days before harvesting to promote uniform golden grain ripening.'
    ],
    precautionsNe: [
      'फूल फूलेको बेला खेतलाई कदापि सुख्खा हुन नदिनुहोस्, नत्र भुस धेरै हुन्छ।',
      'धान काट्नु १२ दिन अघि खेतको पानी पूर्ण रूपमा सुकाएर निकास गर्नुहोस्।'
    ],
    dosageTable: {
      unit: 'Per Kattha / Pump Cycle',
      basalEn: 'First 10 Days: 3 cm Standing Water',
      basalNe: 'पहिलो १० दिन: २-३ सेमि जमेको पानी',
      topDressEn: 'AWD Cycle: Irrigate every 5-7 days',
      topDressNe: 'AWD चक्र: प्रत्येक ५-७ दिनको अन्तरालमा सिँचाइ',
      sprayEn: 'Flowering Stage: 5 cm mandatory water',
      sprayNe: 'फूल फूल्ने चरण: ५ सेमि अनिवार्य सिँचाइ',
    }
  },
  {
    id: 'rice-pest-1',
    cropType: 'rice',
    topic: 'pesticide',
    titleEn: 'Rice Blast & Stem Borer Pesticide Dosage & Spray Safety',
    titleNe: 'धानको डढुवा (Blast) र काण्ड छेदक कीराको विषादी प्रयोग र सुरक्षा विधि',
    subtitleEn: 'Identify spindle-shaped leaf spots and deadhearts; apply Tricyclazole and Chlorantraniliprole.',
    subtitleNe: 'ब्लास्ट रोग र गाभो काट्ने कीरा (Stem Borer) को लक्षण र सही विषादी छर्कने तरिका।',
    cropNameEn: 'Paddy / Rice',
    cropNameNe: 'धान खेती',
    topicLabelEn: 'Pesticide & Disease',
    topicLabelNe: 'विषादी र रोग नियन्त्रण',
    duration: '05:30 min',
    views: '7.8k',
    rating: '4.8',
    authorEn: 'NARC Plant Pathology',
    authorNe: 'NARC बाली रोग विज्ञान',
    image: require('../../../assets/images/masterclass_high_yield.jpg'),
    timingBadgeEn: 'Spray Window: Early Morning or Late Afternoon',
    timingBadgeNe: 'छर्कने उपयुक्त समय: बिहान ९ बजे अघि वा बेलुका ४ बजे पछि',
    dosageSummaryEn: 'Tricyclazole 75% WP: 0.6g / Liter | Chlorantraniliprole 18.5% SC: 0.4 ml / Liter',
    dosageSummaryNe: 'ट्राइसाइकलाजोल (Beam): ०.६ ग्राम/लिटर | क्लोरान्ट्रानिलिप्रोल (Coragen): ०.४ एमएल/लिटर',
    stepsEn: [
      'Inspect leaves for eye-shaped brown lesions with yellow halos (Rice Blast disease).',
      'For Blast: Dissolve 10 grams Tricyclazole 75% WP in 16 Liters battery sprayer pump.',
      'For Stem Borer (Deadheart): Mix 6 ml Chlorantraniliprole 18.5% SC in 16L sprayer pump.',
      'Wear protective face mask, rubber gloves, and long sleeves during spraying.',
      'Spray uniformly targeting both upper and lower leaf surfaces against wind direction.'
    ],
    stepsNe: [
      'धानको पातमा आँखा आकारका खैरा चक्का र पहेँलो घेरा (Blast) देखा परेमा तुरुन्त निगरानी गर्नुहोस्।',
      'डढुवा (Blast) को लागि: १६ लिटरको ब्याट्री स्प्रेयरमा १० ग्राम ट्राइसाइकलाजोल ७५% (Beam) घोल्नुहोस्।',
      'गाभो काट्ने कीरा (Stem Borer) को लागि: १६ लिटर ट्याङ्कीमा ६ एमएल क्लोरान्ट्रानिलिप्रोल (Coragen) हाल्नुहोस्।',
      'विषादी छर्कँदा सधैं मास्क, पञ्जा र पूरा बाहुला भएको लुगा लगाउनुहोस्।',
      'हावाको दिशाको अनुकूल भई बिहान वा बेलुकीको समयमा पात भिझ्ने गरी छर्कनुहोस्।'
    ],
    precautionsEn: [
      'Do NOT eat, smoke, or drink while mixing or spraying chemical pesticides.',
      'Maintain 15-day withholding safety period before harvesting paddy.'
    ],
    precautionsNe: [
      'विषादी घोल्दा वा छर्कँदा धूम्रपान, खानपिन वा अनुहार छुने काम नगर्नुहोस्।',
      'विषादी छर्केको १५ दिनसम्म धान काटेर प्रयोग नगर्नुहोस् (Safety Period)।'
    ],
    dosageTable: {
      unit: 'Per 16 Liter Sprayer Pump',
      basalEn: 'Tricyclazole (Blast): 10 grams / pump',
      basalNe: 'ट्राइसाइकलाजोल (डढुवा रोग): १० ग्राम / ट्याङ्की',
      topDressEn: 'Coragen (Stem Borer): 6 ml / pump',
      topDressNe: 'कोराजिन (गाभो छेदक कीरा): ६ एमएल / ट्याङ्की',
      sprayEn: 'Neem Extract (Organic): 50 ml / pump',
      sprayNe: 'निमको जैविक झोल: ५० एमएल / ट्याङ्की',
    }
  },

  // MAIZE GUIDES
  {
    id: 'maize-plant-1',
    cropType: 'maize',
    topic: 'plantation',
    titleEn: 'Rampur Hybrid-10 Maize Planting, Ridging & Spacing',
    titleNe: 'रामपुर हाइब्रिड-१० मकै रोप्ने, दूरी कायम गर्ने र ड्याङ बनाउने तरिका',
    subtitleEn: 'High-density hybrid maize sowing at 60 cm line and 20 cm seed spacing with balanced NPK.',
    subtitleNe: '६० सेमि ड्याङ र २० सेमि बोटको दूरीमा मकै रोपेर घोगा भरिलो बनाउने तरिका।',
    cropNameEn: 'Maize / Corn',
    cropNameNe: 'मकै खेती',
    topicLabelEn: 'Maize Plantation',
    topicLabelNe: 'मकै रोप्ने तरिका',
    duration: '05:10 min',
    views: '6.7k',
    rating: '4.9',
    authorEn: 'National Maize Program',
    authorNe: 'NARC मकै अनुसन्धान',
    image: require('../../../assets/images/carousel_kathmandu.jpg'),
    timingBadgeEn: 'Spring Sowing: Feb - Mar | Monsoon Sowing: May - June',
    timingBadgeNe: 'फागुन - चैत (वसन्त) र जेठ - असार (वर्षात्)',
    dosageSummaryEn: 'Seed Rate: 1.2 kg per Kattha (Rampur Hybrid-10)',
    dosageSummaryNe: 'बीउ दर: प्रति कट्ठा १.२ केजी (रामपुर हाइब्रिड-१० वा सीपी-८०८)',
    stepsEn: [
      'Plow land twice and mix compost (200 kg / Kattha) and DAP (4 kg / Kattha).',
      'Make 60 cm wide raised ridges to allow easy drainage during heavy rains.',
      'Plant seeds 4-5 cm deep at 20 cm seed-to-seed distance along the ridge line.',
      'Perform light irrigation immediately after sowing to trigger uniform germination.',
      'Thin out weak double seedlings 12 days after emergence to keep 1 healthy plant.'
    ],
    stepsNe: [
      'खेतलाई २ पटक जोतेर प्रति कट्ठा २०० केजी गोबर मल र ४ केजी DAP मल माटोमा मिसाउनुहोस्।',
      'वर्षात्‌को पानी जम्न नदिन ६० सेमि दूरीमा अग्लो ड्याङ (Ridge) बनाउनुहोस्।',
      'ड्याङको छेउमा ४-५ सेमि गहिराइमा २० सेमि बोटदेखि बोटको दूरीमा मकै रोप्नुहोस्।',
      'रोपेपछि मकै अङ्कुरण गराउन हल्का सिँचाइ (Light Irrigation) दिनुहोस्।',
      'उम्रिएको १२ दिनपछि दुईवटा बेर्ना पलाएको ठाउँमा १ वटा बलीयो बेर्ना मात्र राख्नुहोस्।'
    ],
    precautionsEn: [
      'Never plant seeds deeper than 6 cm as germination rate will drop.',
      'Ensure ridge drainage channels are clear to prevent root rot.'
    ],
    precautionsNe: [
      'बीउ ६ सेमि भन्दा बढी गहिरो नरोप्नुहोस्, नत्र अङ्कुरण हुन सक्दैन।',
      'बोटको जरा कुहिनबाट जोगाउन ड्याङको निकास कुलो सफा राख्नुहोस्।'
    ],
    dosageTable: {
      unit: 'Per Kattha',
      basalEn: 'Seed: 1.2 kg | Compost: 200 kg',
      basalNe: 'मकैको बीउ: १.२ केजी | गोबर मल: २०० केजी',
      topDressEn: 'DAP: 4 kg | Potash: 2 kg',
      topDressNe: 'डी.ए.पी. मल: ४ केजी | पोटाश: २ केजी',
      sprayEn: 'Urea Top-Dress: 3 kg at Knee-High stage',
      sprayNe: 'युरिया मल: ३ केजी (घँडासम्म मकै आउँदा)',
    }
  },
  {
    id: 'maize-pest-1',
    cropType: 'maize',
    topic: 'pesticide',
    titleEn: 'Fall Armyworm IPM Control & Emamectin Benzoate Whorl Dosage',
    titleNe: 'मकैको फौजी कीरा (Fall Armyworm) नियन्त्रण र चोगा भित्र विषादी हाल्ने तरिका',
    subtitleEn: 'Protect corn cobs from armyworm whorl destruction using Bio-Neem, sand-ash, and Emamectin.',
    subtitleNe: 'मकैको चोगा भित्र पसेर खाने फौजी कीरा नियन्त्रणका लागि इमामेक्टिन बेन्जोएट प्रयोग।',
    cropNameEn: 'Maize / Corn',
    cropNameNe: 'मकै खेती',
    topicLabelEn: 'Armyworm Protection',
    topicLabelNe: 'फौजी कीरा नियन्त्रण',
    duration: '05:45 min',
    views: '9.2k',
    rating: '5.0',
    authorEn: 'NARC Entomology Dept',
    authorNe: 'NARC कीट विज्ञान',
    image: require('../../../assets/images/carousel_kathmandu.jpg'),
    timingBadgeEn: 'Inspection: Weekly from 10 days after germination',
    timingBadgeNe: 'अनुगमन: मकै उम्रिएको १० दिनपछि प्रत्येक हप्ता चोगा हेर्ने',
    dosageSummaryEn: 'Emamectin Benzoate 5% SG: 0.4g / Liter water applied into central whorl',
    dosageSummaryNe: 'इमामेक्टिन बेन्जोएट ५% (Proclaim): ०.४ ग्राम / लिटर (चोगा भित्र पर्ने गरी)',
    stepsEn: [
      'Inspect 20 random maize plants for pinholes or sawdust-like caterpillar frass in central whorls.',
      'For low infestation (<5%): Drop pinch of dry sand-ash mixture or bio-neem dust into whorls.',
      'For heavy infestation (>10%): Dissolve 6.5 grams Emamectin Benzoate 5% SG in 16L pump.',
      'Adjust sprayer nozzle to a direct stream and direct spray straight into central plant whorl.',
      'Repeat spray after 10 days if fresh whorl damage is detected.'
    ],
    stepsNe: [
      'मकैको चोगा भित्र ससाना प्वाल र कीराको दिशा (Frass) छ वा छैन हप्तामा २ पटक अनुगमन गर्नुहोस्।',
      'प्रकोप कम हुँदा: मकैको चोगा भित्र सुक्खा काठको खरानी वा निमको धुलो १-१ चिम्टी हाल्नुहोस्।',
      'प्रकोप बढी हुँदा: १६ लिटर ट्याङ्कीमा ६.५ ग्राम इमामेक्टिन बेन्जोएट ५% SG (Proclaim) घोल्नुहोस्।',
      'स्प्रेयरको नोझल सोझो पारेर मकैको चोगा भित्रै औषधि पर्ने गरी छर्कनुहोस्।',
      'ताजा चोगा काटिएको भेटिएमा १० दिनपछि पुनः दोहोर्‍याएर छर्कनुहोस्।'
    ],
    precautionsEn: [
      'Always spray during early morning before 9 AM when caterpillars feed actively in whorls.',
      'Do NOT spray broad-spectrum liquid pesticides haphazardly over leaves.'
    ],
    precautionsNe: [
      'कीरा बिहान सक्रिय हुने भएकाले बिहान ९ बजे अघि नै चोगा भित्र स्प्रे गर्नुहोस्।',
      'पात माथि हावामा विषादी नउडाउनुहोस्, सोझै चोगा भित्र हाल्नुहोस्।'
    ],
    dosageTable: {
      unit: 'Per 16 Liter Sprayer Pump',
      basalEn: 'Emamectin Benzoate: 6.5 grams / pump',
      basalNe: 'इमामेक्टिन बेन्जोएट (Proclaim): ६.५ ग्राम / ट्याङ्की',
      topDressEn: 'Spinctor (Spinosad): 5 ml / pump',
      topDressNe: 'स्पिनोस्याड (Spinctor): ५ एमएल / ट्याङ्की',
      sprayEn: 'Sand + Ash Whorl Mixture: 1 pinch / plant',
      sprayNe: 'खरानी र बालुवाको मिश्रण: १ चिम्टी / बोट',
    }
  },

  // POTATO GUIDES
  {
    id: 'potato-plant-1',
    cropType: 'potato',
    topic: 'plantation',
    titleEn: 'Potato Tuber Selection, Sprouting & Ridge Earthing',
    titleNe: 'आलुको बीउ छनोट, टुसाउने प्रविधि र ड्याङ माटो उकास्ने तरिका',
    subtitleEn: 'Select healthy Janakdev seed tubers; plant on 60 cm ridges with organic FYM and Potash.',
    subtitleNe: 'जनकदेव वा कुफ्री ज्योति आलुको निरोगी बीउ, ६० सेमि ड्याङ र माटो उकास्ने विधि।',
    cropNameEn: 'Potato',
    cropNameNe: 'आलु खेती',
    topicLabelEn: 'Potato Sowing',
    topicLabelNe: 'आलु रोप्ने तरिका',
    duration: '06:00 min',
    views: '5.9k',
    rating: '4.8',
    authorEn: 'NARC Potato Program',
    authorNe: 'NARC आलु अनुसन्धान',
    image: require('../../../assets/images/carousel_pokhara.jpg'),
    timingBadgeEn: 'Terai: Oct - Nov | Hills: Jan - Feb',
    timingBadgeNe: 'तराई: असोज - कात्तिक | पहाड: माघ - फागुन',
    dosageSummaryEn: 'Seed Rate: 50-60 kg per Kattha (Janakdev / Kufri Jyoti)',
    dosageSummaryNe: 'बीउ दर: प्रति कट्ठा ५० देखि ६० केजी (टुसा आएको आलु बीउ)',
    stepsEn: [
      'Diffuse-light sprout seed tubers in wooden crates for 15 days until 1 cm green sprouts emerge.',
      'Treat tubers with Mancozeb (2.5g / Liter water) for 10 minutes to prevent tuber rot.',
      'Form 60 cm wide ridges with 200 kg compost, 5 kg DAP, and 3 kg Potash per Kattha.',
      'Place tubers at 20 cm distance along ridges with sprouts facing upward.',
      'Perform 1st earthing up (Earthing soil around stems) 25 days after emergence when plants reach 15 cm.'
    ],
    stepsNe: [
      'आलु बीउलाई उज्यालो छहारीमा १५ दिन राखेर १ सेमि बलियो हरियो टुसा उमार्नुहोस् (Sprouting)।',
      'बीउ कुहिनबाट जोगाउन म्यानकोजेब (२.५ ग्राम प्रति लिटर पानी) को घोलमा १० मिनेट डुबाउनुहोस्।',
      '६० सेमि ड्याङ बनाएर प्रति कट्ठा २०० केजी कम्पोष्ट, ५ केजी DAP र ३ केजी पोटाश मल हाल्नुहोस्।',
      'टुसा माथि फर्कने गरी ड्याङमा २० सेमि दूरीमा आलु बीउ रोप्नुहोस्।',
      'आलुको बोट १५ सेमि अग्लो भएपछि (२५ दिनमा) पहिलो पटक फेदमा मज्जाले माटो उकास्नुहोस्।'
    ],
    precautionsEn: [
      'Do NOT cut small seed tubers below 40 grams as rotting risk increases.',
      'Keep ridges high to prevent greening of exposed tubers under sunlight.'
    ],
    precautionsNe: [
      '४० ग्रामभन्दा साना आलु बीउलाई नकाटी सिङ्गै रोप्नुहोस्।',
      'घाम लागेर आलु हरियो (Solanine toxic) हुन नदिन ड्याङ अल्गो बनाउनुहोस्।'
    ],
    dosageTable: {
      unit: 'Per Kattha',
      basalEn: 'Seed Tubers: 50-60 kg | Compost: 200 kg',
      basalNe: 'आलु बीउ: ५०-६० केजी | गोबर मल: २०० केजी',
      topDressEn: 'DAP: 5 kg | Potash: 3 kg',
      topDressNe: 'डी.ए.पी. मल: ५ केजी | पोटाश: ३ केजी',
      sprayEn: 'Urea Top-Dress: 3 kg at 1st earthing up',
      sprayNe: 'युरिया मल: ३ केजी (पहिलो माटो उकास्दा)',
    }
  },
  {
    id: 'potato-pest-1',
    cropType: 'potato',
    topic: 'pesticide',
    titleEn: 'Potato Late Blight Epidemic Spraying & Fungicide Dosage',
    titleNe: 'आलुको डढुवा (Late Blight) रोग रोकथाम र ढुसीनाशक छर्कने तरिका',
    subtitleEn: 'Prevent catastrophic Late Blight water-soaked leaf spots using Mancozeb & Metalaxyl.',
    subtitleNe: 'शीत र कुहिरो लाग्दा आलुको बोट ५ दिनमै डढाउने Late Blight रोग रोकथाम।',
    cropNameEn: 'Potato',
    cropNameNe: 'आलु खेती',
    topicLabelEn: 'Blight Protection',
    topicLabelNe: 'डढुवा रोग नियन्त्रण',
    duration: '05:25 min',
    views: '8.9k',
    rating: '4.9',
    authorEn: 'Horticultural Centre',
    authorNe: 'बागवानी केन्द्र (कीर्तिपुर)',
    image: require('../../../assets/images/carousel_pokhara.jpg'),
    timingBadgeEn: 'Preventive Spray: Before winter fog onset',
    timingBadgeNe: 'शीत र कुहिरो सुरु हुनु अघि अनिवार्य रोकथाम',
    dosageSummaryEn: 'Mancozeb 75% WP: 2.5g / Liter | Metalaxyl 8% + Mancozeb 64%: 2g / Liter',
    dosageSummaryNe: 'म्यानकोजेब (Dithane M-45): २.५ ग्राम/लिटर | सेक्टिन / क्रिलाक्सिल: २ ग्राम/लिटर',
    stepsEn: [
      'Monitor bottom leaves for dark water-soaked lesions with white cottony fungus underneath.',
      'Preventive (Before Disease): Spray Mancozeb 75% WP (40 grams in 16L pump) every 10 days.',
      'Curative (After Disease Appearance): Spray Metalaxyl + Mancozeb (Krilaxyl 32g in 16L pump).',
      'Coverage: Thoroughly drench upper and lower leaves and soil ridges.',
      'Haulm Cutting: Cut all vines at ground level 10 days before harvesting to prevent tuber infection.'
    ],
    stepsNe: [
      'आलुको तल्लो पातमा कालो ओसिलो दाग र पात पछाडि सेतो ढुसी (Late Blight) हेर्नुहोस्।',
      'रोग लाग्नु अघि (रोकथाम): १६ लिटर ट्याङ्कीमा ४० ग्राम म्यानकोजेब (Dithane M-45) छर्कनुहोस्।',
      'रोग देखा परेपछि (उपचार): १६ लिटर ट्याङ्कीमा ३२ ग्राम क्रिलाक्सिल (Metalaxyl + Mancozeb) हाल्नुहोस्।',
      'पातको अघिल्लो, पछिल्लो भाग र ड्याङको माटोसमेत रुझ्ने गरी स्प्रे गर्नुहोस्।',
      'खन्नु १० दिन अघि आलुको बोट (पात) फेदबाट काटेर फाल्नुहोस् (Haulm cutting)।'
    ],
    precautionsEn: [
      'Do NOT irrigate potatoes during continuous cloudy foggy weather.',
      'Always rotate fungicides with different chemical groups to prevent resistance.'
    ],
    precautionsNe: [
      'बादल र कुहिरो लागेको बेला आलुमा सिँचाइ नगर्नुहोस्, नत्र रोग ह्वात्तै बढ्छ।',
      'ढुसीनाशक विषादी निरन्तर एउटै प्रयोग नगरी फेरि-फेरि छर्कनुहोस्।'
    ],
    dosageTable: {
      unit: 'Per 16 Liter Sprayer Pump',
      basalEn: 'Dithane M-45 (Preventive): 40g / pump',
      basalNe: 'म्यानकोजेब M-45 (रोकथाम): ४० ग्राम / ट्याङ्की',
      topDressEn: 'Krilaxyl / Sectin (Curative): 32g / pump',
      topDressNe: 'क्रिलाक्सिल (रोग देखा परेपछि): ३२ ग्राम / ट्याङ्की',
      sprayEn: 'Copper Oxychloride: 35g / pump',
      sprayNe: 'कपर अक्सिक्लोराइड: ३५ ग्राम / ट्याङ्की',
    }
  }
];

function GrokSubtitleSkeletonLoader({ isDarkMode }: { isDarkMode: boolean }) {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  const bg = isDarkMode ? '#2c332d' : '#e2ebd5';

  return (
    <View style={{ paddingHorizontal: 18, marginTop: 16 }}>
      {/* Grok AI Header Indicator */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <ActivityIndicator size="small" color="#4CAF50" />
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#4CAF50' }}>
          Grok AI Parsing Video Subtitles & Transcripts...
        </Text>
      </View>

      {/* Summary Skeleton */}
      <Animated.View style={{ opacity: pulseAnim, height: 16, width: '85%', backgroundColor: bg, borderRadius: 4, marginBottom: 8 }} />
      <Animated.View style={{ opacity: pulseAnim, height: 16, width: '95%', backgroundColor: bg, borderRadius: 4, marginBottom: 8 }} />
      <Animated.View style={{ opacity: pulseAnim, height: 16, width: '60%', backgroundColor: bg, borderRadius: 4, marginBottom: 20 }} />

      {/* Dosage Table Skeleton */}
      <Animated.View style={{ opacity: pulseAnim, height: 140, width: '100%', backgroundColor: bg, borderRadius: 16, marginBottom: 20 }} />

      {/* Action Steps Skeleton */}
      <Animated.View style={{ opacity: pulseAnim, height: 50, width: '100%', backgroundColor: bg, borderRadius: 12, marginBottom: 10 }} />
      <Animated.View style={{ opacity: pulseAnim, height: 50, width: '100%', backgroundColor: bg, borderRadius: 12, marginBottom: 10 }} />
      <Animated.View style={{ opacity: pulseAnim, height: 50, width: '100%', backgroundColor: bg, borderRadius: 12, marginBottom: 10 }} />
    </View>
  );
}

export default function TutorialScreen() {
  const insets = useSafeAreaInsets();
  const safeTopMargin = insets.top > 0 ? insets.top : (Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44);
  const { colors, isDarkMode } = useTheme();
  const { language } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const [selectedCrop, setSelectedCrop] = useState<string>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGuideModal, setActiveGuideModal] = useState<CropGuideItem | null>(null);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  const [parsedDetails, setParsedDetails] = useState<GrokParsedVideoDetails | null>(null);
  const [isParsingSubtitles, setIsParsingSubtitles] = useState<boolean>(false);
  const [showInspectorModal, setShowInspectorModal] = useState<boolean>(false);

  // Skip AI Subtitle & Transcript Parser for now as requested (Direct 1-Click Video Mode)
  useEffect(() => {
    if (activeGuideModal) {
      console.log(`[TutorialScreen] 📱 Opened Video Guide Modal for: "${activeGuideModal.titleEn || activeGuideModal.titleNe}" (ID: ${activeGuideModal.id})`);
      setIsPlayingVideo(true); // Direct 1-Click Video Playback
    }
  }, [activeGuideModal]);

  // Crop Selector Tabs
  const cropTabs = [
    { id: 'all', labelEn: 'All Crops', labelNe: 'सबै बालीहरू', icon: 'grid-outline' },
    { id: 'rice', labelEn: 'Paddy / Rice', labelNe: 'धान खेती', icon: 'leaf-outline' },
    { id: 'maize', labelEn: 'Maize / Corn', labelNe: 'मकै खेती', icon: 'nutrition-outline' },
    { id: 'potato', labelEn: 'Potato', labelNe: 'आलु खेती', icon: 'earth-outline' },
  ];

  // Core Topic Filters
  const topicFilters = [
    { id: 'all', labelEn: 'All Manuals', labelNe: 'सबै निर्देशिका', icon: 'apps-outline' },
    { id: 'plantation', labelEn: '🌱 Sowing & Nursery', labelNe: '🌱 रोप्ने र ब्याड तयारी', icon: 'sprout-outline' },
    { id: 'irrigation', labelEn: '💧 Smart Irrigation', labelNe: '💧 सिँचाइ समय र तरिका', icon: 'water-outline' },
    { id: 'pesticide', labelEn: '🛡️ Pesticides & Disease', labelNe: '🛡️ विषादी र रोग नियन्त्रण', icon: 'shield-checkmark-outline' },
  ];

  const [googleVideos, setGoogleVideos] = useState<YouTubeFarmingItem[]>([]);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState<boolean>(false);
  const [nextPageToken, setNextPageToken] = useState<string>('');
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // Fetch live videos from Google YouTube Data API v3 for the 5 selected crops (Fast 25-Video Batch)
  useEffect(() => {
    preloadWakeupBackend();
    async function loadGoogleYouTubeVideos() {
      setIsLoadingGoogle(true);
      console.log(`[TutorialScreen UI] Requesting YouTube videos | Selected Crop: "${selectedCrop}" | Search Query: "${searchQuery}"`);
      try {
        const res = await fetchGoogleYouTubeVideos(selectedCrop, searchQuery);
        if (res && res.items && res.items.length > 0) {
          // Pass raw YouTube videos through Grok AI Curator for strict title relevance filtering
          const vettedVideos = await filterYouTubeVideosWithGrokAI(res.items);
          console.log(`[TutorialScreen UI] Loaded ${vettedVideos.length} Grok AI-vetted YouTube videos into screen state.`);
          setGoogleVideos(vettedVideos);
          setNextPageToken(res.nextPageToken || '');
        } else {
          console.warn('[TutorialScreen UI] YouTube API returned empty list, using fallback videos.');
        }
      } catch (err) {
        console.error('[TutorialScreen UI Error] Failed to load YouTube videos:', err);
      } finally {
        setIsLoadingGoogle(false);
      }
    }
    loadGoogleYouTubeVideos();
  }, [selectedCrop, searchQuery]);

  async function handleLoadMore() {
    if (isLoadingMore || !nextPageToken) return;
    setIsLoadingMore(true);
    try {
      const res = await fetchGoogleYouTubeVideos(selectedCrop, searchQuery, nextPageToken);
      if (res && res.items && res.items.length > 0) {
        setGoogleVideos(prev => [...prev, ...res.items]);
        setNextPageToken(res.nextPageToken || '');
      }
    } catch (err) {
      console.warn('Error loading more videos:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }

  // Render ONLY Google YouTube API videos (Zero static mock guides)
  const filteredGuides = useMemo(() => {
    const seenIds = new Set<string>();
    const uniqueCombined: YouTubeFarmingItem[] = [];

    for (const item of googleVideos) {
      if (item && item.id && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        uniqueCombined.push(item);
      }
    }

    return uniqueCombined.filter((item) => {
      const matchCrop = selectedCrop === 'all' || item.cropType === selectedCrop;
      const matchTopic = selectedTopic === 'all' || item.topic === selectedTopic;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchCrop && matchTopic;
      const title = (language === 'ne' ? item.titleNe : item.titleEn).toLowerCase();
      const subtitle = (language === 'ne' ? item.subtitleNe : item.subtitleEn).toLowerCase();
      const author = (language === 'ne' ? item.authorNe : item.authorEn).toLowerCase();
      return matchCrop && matchTopic && (title.includes(q) || subtitle.includes(q) || author.includes(q));
    });
  }, [selectedCrop, selectedTopic, searchQuery, language, googleVideos]);

  const [userFields, setUserFields] = useState<any[]>([]);

  // Fetch farmer's registered fields from Supabase to dynamically customize recommendations
  useEffect(() => {
    async function fetchFarmerFields() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('fields')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          if (data && data.length > 0) {
            setUserFields(data);
          }
        }
      } catch (err) {
        console.warn('Error fetching fields for tutorial recommendations:', err);
      }
    }
    fetchFarmerFields();
  }, []);

  const [grokRecs, setGrokRecs] = useState<GrokMatchedVideoResult[]>([]);
  const [isLoadingGrok, setIsLoadingGrok] = useState<boolean>(false);

  // Run Grok AI Daily Video Recommendation Pipeline
  useEffect(() => {
    async function runGrokPipeline() {
      if (googleVideos.length === 0) return;
      setIsLoadingGrok(true);
      try {
        const results = await getDailyGrokVideoRecommendation(userFields, googleVideos);
        if (results && results.length > 0) {
          setGrokRecs(results);
        }
      } catch (err) {
        console.warn('Grok AI recommendation pipeline error:', err);
      } finally {
        setIsLoadingGrok(false);
      }
    }
    runGrokPipeline();
  }, [googleVideos, userFields]);

  // Dynamically compute recommended guides for ALL registered farmer fields from Grok AI & Google YouTube API
  const recommendedItemsList = useMemo(() => {
    if (grokRecs && grokRecs.length > 0) {
      return grokRecs
        .filter(gr => gr && gr.recommendedVideo)
        .map((gr, idx) => ({
          id: (gr.recommendedVideo?.id || 'grec') + '_' + idx,
          fieldNameEn: gr.fieldNameEn,
          fieldNameNe: gr.fieldNameNe,
          cropTypeEn: gr.recommendedVideo?.cropNameEn || 'Crop',
          cropTypeNe: gr.recommendedVideo?.cropNameNe || 'बाली',
          guide: gr.recommendedVideo,
        }));
    }

    const videoPool: YouTubeFarmingItem[] = googleVideos;
    if (!videoPool || videoPool.length === 0) return [];

    if (userFields && userFields.length > 0) {
      return userFields
        .map((field) => {
          const crop = (field.crop_type || field.crop || field.name || '').toLowerCase();
          let matchingCropType: 'rice' | 'maize' | 'wheat' | 'potato' | 'mustard' = 'rice';
          if (crop.includes('maize') || crop.includes('मकै')) matchingCropType = 'maize';
          else if (crop.includes('potato') || crop.includes('आलु')) matchingCropType = 'potato';
          else if (crop.includes('wheat') || crop.includes('गहुँ')) matchingCropType = 'wheat';
          else if (crop.includes('mustard') || crop.includes('तोरी')) matchingCropType = 'mustard';

          const matchedGuide = videoPool.find(g => g.cropType === matchingCropType) || videoPool[0];
          if (!matchedGuide) return null;

          return {
            id: field.id || field.name,
            fieldNameEn: field.name || 'My Field',
            fieldNameNe: field.name || 'मेरो खेत',
            cropTypeEn: field.crop_type || matchingCropType,
            cropTypeNe: field.crop_type || matchingCropType,
            reasonEn: '',
            reasonNe: '',
            guide: matchedGuide,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
    }

    // Default YouTube API recommended guides for the 5 crops
    const rec1 = videoPool.find(g => g.cropType === 'rice') || videoPool[0];
    const rec2 = videoPool.find(g => g.cropType === 'maize') || videoPool[1] || videoPool[0];
    const rec3 = videoPool.find(g => g.cropType === 'potato') || videoPool[2] || videoPool[0];
    const rec4 = videoPool.find(g => g.cropType === 'mustard') || videoPool[3] || videoPool[0];

    const defaults = [
      rec1 ? { id: 'rec-yt-1', fieldNameEn: 'Daily Grok Recommendation', fieldNameNe: 'दैविक AI सिफारिस', cropTypeEn: 'Paddy', cropTypeNe: 'धान', reasonEn: '', reasonNe: '', guide: rec1 } : null,
      rec2 ? { id: 'rec-yt-2', fieldNameEn: 'Daily Grok Recommendation', fieldNameNe: 'दैविक AI सिफारिस', cropTypeEn: 'Maize', cropTypeNe: 'मकै', reasonEn: '', reasonNe: '', guide: rec2 } : null,
      rec3 ? { id: 'rec-yt-3', fieldNameEn: 'Daily Grok Recommendation', fieldNameNe: 'दैविक AI सिफारिस', cropTypeEn: 'Potato', cropTypeNe: 'आलु', reasonEn: '', reasonNe: '', guide: rec3 } : null,
      rec4 ? { id: 'rec-yt-4', fieldNameEn: 'Daily Grok Recommendation', fieldNameNe: 'दैविक AI सिफारिस', cropTypeEn: 'Mustard', cropTypeNe: 'तोरी', reasonEn: '', reasonNe: '', guide: rec4 } : null,
    ];

    return defaults.filter((item): item is NonNullable<typeof item> => item !== null);
  }, [userFields, googleVideos, grokRecs]);

  const heroGuide = CROP_TUTORIAL_DATA[0];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: isDarkMode ? '#141f16' : '#f4f2ec' }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Top Navigation Header (Matched to Home Screen Header Theme & Brand) */}
      <View style={[styles.topHeader, { backgroundColor: isDarkMode ? '#141f16' : '#f4f2ec', borderBottomColor: isDarkMode ? '#233325' : '#e6e3d8' }]}>
        {/* Left: Brand Icon + Brand Name */}
        <View style={styles.headerLeft}>
          <Image 
            source={require('../../../assets/icon.png')} 
            style={styles.headerLogo} 
            resizeMode="contain"
            fadeDuration={0}
          />
          <Text style={[styles.brandNameText, { color: isDarkMode ? '#e2ebd8' : '#1e3323' }]}>
            {language === 'ne' ? 'अवनि' : 'Anavi'}
          </Text>
        </View>

        {/* Center: Small Tutorial Pill Badge & AI Pipeline Inspector Button */}
        <TouchableOpacity
          style={[styles.tutorialCenterPill, { backgroundColor: 'rgba(16,185,129,0.18)', borderColor: '#10B981' }]}
          onPress={() => setShowInspectorModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="flask" size={13} color="#10B981" />
          <Text style={[styles.tutorialCenterText, { color: '#10B981', fontWeight: '800' }]}>
            🧪 TEST AI PIPELINE
          </Text>
        </TouchableOpacity>

        {/* Right: Notifications + Avatar */}
        <View style={styles.headerRight}>
          <TouchableOpacity style={[styles.notificationBtn, { backgroundColor: isDarkMode ? '#1f2e22' : '#ffffff', borderColor: isDarkMode ? '#2d4231' : '#e6e3d8' }]} activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.profileBtn, { borderColor: colors.brandGreen }]} activeOpacity={0.7}>
            <Image 
              source={require('../../../assets/images/avatar_peeking_cropped.png')} 
              style={styles.profilePic} 
              resizeMode="cover"
              fadeDuration={0}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={{ paddingBottom: 110 }} 
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={400}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 250) {
            handleLoadMore();
          }
        }}
      >
        
        {/* Search Input Bar */}
        <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
          <View style={[styles.searchContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={18} color={colors.secondaryText} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={language === 'ne' ? 'बाली, सिँचाइ वा विषादी खोज्नुहोस्...' : 'Search crop, irrigation or pesticide...'}
              placeholderTextColor={colors.secondaryText}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.secondaryText} />
              </TouchableOpacity>
            )}
          </View>
        </View>



        {/* Recommended Carousel Section (For All Registered Fields) */}
        {selectedCrop === 'all' && selectedTopic === 'all' && !searchQuery && recommendedItemsList.length > 0 && (
          <View style={{ marginVertical: 10 }}>
            {/* Section Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="sparkles" size={16} color={colors.brandGreen} />
                <Text style={[styles.sectionHeading, { color: colors.text }]}>
                  {language === 'ne' ? 'सिफारिस' : 'Recommended'}
                </Text>
              </View>

              <View style={[styles.miniAiPill, { backgroundColor: isDarkMode ? '#1e3323' : '#eaf6f0' }]}>
                <Ionicons name="hardware-chip-outline" size={11} color={colors.brandGreen} />
                <Text style={{ fontSize: 9.5, fontWeight: '800', color: colors.brandGreen }}>
                  AVANI AI
                </Text>
              </View>
            </View>

            {/* Horizontal Carousel */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={SW * 0.84 + 14}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
            >
              {isLoadingGoogle ? (
                <>
                  <SkeletonHeroCard isDarkMode={isDarkMode} />
                  <SkeletonHeroCard isDarkMode={isDarkMode} />
                  <SkeletonHeroCard isDarkMode={isDarkMode} />
                </>
              ) : (
                recommendedItemsList.map((item, idx) => (
                  <TouchableOpacity
                    key={item.id + '_' + idx}
                    activeOpacity={0.92}
                    onPress={() => {
                      setActiveGuideModal(item.guide);
                      setIsPlayingVideo(true);
                    }}
                    style={[styles.heroCardContainer, { width: SW * 0.84 }]}
                  >
                    <ImageBackground
                      source={item.guide?.image || { uri: item.guide?.thumbnailUrl || 'https://img.youtube.com/vi/rUrb1zxJP3o/hqdefault.jpg' }}
                      style={styles.heroImgBg}
                      imageStyle={{ borderRadius: 22 }}
                    >
                      <LinearGradient
                        colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
                        style={styles.heroGradient}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <View style={styles.durationPill}>
                            <Ionicons name="time" size={12} color="#fff" />
                            <Text style={styles.durationText}>{item.guide?.duration || '04:30 MIN'}</Text>
                          </View>
                        </View>

                        <View style={styles.centerPlayCircle}>
                          <Ionicons name="play" size={28} color="#fff" style={{ marginLeft: 3 }} />
                        </View>

                        <View>
                          <Text style={styles.heroTitle} numberOfLines={1}>
                            {language === 'ne' ? item.guide?.titleNe : item.guide?.titleEn}
                          </Text>

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                            <Text style={styles.heroAuthor} numberOfLines={1} ellipsizeMode="tail">
                              🏛️ {language === 'ne' ? item.guide?.authorNe : item.guide?.authorEn}
                            </Text>
                          </View>
                        </View>
                      </LinearGradient>
                    </ImageBackground>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        )}

      {/* Guides List */}
      <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            {language === 'ne' ? 'कृषि निर्देशिकाहरू' : 'Farming Guides'}
          </Text>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.secondaryText }}>
            {isLoadingGoogle ? '...' : filteredGuides.length} {language === 'ne' ? 'निर्देशिकाहरू' : 'GUIDES'}
          </Text>
        </View>

        {isLoadingGoogle ? (
          <View style={{ gap: 12 }}>
            <SkeletonCard isDarkMode={isDarkMode} colors={colors} />
            <SkeletonCard isDarkMode={isDarkMode} colors={colors} />
            <SkeletonCard isDarkMode={isDarkMode} colors={colors} />
            <SkeletonCard isDarkMode={isDarkMode} colors={colors} />
          </View>
        ) : filteredGuides.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={40} color={colors.secondaryText} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {language === 'ne' ? 'कुनै निर्देशिका भेटिएन' : 'No Manuals Found'}
            </Text>
            <Text style={{ fontSize: 12, color: colors.secondaryText, textAlign: 'center', marginTop: 4 }}>
              {language === 'ne' ? 'फरक बाली वा विषय छनोट गरी पुन: खोज्नुहोस्।' : 'Try selecting a different crop or topic filter.'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {filteredGuides.map((item, idx) => (
              <TouchableOpacity
                key={(item.id || 'g') + '_guide_' + idx}
                activeOpacity={0.88}
                onPress={() => {
                  setActiveGuideModal(item);
                  setIsPlayingVideo(true);
                }}
                style={[styles.guideCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <ImageBackground
                  source={item?.image || { uri: item?.thumbnailUrl || 'https://img.youtube.com/vi/rUrb1zxJP3o/hqdefault.jpg' }}
                  style={styles.cardThumbnail}
                  imageStyle={{ borderRadius: 14 }}
                >
                  <View style={styles.thumbnailOverlay}>
                    <View style={styles.miniPlayIcon}>
                      <Ionicons name="play" size={14} color="#fff" style={{ marginLeft: 2 }} />
                    </View>
                    <View style={styles.miniDurationBadge}>
                      <Text style={styles.miniDurationText}>{item.duration}</Text>
                    </View>
                  </View>
                </ImageBackground>

                <View style={{ flex: 1, justifyContent: 'space-between' }}>
                  <View>

                    <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                      {language === 'ne' ? item.titleNe : item.titleEn}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <Text style={{ fontSize: 10.5, color: colors.secondaryText, fontWeight: '600', flex: 1 }} numberOfLines={1} ellipsizeMode="tail">
                      🏛️ {language === 'ne' ? item.authorNe : item.authorEn}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            {nextPageToken ? (
              <TouchableOpacity
                onPress={handleLoadMore}
                disabled={isLoadingMore}
                style={{
                  marginTop: 16,
                  paddingVertical: 14,
                  backgroundColor: colors.card,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                {isLoadingMore ? (
                  <ActivityIndicator size="small" color={colors.brandGreen || '#4CAF50'} />
                ) : (
                  <>
                    <Ionicons name="add-circle-outline" size={18} color={colors.brandGreen || '#4CAF50'} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                      {language === 'ne' ? 'थप २५ भिडियो निर्देशिकाहरू लोड गर्नुहोस्' : 'Load Next 25 Video Guides'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </View>
      </ScrollView>

      {/* Interactive Crop Guidebook Modal */}
      {activeGuideModal && (
        <Modal
          visible={!!activeGuideModal}
          animationType="slide"
          transparent={false}
          statusBarTranslucent={true}
          onRequestClose={() => {
            setActiveGuideModal(null);
            setIsPlayingVideo(false);
          }}
        >
          <View style={[styles.modalScreen, { backgroundColor: colors.background }]}>
            {/* Modal Top Bar (Synchronous Safe Top Margin) */}
            <View style={{ backgroundColor: colors.card, paddingTop: safeTopMargin, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={styles.modalTopBar}>
              <TouchableOpacity 
                onPress={() => {
                  setActiveGuideModal(null);
                  setIsPlayingVideo(false);
                }} 
                style={styles.modalCloseBtn}
              >
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalHeaderTitle, { color: colors.text }]} numberOfLines={1}>
                {language === 'ne' ? activeGuideModal.titleNe : activeGuideModal.titleEn}
              </Text>
              <TouchableOpacity style={styles.modalShareBtn}>
                <Ionicons name="share-social-outline" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
              
              {/* Real Video Player Component (Direct HTTPS URI with YouTube Referer - Bypasses Error 153/152-4) */}
              <View style={styles.videoPlayerContainer}>
                {isPlayingVideo ? (
                  <View style={{ width: '100%', height: 220, backgroundColor: '#000' }}>
                    {Platform.OS === 'web' ? (
                      <iframe
                        width="100%"
                        height="220"
                        src={`https://www.youtube-nocookie.com/embed/${getVideoId(activeGuideModal.youtubeId, activeGuideModal.videoUrl)}?autoplay=1&playsinline=1&controls=1&rel=0`}
                        style={{ border: 'none' }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    ) : (
                      <WebView
                        originWhitelist={['*']}
                        source={{
                          html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"><meta name="referrer" content="strict-origin-when-cross-origin"><style>*{margin:0;padding:0;box-sizing:border-box;background:#000;}html,body{width:100%;height:100%;overflow:hidden;background:#000;}iframe{width:100%;height:100%;border:none;}</style></head><body><iframe id="ytplayer" src="https://www.youtube-nocookie.com/embed/${getVideoId(activeGuideModal.youtubeId, activeGuideModal.videoUrl)}?autoplay=1&mute=1&controls=1&playsinline=1&enablejsapi=1&rel=0&origin=https://localhost&widget_referrer=https://localhost" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe><script>var tag=document.createElement('script');tag.src="https://www.youtube.com/iframe_api";var firstScriptTag=document.getElementsByTagName('script')[0];firstScriptTag.parentNode.insertBefore(tag,firstScriptTag);var player;function onYouTubeIframeAPIReady(){player=new YT.Player('ytplayer',{events:{'onReady':function(e){e.target.playVideo();setTimeout(function(){e.target.unMute();},150);}}});}</script></body></html>`,
                          baseUrl: 'https://localhost',
                        }}
                        style={{ width: '100%', height: 220 }}
                        allowsInlineMediaPlayback={true}
                        mediaPlaybackRequiresUserAction={false}
                        allowsFullscreenVideo={true}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        mixedContentMode="always"
                      />
                    )}
                  </View>
                ) : (
                  <ImageBackground
                    source={activeGuideModal?.image || { uri: activeGuideModal?.thumbnailUrl || 'https://img.youtube.com/vi/rUrb1zxJP3o/hqdefault.jpg' }}
                    style={styles.videoPlayerFrame}
                  >
                    <LinearGradient
                      colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.75)']}
                      style={styles.videoIdleOverlay}
                    >
                      <TouchableOpacity 
                        activeOpacity={0.85}
                        onPress={() => setIsPlayingVideo(true)}
                        style={styles.bigPlayButton}
                      >
                        <Ionicons name="play" size={34} color="#fff" style={{ marginLeft: 4 }} />
                      </TouchableOpacity>

                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 10 }}>
                        {language === 'ne' ? 'भिडियो हेर्न ट्याप गर्नुहोस्' : 'Tap to Watch HD Practical Video'}
                      </Text>
                    </LinearGradient>
                  </ImageBackground>
                )}
              </View>

              {/* Title & Author Info */}
              <View style={{ paddingHorizontal: 18, marginTop: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <View style={[styles.miniCategoryBadge, { backgroundColor: isDarkMode ? '#1e3323' : '#eaf6f0' }]}>
                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.brandGreen }}>
                      {language === 'ne' ? activeGuideModal.topicLabelNe : activeGuideModal.topicLabelEn}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11.5, color: colors.secondaryText, fontWeight: '700' }}>
                    {language === 'ne' ? activeGuideModal.cropNameNe : activeGuideModal.cropNameEn}
                  </Text>
                </View>

                <Text style={[styles.modalTitleText, { color: colors.text }]}>
                  {language === 'ne' ? activeGuideModal.titleNe : activeGuideModal.titleEn}
                </Text>

                {/* Timing Badge Banner */}
                <View style={[styles.timingBanner, { backgroundColor: isDarkMode ? '#223827' : '#e8f5ed', borderColor: colors.brandGreen }]}>
                  <Ionicons name="calendar-outline" size={18} color={colors.brandGreen} />
                  <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '800', color: colors.brandGreen }}>
                    {language === 'ne' ? activeGuideModal.timingBadgeNe : activeGuideModal.timingBadgeEn}
                  </Text>
                </View>

                {/* Author Info */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandGreen, justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="school" size={20} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.text }}>
                      {language === 'ne' ? activeGuideModal.authorNe : activeGuideModal.authorEn}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.secondaryText }}>
                      {language === 'ne' ? 'प्रमाणित राष्ट्रिय कृषि विज्ञ' : 'Certified National Agronomist'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Clean Video Overview & Description */}
              <View style={{ paddingHorizontal: 18, marginTop: 16 }}>
                <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Ionicons name="document-text-outline" size={18} color={colors.brandGreen} />
                    <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>
                      {language === 'ne' ? 'भिडियो विवरण र मुख्य जानकारी' : 'Video Overview & Details'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, lineHeight: 20, color: colors.text }}>
                    {language === 'ne' 
                      ? (activeGuideModal.subtitleNe || activeGuideModal.dosageSummaryNe || 'यो भिडियोमा दिइएका कृषि विधि र प्राविधिक सल्लाह ध्यानपूर्वक हेर्नुहोस्।')
                      : (activeGuideModal.subtitleEn || activeGuideModal.dosageSummaryEn || 'Watch the video above for practical step-by-step agricultural instructions.')}
                  </Text>
                </View>

                {/* Practical Steps Checklist (If Available) */}
                {((activeGuideModal.stepsNe && activeGuideModal.stepsNe.length > 0) || (activeGuideModal.stepsEn && activeGuideModal.stepsEn.length > 0)) && (
                  <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, marginTop: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                      <Ionicons name="list-circle-outline" size={20} color={colors.brandGreen} />
                      <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>
                        {language === 'ne' ? 'मुख्य अभ्यास चरणहरू' : 'Key Practical Steps'}
                      </Text>
                    </View>
                    {(language === 'ne' ? activeGuideModal.stepsNe || activeGuideModal.stepsEn : activeGuideModal.stepsEn || activeGuideModal.stepsNe)?.map((step, idx) => (
                      <View key={'step_' + idx} style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brandGreen + '20', justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.brandGreen }}>{idx + 1}</Text>
                        </View>
                        <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.text }}>{step}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>



            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Live AI Pipeline Inspector & Testing Lab Modal */}
      <LiveAIPipelineInspectorModal
        visible={showInspectorModal}
        onClose={() => setShowInspectorModal(false)}
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
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  brandNameText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  tutorialCenterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  tutorialCenterText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationBtn: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  notificationBadge: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e05c5c',
  },
  profileBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  profilePic: {
    width: '100%',
    height: '100%',
    borderRadius: 19,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  unifiedFilterChip: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  unifiedFilterText: {
    fontSize: 12.5,
  },
  sparkleIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiMatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4caf50',
  },
  aiMatchText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroRecommendCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  heroRecommendGradient: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  recommendContextRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  recommendContextText: {
    fontSize: 11.5,
    fontWeight: '700',
    flex: 1,
  },
  heroThumbnailFrame: {
    width: '100%',
    height: 155,
    borderRadius: 16,
    overflow: 'hidden',
  },
  heroThumbnailOverlay: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroDurationBadge: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  heroDurationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  glowingPlayCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(107,143,94,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6B8F5E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  heroCategoryChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  heroCategoryChipText: {
    color: '#81c784',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  heroGuideTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  heroGuideSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    fontWeight: '500',
  },
  watchCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  miniAiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
  },
  heroCardContainer: {
    height: 220,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  heroImgBg: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  glassTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  glassTagText: {
    color: '#fff',
    fontSize: 10.5,
    fontWeight: '800',
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(76,175,80,0.85)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  durationText: {
    color: '#fff',
    fontSize: 10.5,
    fontWeight: '800',
  },
  centerPlayCircle: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(76,175,80,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  heroSummary: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    marginTop: 3,
    lineHeight: 15,
  },
  heroFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  heroAuthor: {
    color: '#81c784',
    fontSize: 11,
    fontWeight: '700',
  },
  guideCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  cardThumbnail: {
    width: 105,
    height: 105,
    borderRadius: 14,
    overflow: 'hidden',
  },
  thumbnailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'space-between',
    padding: 6,
  },
  miniPlayIcon: {
    alignSelf: 'flex-start',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniDurationBadge: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  miniDurationText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  miniCategoryBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
  },
  cardSummary: {
    fontSize: 11,
    marginTop: 3,
    lineHeight: 15,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 10,
  },
  modalScreen: {
    flex: 1,
  },
  modalTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 54,
    borderBottomWidth: 1,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalHeaderTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginHorizontal: 10,
  },
  modalShareBtn: {
    padding: 6,
  },
  videoPlayerContainer: {
    height: 230,
    width: '100%',
  },
  videoPlayerFrame: {
    width: '100%',
    height: '100%',
  },
  videoIdleOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigPlayButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  videoPlayingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  playerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 20,
    paddingHorizontal: 10,
  },
  controlIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  timingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  subHeadingTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  dosageTableCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  tableCellLabel: {
    fontSize: 12,
    fontWeight: '600',
    width: '38%',
  },
  tableCellValue: {
    fontSize: 12.5,
    fontWeight: '700',
    width: '60%',
    textAlign: 'right',
  },
  stepItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  stepTextContent: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  takeawaysCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  aiShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 16,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
});
