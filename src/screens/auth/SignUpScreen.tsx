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
    emailLabel: "Email Address",
    passwordLabel: "Password",
    confirmPasswordLabel: "Confirm Password",
    signUpBtn: "SIGN UP",
    alreadyHaveAccount: "Already have an account? ",
    logInLink: "Log In",
    emailRequired: "Email address is required",
    emailInvalid: "Please enter a valid email address",
    passwordRequired: "Password is required",
    passwordLength: "Password must be at least 6 characters",
    confirmRequired: "Please confirm your password",
    passwordsMismatch: "Passwords do not match",
    signUpError: "Sign Up Error",
    emailPlaceholder: "farmer@example.com",
    passwordPlaceholder: "Create a password",
    confirmPlaceholder: "Repeat your password",
    strengthLabel: "Password Strength: ",
    strengthWeak: "Weak",
    strengthFair: "Fair",
    strengthGood: "Good",
    strengthStrong: "Strong",
    reqLength: "At least 6 characters",
    reqNumberSymbol: "Contains a number or symbol",
  },
  ne: {
    emailLabel: "इमेल ठेगाना",
    passwordLabel: "पासवर्ड",
    confirmPasswordLabel: "पासवर्ड पुष्टि गर्नुहोस्",
    signUpBtn: "दर्ता गर्नुहोस्",
    alreadyHaveAccount: "पहिल्यै खाता छ? ",
    logInLink: "लगइन गर्नुहोस्",
    emailRequired: "इमेल ठेगाना आवश्यक छ",
    emailInvalid: "कृपया मान्य इमेल ठेगाना प्रविष्ट गर्नुहोस्",
    passwordRequired: "पासवर्ड आवश्यक छ",
    passwordLength: "पासवर्ड कम्तिमा ६ अक्षरको हुनुपर्छ",
    confirmRequired: "कृपया आफ्नो पासवर्ड पुष्टि गर्नुहोस्",
    passwordsMismatch: "पासवर्डहरू मिलेनन्",
    signUpError: "दर्ता गर्दा त्रुटि भयो",
    emailPlaceholder: "कृषक@उदाहरण.com",
    passwordPlaceholder: "नयाँ पासवर्ड सिर्जना गर्नुहोस्",
    confirmPlaceholder: "पासवर्ड पुन: टाइप गर्नुहोस्",
    strengthLabel: "पासवर्ड बल: ",
    strengthWeak: "कमजोर",
    strengthFair: "ठिकै",
    strengthGood: "राम्रो",
    strengthStrong: "बलियो",
    reqLength: "कम्तिमा ६ अक्षर हुनुपर्छ",
    reqNumberSymbol: "एक अंक वा प्रतीक समावेश हुनुपर्छ",
  }
};

