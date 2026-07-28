import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  Image 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../lib/LanguageContext';

type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  ResetPasswordOtp: { email: string };
};

const localTranslations = {
  en: {
    title: "Recover Your Account",
    subtitle: "Enter your registered email address to receive a 6-digit OTP verification code.",
    emailLabel: "Email Address",
    emailPlaceholder: "farmer@example.com",
    sendOtpBtn: "SEND OTP",
    emailRequired: "Email address is required",
    emailInvalid: "Please enter a valid email address",
    resetFailedTitle: "Request Failed",
    rememberPassword: "Remembered your password? ",
    loginLink: "Log In",
  },
  ne: {
    title: "खाता पुन: प्राप्ति गर्नुहोस्",
    subtitle: "६-अङ्कको OTP कोड प्राप्त गर्न आफ्नो दर्ता गरिएको इमेल ठेगाना प्रविष्ट गर्नुहोस्।",
    emailLabel: "इमेल ठेगाना",
    emailPlaceholder: "कृषक@उदाहरण.com",
    sendOtpBtn: "OTP पठाउनुहोस्",
    emailRequired: "इमेल ठेगाना आवश्यक छ",
    emailInvalid: "कृपया मान्य इमेल ठेगाना प्रविष्ट गर्नुहोस्",
    resetFailedTitle: "अनुरोध असफल भयो",
    rememberPassword: "पासवर्ड सम्झनुभयो? ",
    loginLink: "लगइन गर्नुहोस्",
  }
};

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { language } = useLanguage();
  const tLocal = localTranslations[language] || localTranslations.en;

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [isFocused, setIsFocused] = useState(false);

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

  const handleSendOtp = async () => {
    if (!validateEmail(email)) {
      return;
    }

    setLoading(true);
    const trimmedEmail = email.trim();
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
    setLoading(false);

    if (error) {
      Alert.alert(tLocal.resetFailedTitle, error.message);
    } else {
      navigation.navigate('ResetPasswordOtp', { email: trimmedEmail });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Top Header with Back Button always anchored at the top */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#292524" />
        </TouchableOpacity>
      </View>

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
              source={require('../../../assets/images/avatar_thinking.png')}
              style={styles.mascotImage}
              resizeMode="contain"
            />
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.title}>{tLocal.title}</Text>
            <Text style={styles.subtitle}>{tLocal.subtitle}</Text>

            {/* Email Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{tLocal.emailLabel}</Text>
              <View style={[
                styles.inputContainer,
                isFocused && styles.inputContainerFocused,
                !!emailError && styles.inputContainerError
              ]}>
                <Ionicons 
                  name="mail-outline" 
                  size={20} 
                  color={emailError ? '#C4704A' : (isFocused ? '#6B8F5E' : '#78716C')} 
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
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onEndEditing={(e) => validateEmail(e.nativeEvent.text)}
                />
              </View>
              {!!emailError && <Text style={styles.errorText}>{emailError}</Text>}
            </View>

            {/* Send OTP Tactile 3D Button */}
            <TouchableOpacity 
              style={styles.primary3DButton} 
              onPress={handleSendOtp} 
              disabled={loading}
              activeOpacity={0.9}
            >
              <View style={styles.primary3DButtonInner}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.primaryButtonText}>{tLocal.sendOtpBtn}</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFF" style={{ marginLeft: 8 }} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Footer Navigation */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{tLocal.rememberPassword}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}>{tLocal.loginLink}</Text>
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
  topBar: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
    justifyContent: 'center',
  },
  mascotContainer: {
    alignItems: 'center',
    marginBottom: -8,
    zIndex: 10,
  },
  mascotImage: {
    width: 140,
    height: 120,
  },
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
  title: {
    fontFamily: 'System',
    fontSize: 22,
    fontWeight: '900',
    color: '#292524',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '600',
    color: '#78716C',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  inputGroup: {
    marginBottom: 20,
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
    borderColor: '#6B8F5E',
    backgroundColor: '#FFFFFF',
  },
  inputContainerError: {
    borderColor: '#C4704A',
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
  errorText: {
    fontFamily: 'System',
    color: '#C4704A',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
    marginLeft: 4,
  },
  primary3DButton: {
    backgroundColor: '#4A6341',
    borderRadius: 20,
    height: 54,
    marginTop: 4,
  },
  primary3DButtonInner: {
    backgroundColor: '#6B8F5E',
    borderRadius: 20,
    height: 50,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#78716C',
    fontSize: 14,
    fontWeight: '600',
  },
  footerLink: {
    color: '#4A6341',
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
