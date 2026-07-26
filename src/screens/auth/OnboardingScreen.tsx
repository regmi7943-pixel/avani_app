import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image, Animated, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAudioPlayer } from 'expo-audio';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '../../lib/LanguageContext';

const { width, height } = Dimensions.get('window');

type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  SignUp: undefined;
};

type OnboardingStep = 'welcome' | 'language' | 'goal';

const translations = {
  en: {
    chooseLangTitle: "Choose your language!",
    chooseLangSub: "Select a language to get started with Avani",
    goalTitle: "What is your farming goal?",
    goalSub: "Help us customize your Avani experience",
    continue: "CONTINUE",
    goBack: "GO BACK",
    goals: {
      yield: {
        title: "Increase Crop Yield",
        sub: "Get advice on fertilizing and seed selection",
      },
      disease: {
        title: "Diagnose Plant Diseases",
        sub: "Scan sick leaves to get treatment options",
      },
      soil: {
        title: "Monitor Soil Health",
        sub: "Test and track nutrients, pH & moisture",
      },
      weather: {
        title: "Track Weather Alerts",
        sub: "Get localized alerts and farming calendar",
      },
      chat: {
        title: "Chat with Agronomist",
        sub: "Ask questions and get expert advice",
      },
    },
  },
  ne: {
    chooseLangTitle: "तपाईंको भाषा चयन गर्नुहोस्!",
    chooseLangSub: "अगाडि बढ्नको लागि भाषा रोज्नुहोस्",
    goalTitle: "तपाईंको मुख्य कृषि उद्देश्य के हो?",
    goalSub: "कृषि अनुभव व्यक्तिगत बनाउन मद्दत गर्नुहोस्",
    continue: "अगाडि बढ्नुहोस्",
    goBack: "पछाडि जानुहोस्",
    goals: {
      yield: {
        title: "बाली उत्पादन बढाउनु",
        sub: "मल र बीउ चयन सम्बन्धी सल्लाह लिनुहोस्",
      },
      disease: {
        title: "पातको रोग पहिचान गर्नु",
        sub: "बिरामी पातहरू स्क्यान गरी उपचार पत्ता लगाउनुहोस्",
      },
      soil: {
        title: "माटोको स्वास्थ्य निगरानी",
        sub: "पोषक तत्व, pH र चिस्यानको परीक्षण गर्नुहोस्",
      },
      weather: {
        title: "मौसम चेतावनी ट्र्याक गर्नु",
        sub: "स्थान-विशिष्ट चेतावनी र कृषि पात्रो प्राप्त गर्नुहोस्",
      },
      chat: {
        title: "कृषि विज्ञसँग परामर्श गर्नु",
        sub: "सोधपुछ गर्नुहोस् र विशेषज्ञ सल्लाह लिनुहोस्",
      },
    },
  },
};

