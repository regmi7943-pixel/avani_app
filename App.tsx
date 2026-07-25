import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Asset } from 'expo-asset';
import { supabase } from './src/lib/supabase';

import OnboardingScreen from './src/screens/auth/OnboardingScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import SignUpScreen from './src/screens/auth/SignUpScreen';
import OtpVerificationScreen from './src/screens/auth/OtpVerificationScreen';
import SuccessScreen from './src/screens/auth/SuccessScreen';

import MainTabNavigator from './src/navigation/MainTabNavigator';

import AddFieldScreen from './src/screens/main/AddFieldScreen';
import YieldAnalysisScreen from './src/screens/main/YieldAnalysisScreen';
import ProductDetailScreen from './src/screens/main/ProductDetailScreen';
import AllProductsScreen from './src/screens/main/AllProductsScreen';
import SoilReportScreen from './src/screens/main/SoilReportScreen';
import CropHistoryScreen from './src/screens/main/CropHistoryScreen';
import MasterclassDetailScreen from './src/screens/main/MasterclassDetailScreen';
import { ThemeProvider } from './src/lib/ThemeContext';
import { LanguageProvider } from './src/lib/LanguageContext';
import { CartProvider } from './src/lib/CartContext';
import { setupLocalTables } from './src/services/localDb';
import { initNetInfoSyncListener } from './src/services/syncEngine';
import { registerBackgroundWeatherCheck } from './src/services/weatherAlertService';

// Call this once at the app root level — handles the redirect back from the browser
WebBrowser.maybeCompleteAuthSession();

const Stack = createNativeStackNavigator();

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<'Onboarding' | 'Login'>('Onboarding');
  const [session, setSession] = useState<Session | null>(null);
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const isInitiallyLoaded = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // Wait a moment for any immediate/initial auth events to fire before we start capturing new login events
      setTimeout(() => {
        isInitiallyLoaded.current = true;
      }, 500);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_IN' && isInitiallyLoaded.current) {
        setJustLoggedIn(true);
      }
      if (event === 'SIGNED_OUT') {
        setJustLoggedIn(false);
      }
    });

    const prepareApp = async () => {
      try {
        await setupLocalTables();
        await registerBackgroundWeatherCheck();
        // 1. Load the first image (mascot waving GIF, thinking avatar, waving happy avatar, app icon logo) and audio clicks while the splash screen is showing
        await Asset.loadAsync([
          require('./assets/images/avatar_waving.gif'),
          require('./assets/images/avatar_thinking.png'),
          require('./assets/images/avatar_waving_happy.png'),
          require('./assets/sounds/typewriter_click.wav'),
          require('./assets/icon.png')
        ]);

        // 2. Load the second image (auth background), signs still image, peeking, and other assets in the background beforehand
        Asset.loadAsync([
          require('./assets/images/auth-bg.png'),
          require('./assets/images/avatar_signs_still.png'),
          require('./assets/images/auth-bg-goal.png'),
          require('./assets/images/avatar_peeking_cropped.png'),
          require('./assets/images/avatar_success.png'),
          require('./assets/images/avatar_peeking.png'),
          require('./assets/images/avatar_signs.gif'),
          require('./assets/images/card_bg_seed.jpg'),
          require('./assets/images/card_bg_fertilizer.jpg'),
          require('./assets/images/card_bg_vitamins.jpg'),
          require('./assets/images/card_bg_tools.jpg'),
          require('./assets/images/carousel_chitwan.jpg'),
          require('./assets/images/carousel_pokhara.jpg'),
          require('./assets/images/carousel_kathmandu.jpg')
        ]);

        const hasViewed = await AsyncStorage.getItem('hasViewedOnboarding');
        if (hasViewed === 'true') {
          setInitialRoute('Login');
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setIsReady(true);
      }
    };

    prepareApp();
    initNetInfoSyncListener();

    // Handle deep links when the app is already open
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      if (url) {
        const fragment = url.split('#')[1];
        if (fragment) {
          const params = new URLSearchParams(fragment);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
        }
      }
    };

    // Listen for incoming deep links
    const linkingSub = Linking.addEventListener('url', handleDeepLink);

    // Check if the app was opened via a deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => {
      subscription.unsubscribe();
      linkingSub.remove();
    };
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6B8F5E" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <LanguageProvider>
        <CartProvider>
          <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              {session && session.user ? (
                <>
                  {justLoggedIn ? (
                    <Stack.Screen name="Success">
                      {(props) => <SuccessScreen {...props} onComplete={() => setJustLoggedIn(false)} />}
                    </Stack.Screen>
                  ) : (
                    <>
                      <Stack.Screen name="Main" component={MainTabNavigator} />
                      <Stack.Screen name="AddField" component={AddFieldScreen} />
                      <Stack.Screen name="YieldAnalysis" component={YieldAnalysisScreen} />
                      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
                      <Stack.Screen name="AllProducts" component={AllProductsScreen} />
                      <Stack.Screen name="SoilReport" component={SoilReportScreen} />
                      <Stack.Screen name="CropHistory" component={CropHistoryScreen} />
                      <Stack.Screen name="MasterclassDetail" component={MasterclassDetailScreen} />
                    </>
                  )}
                </>
              ) : (
                <>
                  <Stack.Screen name="Onboarding" component={OnboardingScreen} initialParams={{ initial: initialRoute === 'Onboarding' }} />
                  <Stack.Screen name="Login" component={LoginScreen} />
                  <Stack.Screen name="SignUp" component={SignUpScreen} />
                  <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
                </>
              )}
            </Stack.Navigator>
          </NavigationContainer>
        </CartProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C1C1A',
  },
});
