import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../lib/LanguageContext';

const { width } = Dimensions.get('window');

type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  OtpVerification: { email: string };
};

const localTranslations = {
  en: {
    subtitle: "THE DIGITAL AGRONOMIST",
    emailLabel: "Email Address",
    passwordLabel: "Password",
    forgotPassword: "Forgot Password?",
    signInBtn: "SIGN IN",
    dontHaveAccount: "Don't have an account? ",
    signUpLink: "Sign Up",
    emailRequired: "Email address is required",
    emailInvalid: "Please enter a valid email address",
    passwordRequired: "Password is required",
    passwordLength: "Password must be at least 6 characters",
    loginFailed: "Login Failed",
    emailPlaceholder: "farmer@example.com",
    passwordPlaceholder: "Enter your password",
  },
  ne: {
    subtitle: "डिजिटल कृषिविज्ञानी",
    emailLabel: "इमेल ठेगाना",
    passwordLabel: "पासवर्ड",
    forgotPassword: "पासवर्ड बिर्सनुभयो?",
    signInBtn: "साइन इन गर्नुहोस्",
    dontHaveAccount: "खाता छैन? ",
    signUpLink: "दर्ता गर्नुहोस्",
    emailRequired: "इमेल ठेगाना आवश्यक छ",
    emailInvalid: "कृपया मान्य इमेल ठेगाना प्रविष्ट गर्नुहोस्",
    passwordRequired: "पासवर्ड आवश्यक छ",
    passwordLength: "पासवर्ड कम्तिमा ६ अक्षरको हुनुपर्छ",
    loginFailed: "लगइन असफल भयो",
    emailPlaceholder: "कृषक@उदाहरण.com",
    passwordPlaceholder: "आफ्नो पासवर्ड प्रविष्ट गर्नुहोस्",
  }
};

