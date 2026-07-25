import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../../lib/LanguageContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface SuccessScreenProps {
  onComplete: () => void;
}

const localTranslations = {
  en: {
    title: "Setup Complete!",
    subtitle: "Woohoo! You're all set up. Let's start farming smarter together!",
    button: "GET STARTED",
  },
  ne: {
    title: "सेटअप पूरा भयो!",
    subtitle: "सफलतापूर्वक सेटअप भयो! आउनुहोस् सँगै स्मार्ट तरिकाले खेती सुरु गरौं।",
    button: "सुरु गर्नुहोस्",
  }
};

export default function SuccessScreen({ onComplete }: SuccessScreenProps) {
  const { language } = useLanguage();
  const tLocal = localTranslations[language] || localTranslations.en;

  // Floating animation for the mascot
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatAnim]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        
        {/* Top Section: Duolingo-style Speech Bubble */}
        <View style={styles.bubbleContainer}>
          <View style={styles.speechBubble}>
            <Text style={styles.speechText}>
              {tLocal.subtitle}
            </Text>
          </View>
          <View style={styles.bubbleArrowContainer}>
            <View style={styles.bubbleArrow} />
            <View style={styles.bubbleArrowBorder} />
          </View>
        </View>

        {/* Center Section: Animated Floating Mascot */}
        <View style={styles.mascotContainer}>
          <Animated.Image
            source={require('../../../assets/images/avatar_success.png')}
            style={[
              styles.mascotImage,
              { transform: [{ translateY: floatAnim }] }
            ]}
            resizeMode="contain"
          />
        </View>

        {/* Messaging Section */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{tLocal.title}</Text>
        </View>

        {/* Bottom CTA Section: Duolingo-style 3D Green Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.primary3DButton} 
            onPress={onComplete} 
            activeOpacity={0.9}
          >
            <View style={styles.primary3DButtonInner}>
              <Text style={styles.primaryButtonText}>{tLocal.button}</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>
        
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8F5', // Original light cream brand color
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  bubbleContainer: {
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
    zIndex: 10,
  },
  speechBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    // Soft drop shadow matching onboarding
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  speechText: {
    color: '#1C1917',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '700',
    fontFamily: 'System',
  },
  bubbleArrowContainer: {
    width: '100%',
    height: 12,
    marginTop: -2,
    alignItems: 'center',
  },
  bubbleArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
    zIndex: 2,
  },
  bubbleArrowBorder: {
    position: 'absolute',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#E5E7EB',
    zIndex: 1,
    top: 1,
  },
  mascotContainer: {
    flex: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
    width: '100%',
  },
  mascotImage: {
    width: width * 0.52,
    height: width * 0.52 * (768 / 432),
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1917',
    textAlign: 'center',
    fontFamily: 'System',
  },
  buttonContainer: {
    width: '100%',
  },
  primary3DButton: {
    backgroundColor: '#4A6341', // Bottom 3D shadow color
    borderRadius: 16,
    height: 54,
    width: '100%',
  },
  primary3DButtonInner: {
    backgroundColor: '#6B8F5E', // Sage green top key
    borderRadius: 16,
    height: 50,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