export default function SignUpScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { language } = useLanguage();
  const tLocal = localTranslations[language] || localTranslations.en;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Validation and focus states
  const [focusedField, setFocusedField] = useState<'email' | 'password' | 'confirm' | null>(null);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');

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

  const validateConfirm = (text: string, pass: string) => {
    if (!text) {
      setConfirmError(tLocal.confirmRequired);
      return false;
    }
    if (text !== pass) {
      setConfirmError(tLocal.passwordsMismatch);
      return false;
    }
    setConfirmError('');
    return true;
  };

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: '#E5E7EB' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score, label: tLocal.strengthWeak, color: '#C4704A' }; // Terracotta
    if (score === 2) return { score, label: tLocal.strengthFair, color: '#F97316' }; // Orange
    if (score === 3) return { score, label: tLocal.strengthGood, color: '#EAB308' }; // Yellow
    return { score, label: tLocal.strengthStrong, color: '#6B8F5E' }; // Sage Green
  };

  const handleSignUp = async () => {
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);
    const isConfirmValid = validateConfirm(confirmPassword, password);

    if (!isEmailValid || !isPasswordValid || !isConfirmValid) {
      return;
    }
    
    setLoading(true);
    const { error } = await supabase.auth.signUp({ 
      email: email.trim(), 
      password 
    });
    setLoading(false);

    if (error) {
      Alert.alert(tLocal.signUpError, error.message);
    } else {
      navigation.navigate('OtpVerification', { email: email.trim() });
    }
  };

  const handleGoogleSignUp = async () => {
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
      Alert.alert('Google Sign-Up Error', e.message);
    }
  };

  const pStrength = getPasswordStrength(password);

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
            {/* Mascot Section */}
            <View style={styles.mascotContainer}>
              <Image
                source={require('../../../assets/images/avatar_peeking_cropped.png')}
                style={styles.mascotImage}
                resizeMode="contain"
              />
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
                <Text style={styles.label}>{tLocal.passwordLabel}</Text>
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
                      if (confirmError) validateConfirm(confirmPassword, text);
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

                {/* Password Strength Indicator */}
                {focusedField === 'password' && password.length > 0 && (
                  <View style={styles.strengthContainer}>
                    <View style={styles.strengthHeader}>
                      <Text style={styles.strengthLabelText}>{tLocal.strengthLabel}</Text>
                      <Text style={[styles.strengthValueText, { color: pStrength.color }]}>
                        {pStrength.label}
                      </Text>
                    </View>
                    <View style={styles.strengthBarBg}>
                      <View 
                        style={[
                          styles.strengthBarActive, 
                          { 
                            width: `${(pStrength.score / 5) * 100}%`, 
                            backgroundColor: pStrength.color 
                          }
                        ]} 
                      />
                    </View>
                    {/* Checklist */}
                    <View style={styles.requirementsList}>
                      <View style={styles.requirementRow}>
                        <Ionicons 
                          name={password.length >= 6 ? "checkmark-circle" : "ellipse-outline"} 
                          size={14} 
                          color={password.length >= 6 ? "#6B8F5E" : "#78716C"} 
                        />
                        <Text style={[styles.requirementText, password.length >= 6 && styles.requirementTextActive]}>
                          {tLocal.reqLength}
                        </Text>
                      </View>
                      <View style={styles.requirementRow}>
                        <Ionicons 
                          name={(pass => /[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass))(password) ? "checkmark-circle" : "ellipse-outline"} 
                          size={14} 
                          color={(pass => /[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass))(password) ? "#6B8F5E" : "#78716C"} 
                        />
                        <Text style={[
                          styles.requirementText, 
                          (pass => /[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass))(password) && styles.requirementTextActive
                        ]}>
                          {tLocal.reqNumberSymbol}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* Confirm Password field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{tLocal.confirmPasswordLabel}</Text>
                <View style={[
                  styles.inputContainer,
                  focusedField === 'confirm' && styles.inputContainerFocused,
                  !!confirmError && styles.inputContainerError
                ]}>
                  <Ionicons 
                    name="shield-checkmark-outline" 
                    size={20} 
                    color={confirmError ? '#C4704A' : (focusedField === 'confirm' ? '#6B8F5E' : '#78716C')} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={tLocal.confirmPlaceholder}
                    placeholderTextColor="#78716C"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (confirmError) validateConfirm(text, password);
                    }}
                    onFocus={() => setFocusedField('confirm')}
                    onBlur={() => setFocusedField(null)}
                    onEndEditing={(e) => validateConfirm(e.nativeEvent.text, password)}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                    <Ionicons name={showConfirmPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#78716C" />
                  </TouchableOpacity>
                </View>
                {!!confirmError && <Text style={styles.errorText}>{confirmError}</Text>}
              </View>

              {/* Button & Google Sign-Up Row */}
              <View style={styles.actionRow}>
                {/* Sign Up Tactile Button */}
                <TouchableOpacity 
                  style={styles.primary3DButton} 
                  onPress={handleSignUp} 
                  disabled={loading}
                  activeOpacity={0.9}
                >
                  <View style={styles.primary3DButtonInner}>
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>{tLocal.signUpBtn}</Text>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Google Sign-in Tactile Icon-only */}
                <TouchableOpacity 
                  style={styles.google3DButton} 
                  onPress={handleGoogleSignUp}
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
              <Text style={styles.footerText}>{tLocal.alreadyHaveAccount}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.footerLink}>{tLocal.logInLink}</Text>
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
    backgroundColor: '#F5F8F5',
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  mascotContainer: {
    alignItems: 'center',
    marginBottom: -6, // Overlaps the card border so she rests directly on it!
    zIndex: 10,       // Ensures she sits on top of the card border
  },
  mascotImage: {
    width: 160,
    height: 127,
  },
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // Glassmorphism cream background
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
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#78716C',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
  strengthContainer: {
    marginTop: 10,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  strengthLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78716C',
  },
  strengthValueText: {
    fontSize: 11,
    fontWeight: '800',
  },
  strengthBarBg: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  strengthBarActive: {
    height: '100%',
    borderRadius: 3,
  },
  requirementsList: {
    gap: 4,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  requirementText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#78716C',
  },
  requirementTextActive: {
    color: '#292524',
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
    color: '#78716C', // Darker footer text color for readability over backgrounds
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(255,255,255,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  footerLink: {
    color: '#4A6341', // Darker sage green link
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