export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { language } = useLanguage();
  const tLocal = localTranslations[language] || localTranslations.en;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Validation and focus states
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validateEmail = (text: string) => {
    if (!text.trim()) {
      setEmailError(tLocal.emailRequired);
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(text.trim())) {
      setEmailError(tLocal.emailInvalid);
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (text: string) => {
    if (!text) {
      setPasswordError(tLocal.passwordRequired);
      return false;
    }
    if (text.length < 6) {
      setPasswordError(tLocal.passwordLength);
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleLogin = async () => {
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      Alert.alert(tLocal.loginFailed, error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const redirectUrl = AuthSession.makeRedirectUri();
      console.log('OAuth Redirect URL:', redirectUrl);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

        if (result.type === 'success' && result.url) {
          const url = result.url;
          const fragment = url.split('#')[1];
          if (fragment) {
            const params = new URLSearchParams(fragment);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (accessToken && refreshToken) {
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (sessionError) throw sessionError;
            }
          }
        }
      }
    } catch (e: any) {
      Alert.alert('Google Sign-In Error', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header with App Icon Logo */}
          <View style={styles.header}>
            <Image
              source={require('../../../assets/icon.png')}
              style={styles.logo}
              resizeMode="cover"
            />
            <Text style={styles.title}>AVANI</Text>
            <Text style={styles.subtitle}>{tLocal.subtitle}</Text>
          </View>

          {/* Form Container */}
          <View style={styles.formCard}>
            {/* Email field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{tLocal.emailLabel}</Text>
              <View style={[
                styles.inputContainer,
                focusedField === 'email' && styles.inputContainerFocused,
                !!emailError && styles.inputContainerError
              ]}>
                <Ionicons 
                  name="mail-outline" 
                  size={20} 
                  color={emailError ? '#C4704A' : (focusedField === 'email' ? '#6B8F5E' : '#78716C')} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={styles.input}
                  placeholder={tLocal.emailPlaceholder}
                  placeholderTextColor="#78716C"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (emailError) validateEmail(text);
                  }}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  onEndEditing={(e) => validateEmail(e.nativeEvent.text)}
                />
              </View>
              {!!emailError && <Text style={styles.errorText}>{emailError}</Text>}
            </View>

            {/* Password field */}
            <View style={styles.inputGroup}>
              <View style={styles.passwordHeader}>
                <Text style={styles.label}>{tLocal.passwordLabel}</Text>
                <TouchableOpacity>
                  <Text style={styles.forgotPassword}>{tLocal.forgotPassword}</Text>
                </TouchableOpacity>
              </View>
              <View style={[
                styles.inputContainer,
                focusedField === 'password' && styles.inputContainerFocused,
                !!passwordError && styles.inputContainerError
              ]}>
                <Ionicons 
                  name="lock-closed-outline" 
                  size={20} 
                  color={passwordError ? '#C4704A' : (focusedField === 'password' ? '#6B8F5E' : '#78716C')} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={styles.input}
                  placeholder={tLocal.passwordPlaceholder}
                  placeholderTextColor="#78716C"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (passwordError) validatePassword(text);
                  }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  onEndEditing={(e) => validatePassword(e.nativeEvent.text)}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#78716C" />
                </TouchableOpacity>
              </View>
              {!!passwordError && <Text style={styles.errorText}>{passwordError}</Text>}
            </View>

            {/* Button & Google Sign-In Row */}
            <View style={styles.actionRow}>
              {/* Login Tactile Button */}
              <TouchableOpacity 
                style={styles.primary3DButton} 
                onPress={handleLogin} 
                disabled={loading}
                activeOpacity={0.9}
              >
                <View style={styles.primary3DButtonInner}>
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>{tLocal.signInBtn}</Text>
                  )}
                </View>
              </TouchableOpacity>

              {/* Google Sign-in Tactile Icon-only */}
              <TouchableOpacity 
                style={styles.google3DButton} 
                onPress={handleGoogleSignIn}
                activeOpacity={0.9}
              >
                <View style={styles.google3DButtonInner}>
                  <Ionicons name="logo-google" size={20} color="#78716C" />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer Navigation */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{tLocal.dontHaveAccount}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.footerLink}>{tLocal.signUpLink}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8F5', // Seamless cream background
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  title: {
    fontFamily: 'System',
    fontSize: 28,
    fontWeight: '900',
    color: '#292524',
    letterSpacing: 2,
  },
  subtitle: {
    fontFamily: 'System',
    fontSize: 10,
    fontWeight: '800',
    color: '#78716C',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 2,
    borderBottomWidth: 6,
    borderColor: '#E5E7EB',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 18,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#78716C',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  forgotPassword: {
    color: '#C4704A', // Terracotta link color
    fontSize: 12,
    fontWeight: '800',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    height: 52,
  },
  inputContainerFocused: {
    borderColor: '#6B8F5E', // Focus glow sage
    backgroundColor: '#FFFFFF',
  },
  inputContainerError: {
    borderColor: '#C4704A', // Muted terracotta error border
    backgroundColor: '#FFFDFD',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#292524',
    fontSize: 15,
    fontWeight: '600',
  },
  eyeIcon: {
    padding: 8,
    marginRight: -8,
  },
  errorText: {
    fontFamily: 'System',
    color: '#C4704A',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
    marginLeft: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  primary3DButton: {
    flex: 1,
    backgroundColor: '#4A6341', // Bottom 3D shadow color
    borderRadius: 20,
    height: 54,
    marginRight: 14, // Gap between buttons
  },
  primary3DButtonInner: {
    backgroundColor: '#6B8F5E', // Sage green top key
    borderRadius: 20,
    height: 50,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  google3DButton: {
    width: 54,
    height: 54,
    backgroundColor: '#D1D5DB', // 3D shadow
    borderRadius: 20,
  },
  google3DButtonInner: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    height: 50,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  footerText: {
    color: '#78716C',
    fontSize: 14,
    fontWeight: '600',
  },
  footerLink: {
    color: '#6B8F5E', // Sage link
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
