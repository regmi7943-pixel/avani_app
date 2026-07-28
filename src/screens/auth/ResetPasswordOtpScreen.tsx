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
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  Image 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../lib/LanguageContext';

type RootStackParamList = {
  Login: undefined;
  ResetPasswordOtp: { email: string };
};

const localTranslations = {
  en: {
    step1Badge: "STEP 1 OF 2 • VERIFY CODE",
    step2Badge: "STEP 2 OF 2 • CREATE NEW PASSWORD",
    otpTitle: "Enter Verification Code",
    otpSubtitlePre: "A 6-digit PIN has been sent to ",
    otpSubtitlePost: ". Please enter it below.",
    otpLabel: "6-DIGIT OTP CODE",
    verifyOtpBtn: "VERIFY OTP",
    newPasswordTitle: "Create New Password",
    newPasswordSubtitle: "Set a strong and secure new password for your account.",
    newPasswordLabel: "NEW PASSWORD",
    confirmPasswordLabel: "CONFIRM NEW PASSWORD",
    newPasswordPlaceholder: "Enter new password",
    confirmPasswordPlaceholder: "Re-enter new password",
    resetBtn: "UPDATE PASSWORD",
    pinErrorTitle: "Invalid Code",
    pinErrorMessage: "Please enter the complete 6-digit PIN code.",
    passwordRequired: "New password is required",
    passwordLength: "Password must be at least 6 characters",
    confirmRequired: "Please confirm your new password",
    passwordsMismatch: "Passwords do not match",
    resetFailedTitle: "Verification Failed",
    updateFailedTitle: "Password Update Failed",
    resetSuccessTitle: "Password Reset!",
    resetSuccessMessage: "Your password has been successfully updated. Please sign in with your new password.",
    didNotReceive: "Didn't receive code? ",
    resendLink: "Resend OTP",
    resendSuccessTitle: "Code Resent",
    resendSuccessMessage: "A new 6-digit OTP code has been sent to your email.",
    strengthLabel: "Password Strength: ",
    strengthWeak: "Weak",
    strengthFair: "Fair",
    strengthGood: "Good",
    strengthStrong: "Strong",
    reqLength: "At least 6 characters",
    reqNumberSymbol: "Contains a number or symbol",
  },
  ne: {
    step1Badge: "चरण १/२ • OTP सत्यापन",
    step2Badge: "चरण २/२ • नयाँ पासवर्ड",
    otpTitle: "सत्यापन कोड प्रविष्ट गर्नुहोस्",
    otpSubtitlePre: "६-अङ्कको PIN ",
    otpSubtitlePost: " मा पठाइएको छ। कृपया तल प्रविष्ट गर्नुहोस्।",
    otpLabel: "६-अङ्कको OTP कोड",
    verifyOtpBtn: "OTP प्रमाणित गर्नुहोस्",
    newPasswordTitle: "नयाँ पासवर्ड सिर्जना गर्नुहोस्",
    newPasswordSubtitle: "आफ्नो खाताको लागि बलियो नयाँ पासवर्ड सिर्जना गर्नुहोस्।",
    newPasswordLabel: "नयाँ पासवर्ड",
    confirmPasswordLabel: "नयाँ पासवर्ड पुष्टि गर्नुहोस्",
    newPasswordPlaceholder: "नयाँ पासवर्ड प्रविष्ट गर्नुहोस्",
    confirmPasswordPlaceholder: "नयाँ पासवर्ड पुन: प्रविष्ट गर्नुहोस्",
    resetBtn: "पासवर्ड अद्यावधिक गर्नुहोस्",
    pinErrorTitle: "अमान्य कोड",
    pinErrorMessage: "कृपया पूर्ण ६-अङ्कको PIN प्रविष्ट गर्नुहोस्।",
    passwordRequired: "नयाँ पासवर्ड आवश्यक छ",
    passwordLength: "पासवर्ड कम्तिमा ६ अक्षरको हुनुपर्छ",
    confirmRequired: "कृपया नयाँ पासवर्ड पुष्टि गर्नुहोस्",
    passwordsMismatch: "पासवर्डहरू मिलेनन्",
    resetFailedTitle: "प्रमाणीकरण असफल भयो",
    updateFailedTitle: "पासवर्ड अद्यावधिक असफल भयो",
    resetSuccessTitle: "पासवर्ड सफलता!",
    resetSuccessMessage: "तपाईंको पासवर्ड सफलतापूर्वक अद्यावधिक गरिएको छ। कृपया नयाँ पासवर्डबाट लगइन गर्नुहोस्।",
    didNotReceive: "कोड प्राप्त भएन? ",
    resendLink: "पुन: पठाउनुहोस्",
    resendSuccessTitle: "कोड पठाइयो",
    resendSuccessMessage: "नयाँ ६-अङ्कको OTP कोड तपाईंको इमेलमा पठाइएको छ।",
    strengthLabel: "पासवर्ड बल: ",
    strengthWeak: "कमजोर",
    strengthFair: "ठिकै",
    strengthGood: "राम्रो",
    strengthStrong: "बलियो",
    reqLength: "कम्तिमा ६ अक्षर हुनुपर्छ",
    reqNumberSymbol: "एक अंक वा प्रतीक समावेश हुनुपर्छ",
  }
};

