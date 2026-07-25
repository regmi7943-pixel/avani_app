import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../lib/ThemeContext';
import { useLanguage } from '../../lib/LanguageContext';

const { width: SW } = Dimensions.get('window');

const TOPIC_IMAGES: Record<string, any> = {
  'high-yield': require('../../../assets/images/masterclass_high_yield.jpg'),
  'crop-selection': require('../../../assets/images/masterclass_crop_rotation.jpg'),
  'crop-storage': require('../../../assets/images/masterclass_grain_storage.jpg'),
  'smart-irrigation': require('../../../assets/images/masterclass_smart_irrigation.jpg'),
};

export interface MasterclassTopic {
  id: string;
  icon: string;
  category: string;
  categoryNe: string;
  title: string;
  titleNe: string;
  badge: string;
  badgeNe: string;
  summary: string;
  summaryNe: string;
  problemInsight: string;
  problemInsightNe: string;
  farmerVerdict: string;
  farmerVerdictNe: string;
  steps: string[];
  stepsNe: string[];
}

export default function MasterclassDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, isDarkMode } = useTheme();
  const { language } = useLanguage();
  const isNe = language === 'ne';

  const topic: MasterclassTopic = route.params?.topic;

  if (!topic) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Text style={{ color: colors.text }}>Topic not found.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 12 }}>
            <Text style={{ color: colors.brandGreen }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const imageSource = TOPIC_IMAGES[topic.id] || TOPIC_IMAGES['high-yield'];

  const handleShare = async () => {
    try {
      await Share.share({
        title: isNe ? topic.titleNe : topic.title,
        message: `${isNe ? topic.titleNe : topic.title}\n\n${isNe ? topic.summaryNe : topic.summary}\n\nShared via Avani App.`,
      });
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Header Bar */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity 
          style={[styles.headerBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]} 
          onPress={() => navigation.goBack()} 
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {isNe ? topic.categoryNe : topic.category}
        </Text>

        <TouchableOpacity 
          style={[styles.headerBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]} 
          onPress={handleShare} 
          activeOpacity={0.7}
        >
          <Ionicons name="share-outline" size={20} color={colors.brandGreen} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Image Container */}
        <View style={styles.heroImageWrapper}>
          <Image source={imageSource} style={styles.heroImage} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', isDarkMode ? '#1C1C1A' : '#ffffff']}
            style={styles.heroGradient}
          />
          <View style={styles.heroBadgeOverlay}>
            <Text style={styles.heroBadgeText}>
              {isNe ? topic.badgeNe : topic.badge}
            </Text>
          </View>
        </View>

        {/* Title & Metadata */}
        <View style={styles.contentPadding}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Ionicons name={topic.icon as any} size={16} color={colors.brandGreen} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.brandGreen, textTransform: 'uppercase' }}>
              {isNe ? topic.categoryNe : topic.category}
            </Text>
          </View>

          <Text style={[styles.mainTitle, { color: colors.text }]}>
            {isNe ? topic.titleNe : topic.title}
          </Text>

          <Text style={[styles.summaryText, { color: colors.secondaryText }]}>
            {isNe ? topic.summaryNe : topic.summary}
          </Text>

          {/* Scientific Insight Card */}
          <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Text style={{ fontSize: 16 }}>💡</Text>
              </View>
              <Text style={[styles.cardHeading, { color: colors.text }]}>
                {isNe ? 'वैज्ञानिक तथ्य र महत्त्व' : 'Scientific Insight & Value'}
              </Text>
            </View>
            <Text style={[styles.cardBody, { color: colors.secondaryText }]}>
              {isNe ? topic.problemInsightNe : topic.problemInsight}
            </Text>
          </View>

          {/* Local Farmer Verdict Card */}
          <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                <Text style={{ fontSize: 16 }}>👨‍🌾</Text>
              </View>
              <Text style={[styles.cardHeading, { color: colors.text }]}>
                {isNe ? 'स्थानीय कृषकहरूको अनुभव' : 'Local Farmer Experience'}
              </Text>
            </View>
            <Text style={[styles.cardBody, { color: colors.secondaryText, fontStyle: 'italic' }]}>
              "{isNe ? topic.farmerVerdictNe : topic.farmerVerdict}"
            </Text>
          </View>

          {/* Step-by-Step Practical Guide */}
          <View style={{ marginTop: 18 }}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>
              📋 {isNe ? 'व्यावहारिक प्रयोगका चरणहरू' : 'Step-by-Step Implementation'}
            </Text>

            {(isNe ? topic.stepsNe : topic.steps).map((step, idx) => (
              <View key={idx} style={[styles.stepItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.stepBadge, { backgroundColor: colors.brandGreen }]}>
                  <Text style={styles.stepBadgeNum}>{idx + 1}</Text>
                </View>
                <Text style={[styles.stepText, { color: colors.text }]}>{step}</Text>
              </View>
            ))}
          </View>

          {/* Ask AI Shortcut Banner */}
          <TouchableOpacity
            style={[styles.askAiBanner, { backgroundColor: colors.brandGreen }]}
            activeOpacity={0.85}
            onPress={() => {
              (navigation as any).navigate('Main', {
                screen: 'AI Assistant',
                params: {
                  initialQuery: `Can you explain more about ${topic.title} for my field?`
                }
              });
            }}
          >
            <Ionicons name="sparkles" size={20} color="#ffffff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.askAiTitle}>
                {isNe ? 'यस विषयमा AI सँग कुराकानी गर्नुहोस्' : 'Ask Avani AI About This Topic'}
              </Text>
              <Text style={styles.askAiSubtitle}>
                {isNe ? 'तपाईंको खेत अनुसारको सल्लाह लिनुहोस्' : 'Get customized advice tailored to your field'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ffffff" />
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  heroImageWrapper: {
    width: SW,
    height: 220,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
  },
  heroBadgeOverlay: {
    position: 'absolute',
    top: 14,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroBadgeText: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '800',
  },
  contentPadding: {
    paddingHorizontal: 16,
    marginTop: 10,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 26,
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  insightCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeading: {
    fontSize: 14,
    fontWeight: '800',
  },
  cardBody: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  stepBadgeNum: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  stepText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  askAiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    marginTop: 16,
  },
  askAiTitle: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
  },
  askAiSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    marginTop: 1,
  },
});
