import React, { useState, useRef } from 'react';
import { 
   View, 
   Text, 
   TextInput, 
   TouchableOpacity, 
   StyleSheet, 
   Alert, 
   ActivityIndicator, 
   Pressable, 
   Keyboard,
   KeyboardAvoidingView,
   Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../lib/LanguageContext';

type RootStackParamList = {
  OtpVerification: { email: string };
};

const localTranslations = {
  en: {
    title: "Enter verification code",
    subtitlePre: "A 6-digit PIN has been sent to ",
    subtitlePost: ". Please enter it below to verify.",
    verifyBtn: "Verify",
    didNotReceive: "Didn't receive it? ",
    resendLink: "Resend Code",
    pinErrorTitle: "Error",
    pinErrorMessage: "Please enter the 6-digit PIN.",
    verificationFailedTitle: "Verification Failed",
    resendSuccessTitle: "Success",
    resendSuccessMessage: "A new 6-digit PIN has been sent to your email.",
  },
  ne: {
    title: "सत्यापन कोड प्रविष्ट गर्नुहोस्",
    subtitlePre: "६-अङ्कको PIN ",
    subtitlePost: " मा पठाइएको छ। कृपया प्रमाणीकरण गर्न यसलाई तल प्रविष्ट गर्नुहोस्।",
    verifyBtn: "प्रमाणित गर्नुहोस्",
    didNotReceive: "कोड प्राप्त भएन? ",
    resendLink: "पुन: पठाउनुहोस्",
    pinErrorTitle: "त्रुटि",
    pinErrorMessage: "कृपया ६-अङ्कको PIN प्रविष्ट गर्नुहोस्।",
    verificationFailedTitle: "प्रमाणीकरण असफल भयो",
    resendSuccessTitle: "सफलता",
    resendSuccessMessage: "नयाँ ६-अङ्कको PIN तपाईंको इमेलमा पठाइएको छ।",
  }
};

export default function OtpVerificationScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'OtpVerification'>>();
  const { email } = route.params;
  const navigation = useNavigation<any>();
  const { language } = useLanguage();
  const tLocal = localTranslations[language] || localTranslations.en;

  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleVerify = async () => {
    if (pin.length !== 6) {
      Alert.alert(tLocal.pinErrorTitle, tLocal.pinErrorMessage);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: pin,
      type: 'signup',
    });
    setLoading(false);

    if (error) {
      Alert.alert(tLocal.verificationFailedTitle, error.message);
    }
  };

  const handleResend = async () => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    if (error) {
      Alert.alert(tLocal.pinErrorTitle, error.message);
    } else {
      Alert.alert(tLocal.resendSuccessTitle, tLocal.resendSuccessMessage);
    }
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <Pressable style={styles.content} onPress={Keyboard.dismiss}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="mail-open-outline" size={32} color="#6B8F5E" />
            </View>
          </View>

          <Text style={styles.title}>{tLocal.title}</Text>
          <Text style={styles.subtitle}>
            {tLocal.subtitlePre}<Text style={styles.emailHighlight}>{email}</Text>{tLocal.subtitlePost}
          </Text>

          <View style={styles.form}>
            {/* Invisible real text input */}
            <TextInput
              ref={inputRef}
              style={styles.hiddenInput}
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              maxLength={6}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              caretHidden
            />

            {/* Six stylish visual input boxes */}
            <Pressable style={styles.otpContainer} onPress={focusInput}>
              {Array.from({ length: 6 }).map((_, index) => {
                const char = pin[index] || '';
                const isCurrent = pin.length === index;
                const isActive = isFocused && isCurrent;

                return (
                  <View 
                    key={index} 
                    style={[
                      styles.otpBox, 
                      isActive && styles.otpBoxActive,
                      char !== '' && styles.otpBoxFilled
                    ]}
                  >
                    <Text style={styles.otpText}>{char}</Text>
                    {isActive && <View style={styles.cursor} />}
                  </View>
                );
              })}
            </Pressable>

            <TouchableOpacity 
              style={[styles.primaryButton, loading && styles.disabledButton]} 
              onPress={handleVerify} 
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>{tLocal.verifyBtn}</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{tLocal.didNotReceive}</Text>
            <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
              <Text style={styles.footerLink}>{tLocal.resendLink}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1A',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2A2A28',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3A38',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingBottom: 60,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(107, 143, 94, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(107, 143, 94, 0.2)',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#A1A1A1',
    lineHeight: 22,
    marginBottom: 40,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  emailHighlight: {
    color: '#FFF',
    fontWeight: '600',
  },
  form: {
    marginBottom: 24,
  },
  hiddenInput: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    width: '100%',
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#2A2A28',
    borderWidth: 1,
    borderColor: '#3A3A38',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  otpBoxActive: {
    borderColor: '#6B8F5E',
    backgroundColor: '#1E251B',
  },
  otpBoxFilled: {
    borderColor: '#4A4A48',
  },
  otpText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
  },
  cursor: {
    position: 'absolute',
    width: 2,
    height: 20,
    backgroundColor: '#6B8F5E',
  },
  primaryButton: {
    backgroundColor: '#6B8F5E',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#6B8F5E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  disabledButton: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#A1A1A1',
    fontSize: 14,
  },
  footerLink: {
    color: '#C4704A',
    fontSize: 14,
    fontWeight: '600',
  },
});