export default function ResetPasswordOtpScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ResetPasswordOtp'>>();
  const { email } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { language } = useLanguage();
  const tLocal = localTranslations[language] || localTranslations.en;

  // Step 1: 'otp', Step 2: 'new_password'
  const [step, setStep] = useState<'otp' | 'new_password'>('otp');

  const [pin, setPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Focus & Error states
  const [isPinFocused, setIsPinFocused] = useState(false);
  const [focusedField, setFocusedField] = useState<'newPassword' | 'confirm' | null>(null);
  const [pinError, setPinError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  const inputRef = useRef<TextInput>(null);

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

    if (score <= 1) return { score, label: tLocal.strengthWeak, color: '#C4704A' };
    if (score === 2) return { score, label: tLocal.strengthFair, color: '#F97316' };
    if (score === 3) return { score, label: tLocal.strengthGood, color: '#EAB308' };
    return { score, label: tLocal.strengthStrong, color: '#6B8F5E' };
  };

  // STEP 1: Verify OTP PIN
  const handleVerifyOtp = async () => {
    if (pin.length !== 6) {
      setPinError(tLocal.pinErrorMessage);
      return;
    }
    setPinError('');
    setLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: pin,
      type: 'recovery',
    });
    setLoading(false);

    if (error) {
      Alert.alert(tLocal.resetFailedTitle, error.message);
    } else {
      // OTP verified successfully -> move to step 2 (New Password)
      setStep('new_password');
    }
  };

  // STEP 2: Update Password
  const handleUpdatePassword = async () => {
    const isPasswordValid = validatePassword(newPassword);
    const isConfirmValid = validateConfirm(confirmPassword, newPassword);

    if (!isPasswordValid || !isConfirmValid) return;

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setLoading(false);

    if (error) {
      Alert.alert(tLocal.updateFailedTitle, error.message);
    } else {
      Alert.alert(tLocal.resetSuccessTitle, tLocal.resetSuccessMessage, [
        {
          text: 'OK',
          onPress: () => {
            supabase.auth.signOut();
            navigation.navigate('Login');
          },
        },
      ]);
    }
  };

  const handleResend = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      Alert.alert(tLocal.resetFailedTitle, error.message);
    } else {
      Alert.alert(tLocal.resendSuccessTitle, tLocal.resendSuccessMessage);
    }
  };

  const pStrength = getPasswordStrength(newPassword);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Top Header with Back Button */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => {
            if (step === 'new_password') {
              setStep('otp');
            } else {
              navigation.goBack();
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#292524" />
        </TouchableOpacity>

        {/* Step Badge */}
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>
            {step === 'otp' ? tLocal.step1Badge : tLocal.step2Badge}
          </Text>
        </View>
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
              source={
                step === 'otp'
                  ? require('../../../assets/images/avatar_peeking_cropped.png')
                  : require('../../../assets/images/avatar_success.png')
              }
              style={styles.mascotImage}
              resizeMode="contain"
            />
          </View>

          {/* STEP 1: OTP Input View */}
          {step === 'otp' ? (
            <View style={styles.formCard}>
              <Text style={styles.title}>{tLocal.otpTitle}</Text>
              <Text style={styles.subtitle}>
                {tLocal.otpSubtitlePre}
                <Text style={styles.emailHighlight}>{email}</Text>
                {tLocal.otpSubtitlePost}
              </Text>

              {/* OTP PIN Input Section */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{tLocal.otpLabel}</Text>
                <TextInput
                  ref={inputRef}
                  style={styles.hiddenInput}
                  value={pin}
                  onChangeText={(text) => {
                    setPin(text);
                    if (pinError) setPinError('');
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  onFocus={() => setIsPinFocused(true)}
                  onBlur={() => setIsPinFocused(false)}
                  caretHidden
                />
                <Pressable style={styles.otpContainer} onPress={() => inputRef.current?.focus()}>
                  {Array.from({ length: 6 }).map((_, index) => {
                    const char = pin[index] || '';
                    const isCurrent = pin.length === index;
                    const isActive = isPinFocused && isCurrent;

                    return (
                      <View 
                        key={index} 
                        style={[
                          styles.otpBox, 
                          isActive && styles.otpBoxActive,
                          char !== '' && styles.otpBoxFilled,
                          !!pinError && styles.otpBoxError
                        ]}
                      >
                        <Text style={styles.otpText}>{char}</Text>
                        {isActive && <View style={styles.cursor} />}
                      </View>
                    );
                  })}
                </Pressable>
                {!!pinError && <Text style={styles.errorText}>{pinError}</Text>}
              </View>

              {/* Verify OTP Button */}
              <TouchableOpacity 
                style={styles.primary3DButton} 
                onPress={handleVerifyOtp} 
                disabled={loading}
                activeOpacity={0.9}
              >
                <View style={styles.primary3DButtonInner}>
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <View style={styles.buttonContent}>
                      <Text style={styles.primaryButtonText}>{tLocal.verifyOtpBtn}</Text>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" style={{ marginLeft: 8 }} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              {/* Footer Resend */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>{tLocal.didNotReceive}</Text>
                <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
                  <Text style={styles.footerLink}>{tLocal.resendLink}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* STEP 2: New Password View */
            <View style={styles.formCard}>
              <Text style={styles.title}>{tLocal.newPasswordTitle}</Text>
              <Text style={styles.subtitle}>{tLocal.newPasswordSubtitle}</Text>

              {/* New Password field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{tLocal.newPasswordLabel}</Text>
                <View style={[
                  styles.inputContainer,
                  focusedField === 'newPassword' && styles.inputContainerFocused,
                  !!passwordError && styles.inputContainerError
                ]}>
                  <Ionicons 
                    name="lock-closed-outline" 
                    size={20} 
                    color={passwordError ? '#C4704A' : (focusedField === 'newPassword' ? '#6B8F5E' : '#78716C')} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={tLocal.newPasswordPlaceholder}
                    placeholderTextColor="#78716C"
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    value={newPassword}
                    onChangeText={(text) => {
                      setNewPassword(text);
                      if (passwordError) validatePassword(text);
                      if (confirmError) validateConfirm(confirmPassword, text);
                    }}
                    onFocus={() => setFocusedField('newPassword')}
                    onBlur={() => setFocusedField(null)}
                    onEndEditing={(e) => validatePassword(e.nativeEvent.text)}
                  />
                  <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeIcon}>
                    <Ionicons name={showNewPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#78716C" />
                  </TouchableOpacity>
                </View>
                {!!passwordError && <Text style={styles.errorText}>{passwordError}</Text>}

                {/* Password Strength Indicator */}
                {focusedField === 'newPassword' && newPassword.length > 0 && (
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
                    <View style={styles.requirementsList}>
                      <View style={styles.requirementRow}>
                        <Ionicons 
                          name={newPassword.length >= 6 ? "checkmark-circle" : "ellipse-outline"} 
                          size={14} 
                          color={newPassword.length >= 6 ? "#6B8F5E" : "#78716C"} 
                        />
                        <Text style={[styles.requirementText, newPassword.length >= 6 && styles.requirementTextActive]}>
                          {tLocal.reqLength}
                        </Text>
                      </View>
                      <View style={styles.requirementRow}>
                        <Ionicons 
                          name={(pass => /[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass))(newPassword) ? "checkmark-circle" : "ellipse-outline"} 
                          size={14} 
                          color={(pass => /[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass))(newPassword) ? "#6B8F5E" : "#78716C"} 
                        />
                        <Text style={[
                          styles.requirementText, 
                          (pass => /[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass))(newPassword) && styles.requirementTextActive
                        ]}>
                          {tLocal.reqNumberSymbol}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* Confirm New Password field */}
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
                    placeholder={tLocal.confirmPasswordPlaceholder}
                    placeholderTextColor="#78716C"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (confirmError) validateConfirm(text, newPassword);
                    }}
                    onFocus={() => setFocusedField('confirm')}
                    onBlur={() => setFocusedField(null)}
                    onEndEditing={(e) => validateConfirm(e.nativeEvent.text, newPassword)}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                    <Ionicons name={showConfirmPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#78716C" />
                  </TouchableOpacity>
                </View>
                {!!confirmError && <Text style={styles.errorText}>{confirmError}</Text>}
              </View>

              {/* Update Password Tactile 3D Button */}
              <TouchableOpacity 
                style={styles.primary3DButton} 
                onPress={handleUpdatePassword} 
                disabled={loading}
                activeOpacity={0.9}
              >
                <View style={styles.primary3DButtonInner}>
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <View style={styles.buttonContent}>
                      <Text style={styles.primaryButtonText}>{tLocal.resetBtn}</Text>
                      <Ionicons name="key-outline" size={18} color="#FFF" style={{ marginLeft: 8 }} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  stepBadge: {
    backgroundColor: 'rgba(107, 143, 94, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(107, 143, 94, 0.25)',
  },
  stepBadgeText: {
    fontFamily: 'System',
    fontSize: 10,
    fontWeight: '800',
    color: '#4A6341',
    letterSpacing: 0.5,
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
  },
  emailHighlight: {
    color: '#292524',
    fontWeight: '800',
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#78716C',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
    marginVertical: 4,
    width: '100%',
  },
  otpBox: {
    width: 44,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  otpBoxActive: {
    borderColor: '#6B8F5E',
    backgroundColor: '#FFFFFF',
  },
  otpBoxFilled: {
    borderColor: '#4A6341',
    backgroundColor: '#F5F8F5',
  },
  otpBoxError: {
    borderColor: '#C4704A',
    backgroundColor: '#FFFDFD',
  },
  otpText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#292524',
  },
  cursor: {
    position: 'absolute',
    width: 2,
    height: 18,
    backgroundColor: '#6B8F5E',
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
  primary3DButton: {
    backgroundColor: '#4A6341',
    borderRadius: 20,
    height: 54,
    marginTop: 10,
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
    marginTop: 20,
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