export default function OnboardingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { setLanguage } = useLanguage();
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [selectedLang, setSelectedLang] = useState<'en' | 'ne'>('en');
  const [selectedGoal, setSelectedGoal] = useState<string>('soil');
  const [displayedText, setDisplayedText] = useState('');
  const [displayedGoalTitle, setDisplayedGoalTitle] = useState('');
  const floatAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current; // 0 = welcome, 1 = language, 2 = goal
  const goalScrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Card carousel constants
  const CARD_WIDTH = width * 0.56;
  const CARD_MARGIN = 20;
  const SNAP_INTERVAL = CARD_WIDTH + CARD_MARGIN * 2;
  const CARD_PEEK_PADDING = (width - CARD_WIDTH) / 2 - CARD_MARGIN;

  // Goal card data
  const GOAL_CARDS = [
    { id: 'yield', icon: 'trending-up-outline', bg: '#FEFBF0', accent: '#B45309', border: '#FCE7C4' },
    { id: 'disease', icon: 'bug-outline', bg: '#F1FDF3', accent: '#15803D', border: '#D1FAE5' },
    { id: 'soil', icon: 'leaf-outline', bg: '#FDF2F8', accent: '#BE185D', border: '#FCE7F3' },
    { id: 'weather', icon: 'thunderstorm-outline', bg: '#F0F5FF', accent: '#1D4ED8', border: '#DBEAFE' },
    { id: 'chat', icon: 'chatbubbles-outline', bg: '#FFF7ED', accent: '#C2410C', border: '#FFEDD5' },
  ] as const;
  
  const welcomeText = "Namaste! I am Aava, your digital agronomist. Let's grow together.";
  
  // Carousel Page Wipe Interpolations (mapped to 3-step timeline)
  const welcomeOpacity = slideAnim.interpolate({
    inputRange: [0, 0.8, 1, 2],
    outputRange: [1, 0.2, 0, 0],
  });
  const welcomeTranslateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, -width, -width * 2],
  });

  const langOpacity = slideAnim.interpolate({
    inputRange: [0, 0.2, 1, 1.8, 2],
    outputRange: [0, 0.2, 1, 0.2, 0],
  });
  const langTranslateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [width, 0, -width],
  });

  const goalOpacity = slideAnim.interpolate({
    inputRange: [0, 1, 1.2, 2],
    outputRange: [0, 0, 0.2, 1],
  });
  const goalTranslateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [width * 2, width, 0],
  });

  const transitionToLanguage = () => {
    setStep('language'); // Set step immediately to avoid end-of-animation layout flicker
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 380,
      useNativeDriver: true,
    }).start();
  };

  const transitionToWelcome = () => {
    setStep('welcome'); // Set step immediately to avoid end-of-animation layout flicker
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 380,
      useNativeDriver: true,
    }).start();
  };

  const transitionToGoal = () => {
    setStep('goal'); // Set step immediately to avoid end-of-animation layout flicker
    Animated.timing(slideAnim, {
      toValue: 2,
      duration: 380,
      useNativeDriver: true,
    }).start();
  };

  // Use expo-audio player hook for high-performance low-latency playback
  const playerSource = require('../../../assets/sounds/typewriter_click.wav');
  const p1 = useAudioPlayer(playerSource);
  const p2 = useAudioPlayer(playerSource);
  const p3 = useAudioPlayer(playerSource);
  const p4 = useAudioPlayer(playerSource);
  const p5 = useAudioPlayer(playerSource);

  const players = [p1, p2, p3, p4, p5];
  const activePlayerIndex = useRef(0);

  const playClick = () => {
    try {
      const currentPlayer = players[activePlayerIndex.current];
      if (currentPlayer) {
        currentPlayer.seekTo(0);
        currentPlayer.play();
      }
      // Cycle to the next channel in the voice pool
      activePlayerIndex.current = (activePlayerIndex.current + 1) % players.length;
    } catch (e) {
      console.warn('Typewriter click playback failed:', e);
    }
  };

  // Typewriter effect triggered when welcome screen mounts
  useEffect(() => {
    if (step !== 'welcome') {
      setDisplayedText('');
      return;
    }

    setDisplayedText('');
    let currentText = '';
    let index = 0;

    // Start typewriter interval
    const timer = setInterval(() => {
      if (index < welcomeText.length) {
        const char = welcomeText.charAt(index);
        currentText += char;
        setDisplayedText(currentText);
        
        // Play click sound (skip space characters for a realistic typing rhythm!)
        if (char !== ' ') {
          playClick();
        }
        
        index++;
      } else {
        clearInterval(timer);
      }
    }, 45); // 45ms typing speed aligns perfectly with the click audio playback duration

    return () => clearInterval(timer);
  }, [step]);

  // Typewriter effect triggered when Goal selection screen mounts
  useEffect(() => {
    if (step !== 'goal') {
      setDisplayedGoalTitle('');
      return;
    }

    setDisplayedGoalTitle('');
    const targetText = translations[selectedLang].goalTitle;
    let currentText = '';
    let index = 0;

    const timer = setInterval(() => {
      if (index < targetText.length) {
        const char = targetText.charAt(index);
        currentText += char;
        setDisplayedGoalTitle(currentText);
        
        // Play click sound (skip spaces for realistic rhythm)
        if (char !== ' ') {
          playClick();
        }
        
        index++;
      } else {
        clearInterval(timer);
      }
    }, 45);

    return () => clearInterval(timer);
  }, [step, selectedLang]);

  // Gentle float animation for Aava
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
        })
      ])
    ).start();
  }, []);

  const selectLanguageAndSave = async () => {
    try {
      await setLanguage(selectedLang);
      await AsyncStorage.setItem('userLanguage', selectedLang);
      transitionToGoal();
    } catch (e) {
      console.error(e);
    }
  };

  const saveGoalAndComplete = async () => {
    try {
      await AsyncStorage.setItem('userGoal', selectedGoal);
      await AsyncStorage.setItem('hasViewedOnboarding', 'true');
      navigation.replace('SignUp');
    } catch (e) {
      console.error(e);
    }
  };

  const completeLoginRedirect = async () => {
    try {
      await AsyncStorage.setItem('hasViewedOnboarding', 'true');
      navigation.replace('Login');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        
        {/* ================= STEP 1: WELCOME SCREEN ================= */}
        <Animated.View 
          style={[
            styles.stepContainer,
            {
              opacity: welcomeOpacity,
              transform: [{ translateX: welcomeTranslateX }],
              zIndex: step === 'welcome' ? 2 : 1,
            }
          ]}
          pointerEvents={step === 'welcome' ? 'auto' : 'none'}
        >
          {/* Top Section: Speech Bubble */}
          <View style={styles.bubbleContainer}>
            <View style={styles.speechBubble}>
              <Text style={styles.speechText}>
                {displayedText}
              </Text>
            </View>
            <View style={styles.bubbleArrowContainer}>
              <View style={styles.bubbleArrow} />
              <View style={styles.bubbleArrowBorder} />
            </View>
          </View>

          {/* Center Section: Large Mascot (Left Aligned) */}
          <Animated.View style={[styles.mascotWrapper, { transform: [{ translateY: floatAnim }] }]}>
            <Image
              source={require('../../../assets/images/avatar_waving.gif')}
              style={styles.mascotImageWelcome}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Content Section: Intro */}
          <View style={styles.brandIntroSection}>
            <Text style={styles.titleText}>Welcome to Avani</Text>
            <Text style={styles.subtitleText}>
              Precision farming insights in the palm of your hand.
            </Text>
          </View>

          {/* Bottom Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.primary3DButton}
              onPress={transitionToLanguage}
              activeOpacity={0.9}
            >
              <View style={styles.primary3DButtonInner}>
                <Text style={styles.primaryButtonText}>GET STARTED</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondary3DButton}
              onPress={completeLoginRedirect}
              activeOpacity={0.9}
            >
              <View style={styles.secondary3DButtonInner}>
                <Text style={styles.secondaryButtonText}>LOG IN</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ================= STEP 2: LANGUAGE SELECTION ================= */}
        <Animated.View 
          style={[
            styles.langStepContainer,
            {
              opacity: langOpacity,
              transform: [{ translateX: langTranslateX }],
              zIndex: step === 'language' ? 2 : 1,
            }
          ]}
          pointerEvents={step === 'language' ? 'auto' : 'none'}
        >
          
          {/* Center Section: Animated Signs Mascot */}
          <Animated.View style={[
            styles.signsContainer,
            { transform: [{ translateY: floatAnim }] }
          ]}>
            <Image
              source={require('../../../assets/images/avatar_signs_still.png')}
              style={styles.signsImage}
              resizeMode="cover"
            />
            
            {/* Left Signboard (नेपाली) */}
            <TouchableOpacity
              style={[styles.signOverlay, styles.leftSign]}
              onPress={() => setSelectedLang('ne')}
              activeOpacity={0.8}
            >
              <View style={selectedLang === 'ne' ? styles.markerCircle : styles.markerCircleEmpty}>
                <Text style={[
                  styles.signText,
                  selectedLang === 'ne' ? styles.signTextSelected : styles.signTextUnselected
                ]}>नेपाली</Text>
              </View>
            </TouchableOpacity>

            {/* Right Signboard (English) */}
            <TouchableOpacity
              style={[styles.signOverlay, styles.rightSign]}
              onPress={() => setSelectedLang('en')}
              activeOpacity={0.8}
            >
              <View style={selectedLang === 'en' ? styles.markerCircle : styles.markerCircleEmpty}>
                <Text style={[
                  styles.signText,
                  selectedLang === 'en' ? styles.signTextSelected : styles.signTextUnselected
                ]}>English</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Top Section: Speech Bubble Header (Dynamic Translation) */}
          <View style={styles.langBubbleContainer}>
            <View style={styles.langSpeechBubble}>
              <Text style={styles.langSpeechTextPrimary}>
                {translations[selectedLang].chooseLangTitle}
              </Text>
              <Text style={styles.langSpeechTextSecondary}>
                {translations[selectedLang].chooseLangSub}
              </Text>
            </View>
            <View style={styles.langBubbleArrowContainer}>
              <View style={styles.langBubbleArrow} />
              <View style={styles.langBubbleArrowBorder} />
            </View>
          </View>

          {/* Footer Overlay (Positioned Absolute Bottom) */}
          <View style={styles.langFooter}>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={selectLanguageAndSave}
              activeOpacity={0.9}
            >
              <View style={styles.continueButtonInner}>
                <Text style={styles.continueButtonText}>
                  {translations[selectedLang].continue}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backLinkButton}
              onPress={transitionToWelcome}
              activeOpacity={0.7}
            >
              <Text style={styles.backLinkText}>
                {translations[selectedLang].goBack}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ================= STEP 3: PRIMARY GOAL SELECTION ================= */}
        <Animated.View 
          style={[
            styles.goalStepContainer,
            {
              opacity: goalOpacity,
              transform: [{ translateX: goalTranslateX }],
              zIndex: step === 'goal' ? 2 : 1,
            }
          ]}
          pointerEvents={step === 'goal' ? 'auto' : 'none'}
        >
          {/* Top Header Row: Mascot Left + Speech Bubble Right */}
          <View style={styles.goalTopHeaderRow}>
            <Image
              source={require('../../../assets/images/avatar_peeking.png')}
              style={styles.goalPeekingMascot}
              resizeMode="contain"
            />
            <View style={styles.goalSpeechBubbleRight}>
              <Text style={styles.goalSpeechTitle}>
                {displayedGoalTitle}
              </Text>
              <Text style={styles.goalSpeechSub}>
                {translations[selectedLang].goalSub}
              </Text>
              <View style={styles.goalBubbleArrowLeft}>
                <View style={styles.goalArrowFill} />
                <View style={styles.goalArrowBorder} />
              </View>
            </View>
          </View>

          {/* Center Section: Dynamic Arc Card Carousel */}
          <View style={styles.carouselSection}>
            <Animated.ScrollView
              ref={goalScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={SNAP_INTERVAL}
              snapToAlignment="start"
              disableIntervalMomentum={true}
              decelerationRate="fast"
              style={styles.carouselScrollView}
              contentContainerStyle={{ 
                paddingHorizontal: CARD_PEEK_PADDING,
                alignItems: 'center',
                paddingBottom: 40, // Space for fanned translateY card offsets
              }}
              scrollEventThrottle={16}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                { 
                  useNativeDriver: true,
                  listener: (event: any) => {
                    const offsetX = event.nativeEvent.contentOffset.x;
                    const index = Math.round(offsetX / SNAP_INTERVAL);
                    const clampedIndex = Math.max(0, Math.min(GOAL_CARDS.length - 1, index));
                    const targetGoal = GOAL_CARDS[clampedIndex].id;
                    if (selectedGoal !== targetGoal) {
                      setSelectedGoal(targetGoal);
                    }
                  }
                }
              )}
              onLayout={() => {
                setTimeout(() => {
                  goalScrollRef.current?.scrollTo({ x: SNAP_INTERVAL * 2, animated: false });
                }, 50);
              }}
            >
              {GOAL_CARDS.map((item, index) => {
                const isSelected = selectedGoal === item.id;
                const goalText = translations[selectedLang].goals[item.id as 'yield' | 'disease' | 'soil' | 'weather' | 'chat'];

                // Dynamic arc interpolations based on scroll position
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
                  outputRange: ['26deg', '13deg', '0deg', '-13deg', '-26deg'],
                  extrapolate: 'clamp',
                });

                const translateY = scrollX.interpolate({
                  inputRange,
                  outputRange: [height * 0.12, height * 0.065, height * 0.03, height * 0.065, height * 0.12],
                  extrapolate: 'clamp',
                });

                const scale = scrollX.interpolate({
                  inputRange,
                  outputRange: [0.82, 0.92, 1, 0.92, 0.82],
                  extrapolate: 'clamp',
                });

                const opacity = scrollX.interpolate({
                  inputRange,
                  outputRange: [0.45, 0.75, 1, 0.75, 0.45],
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
                          backgroundColor: item.bg,
                          borderColor: isSelected ? '#6B8F5E' : item.border,
                          borderWidth: isSelected ? 3 : 2,
                          borderBottomWidth: isSelected ? 7 : 5,
                        }
                      ]}
                      onPress={() => setSelectedGoal(item.id)}
                      activeOpacity={0.92}
                    >
                      {/* Card Top Badge */}
                      <View style={styles.focusCardTop}>
                        <View style={[styles.focusCardIconCircle, { backgroundColor: item.accent + '15' }]}>
                          <Ionicons name={item.icon as any} size={32} color={item.accent} />
                        </View>
                        <Text style={[styles.focusCardIndex, { color: item.accent }]}>
                          {selectedLang === 'ne' ? `लक्ष्य ०${index + 1}` : `GOAL 0${index + 1}`}
                        </Text>
                      </View>

                      {/* Card Body */}
                      <View style={styles.focusCardBody}>
                        <Text style={styles.focusCardTitle} numberOfLines={2}>
                          {goalText.title}
                        </Text>
                        <Text style={styles.focusCardSubtitle} numberOfLines={3}>
                          {goalText.sub}
                        </Text>
                      </View>

                      {/* Selected check indicator */}
                      {isSelected && (
                        <View style={styles.selectedBadge}>
                          <Ionicons name="checkmark-circle" size={24} color="#6B8F5E" />
                        </View>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </Animated.ScrollView>
          </View>

          {/* Footer Buttons */}
          <View style={styles.goalFooterButtons}>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={saveGoalAndComplete}
              activeOpacity={0.9}
            >
              <View style={styles.continueButtonInner}>
                <Text style={styles.continueButtonText}>
                  {translations[selectedLang].continue}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backLinkButton}
              onPress={transitionToLanguage}
              activeOpacity={0.7}
            >
              <Text style={styles.backLinkText}>
                {translations[selectedLang].goBack}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8F5', // Soft organic cream background from Stitch
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 24,
  },
  
  /* ================= WELCOME STYLES ================= */
  bubbleContainer: {
    alignItems: 'flex-end',
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
    paddingVertical: 14,
    width: '85%',
    height: 92, // Fixed height to prevent layout shifts on wrapping text
    justifyContent: 'center', // Keeps text vertically centered
  },
  speechText: {
    color: '#1C1917',
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '700',
    fontFamily: 'System',
  },
  bubbleArrowContainer: {
    width: '85%',
    height: 12,
    marginTop: -2,
    position: 'relative',
  },
  bubbleArrow: {
    position: 'absolute',
    left: 48,
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
    left: 46,
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
  mascotWrapper: {
    flex: 1.3,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginVertical: 8,
    position: 'relative',
  },
  mascotImageWelcome: {
    position: 'absolute',
    left: -width * 0.32 - 3,
    width: width * 1.32,
    height: width * 1.32,
  },
  brandIntroSection: {
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  titleText: {
    fontFamily: 'System',
    fontSize: 34,
    fontWeight: '800',
    color: '#1C1917',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitleText: {
    fontFamily: 'System',
    fontSize: 14,
    color: '#657266',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },

  /* ================= LANGUAGE STEP STYLES ================= */
  langStepContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F5F8F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  langEntranceWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signsContainer: {
    width: width,
    height: width * (16 / 9),
    position: 'relative',
  },
  signsImage: {
    width: '100%',
    height: '100%',
  },
  langBubbleContainer: {
    position: 'absolute',
    top: 40,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  langSpeechBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    // Soft drop shadow to fit cartoon layout
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  langSpeechTextPrimary: {
    color: '#1C1917',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  langSpeechTextSecondary: {
    color: '#657266',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 3,
  },
  langBubbleArrowContainer: {
    width: '100%',
    height: 12,
    marginTop: -2,
    alignItems: 'center', // Centers the bubble arrow horizontally above Aava's hat
  },
  langBubbleArrow: {
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
  langBubbleArrowBorder: {
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
  langFooter: {
    position: 'absolute',
    bottom: 24,
    width: '100%',
    paddingHorizontal: 24,
    zIndex: 100, // Ensure buttons sit on top and receive touch events
  },
  signOverlay: {
    position: 'absolute',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leftSign: {
    left: '0.83%',
    top: '50.5%',
    width: '28.5%',
    height: '10.6%',
    transform: [{ rotate: '-1.8deg' }], // Matches the hand-drawn tilt of the left signboard
  },
  rightSign: {
    left: '70.2%',
    top: '50.5%',
    width: '28.6%',
    height: '10.6%',
    transform: [{ rotate: '1.2deg' }], // Matches the hand-drawn tilt of the right signboard
  },
  markerCircle: {
    borderWidth: 2.8,
    borderColor: '#6B8F5E', // Felt-tip green marker outline
    borderRadius: 24, // Forms a natural organic oval around the text
    paddingHorizontal: 10,
    paddingVertical: 4,
    transform: [{ rotate: '-3.5deg' }], // Organic hand-drawn tilt for the selector oval
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerCircleEmpty: {
    borderWidth: 2.8,
    borderColor: 'transparent', // Keeps layout padding exactly the same to prevent text jumps
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signText: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  signTextUnselected: {
    color: '#292524', // Marker charcoal grey
  },
  signTextSelected: {
    color: '#6B8F5E', // Green marker color matching the circle
  },

  /* ================= FOOTER / BUTTON STYLES ================= */
  footer: {
    width: '100%',
    paddingBottom: 4,
  },
  /* 3D Tactile Buttons */
  primary3DButton: {
    backgroundColor: '#4A6341',
    borderRadius: 16,
    height: 54,
    width: '100%',
    marginBottom: 14,
  },
  primary3DButtonInner: {
    backgroundColor: '#6B8F5E',
    borderRadius: 16,
    height: 50,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  secondary3DButton: {
    backgroundColor: '#D1D5DB',
    borderRadius: 16,
    height: 54,
    width: '100%',
  },
  secondary3DButtonInner: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    height: 50,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#C4704A',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  /* Language Step Actions */
  continueButton: {
    backgroundColor: '#4A6341', // Bottom 3D shadow color
    borderRadius: 24,
    height: 58,
    width: '100%',
    marginBottom: 12,
  },
  continueButtonInner: {
    backgroundColor: '#6B8F5E', // Sage green top key
    borderRadius: 24,
    height: 54,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  backLinkButton: {
    width: '100%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  backLinkText: {
    color: '#657266',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    textDecorationLine: 'underline',
  },
  /* ================= GOAL SELECTION STYLES ================= */
  goalStepContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F5F8F5',
    paddingTop: Platform.OS === 'ios' ? 54 : 32,
    paddingBottom: 24,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalFooterButtons: {
    width: '100%',
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  /* --- Top Row: Mascot Left + Bubble Right --- */
  goalTopHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    width: '100%',
    marginTop: 4,
    gap: 12,
    zIndex: 1,
  },
  goalPeekingMascot: {
    position: 'absolute',
    left: 0,
    top: -height * 0.025,
    width: width * 0.32,
    height: width * 0.32 * (273 / 161),
    zIndex: 1,
  },
  goalSpeechBubbleRight: {
    flex: 1,
    marginLeft: width * 0.31,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 2,
  },
  goalBubbleArrowLeft: {
    position: 'absolute',
    left: -8,
    top: '38%',
    zIndex: 3,
  },
  goalArrowFill: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#FFFFFF',
    zIndex: 2,
  },
  goalArrowBorder: {
    position: 'absolute',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderRightWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#E5E7EB',
    zIndex: 1,
    left: -2,
    top: -2,
  },
  goalSpeechTitle: {
    fontFamily: 'System',
    fontSize: 12.5,
    fontWeight: '800',
    color: '#292524',
    marginBottom: 2,
  },
  goalSpeechSub: {
    fontFamily: 'System',
    fontSize: 9.5,
    color: '#78716C',
    fontWeight: '600',
    lineHeight: 13,
  },
  /* --- Swipeable Focus Card Carousel --- */
  carouselSection: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
    zIndex: 10,
  },
  carouselScrollView: {
    height: 320,
    overflow: 'visible', // Ensure transforms are not clipped
  },
  focusCard: {
    height: 220, // More compact card height (220px) to prevent overlapping bubble
    borderRadius: 24,
    padding: 20,
    justifyContent: 'space-between',
    borderWidth: 2,
    borderBottomWidth: 5,
    overflow: 'hidden',
    // Premium card shadow
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  focusCardTop: {
    alignItems: 'center',
    gap: 8,
  },
  focusCardIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusCardIndex: {
    fontFamily: 'System',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  focusCardBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginVertical: 8,
  },
  focusCardTitle: {
    fontFamily: 'System',
    fontSize: 20,
    fontWeight: '800',
    color: '#292524',
    lineHeight: 26,
    marginBottom: 6,
    textAlign: 'center',
  },
  focusCardSubtitle: {
    fontFamily: 'System',
    fontSize: 13,
    color: '#78716C',
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  /* Dot Indicators */
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    backgroundColor: '#6B8F5E',
    width: 24,
    borderRadius: 4,
  },
});
