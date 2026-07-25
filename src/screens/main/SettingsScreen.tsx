import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  Switch, 
  ActivityIndicator, 
  Modal, 
  TextInput, 
  ScrollView, 
  Platform,
  useWindowDimensions,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/ThemeContext';
import { useLanguage } from '../../lib/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { triggerManualWeatherAlertTest } from '../../services/weatherAlertService';
import { uploadImageToCloudinary } from '../../lib/cloudinary';
import OrderTrackingModal from '../../components/OrderTrackingModal';
import CartModal from '../../components/CartModal';

interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  location: string | null;
  avatar_url: string | null;
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface SettingRowProps {
  icon: IoniconsName;
  iconBg: string;
  label: string;
  value?: string;
  badge?: string;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
  showDivider?: boolean;
  onPress?: () => void;
  textColor: string;
  secondaryTextColor: string;
  dividerColor: string;
}

const SettingRow: React.FC<SettingRowProps> = ({
  icon,
  iconBg,
  label,
  value,
  badge,
  showChevron = false,
  rightElement,
  showDivider = true,
  onPress,
  textColor,
  secondaryTextColor,
  dividerColor,
}) => {
  const content = (
    <View>
      <View style={rowStyles.row}>
        <View style={[rowStyles.iconCircle, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={18} color="#FFFFFF" />
        </View>
        <Text style={[rowStyles.label, { color: textColor }]}>{label}</Text>
        <View style={rowStyles.rightSide}>
          {rightElement}
          {value && (
            <Text style={[rowStyles.value, { color: secondaryTextColor }]}>{value}</Text>
          )}
          {badge && (
            <View style={rowStyles.badge}>
              <Text style={rowStyles.badgeText}>{badge}</Text>
            </View>
          )}
          {showChevron && (
            <Ionicons name="chevron-forward" size={18} color={secondaryTextColor} style={rowStyles.chevron} />
          )}
        </View>
      </View>
      {showDivider && <View style={[rowStyles.divider, { backgroundColor: dividerColor }]} />}
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.6}>{content}</TouchableOpacity>;
  }
  return content;
};

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  rightSide: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    fontSize: 13,
    fontWeight: '400',
    marginRight: 4,
  },
  badge: {
    backgroundColor: '#6B8F5E',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  chevron: {
    marginLeft: 2,
  },
  divider: {
    height: 1,
    marginLeft: 60,
    marginRight: 16,
  },
});

const SettingsScreen = () => {
  const { isDarkMode, toggleTheme, colors } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 600;

  const responsiveOverlayStyle: any = [
    styles.modalOverlay,
    isLargeScreen && { justifyContent: 'center', alignItems: 'center' }
  ];
  
  const responsiveContentStyle = (extraStyles: any = {}): any => [
    styles.modalContent,
    { backgroundColor: colors.card },
    extraStyles,
    isLargeScreen && { width: 500, borderRadius: 24, maxHeight: '80%' }
  ];

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [fieldsCount, setFieldsCount] = useState(0);
  const [units, setUnits] = useState('bigha');

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [location, setLocation] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Change Password Modal State
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Field Logs (Crop History / Soil Reports) Viewer Modal State
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [logsModalType, setLogsModalType] = useState<'crop' | 'soil'>('crop');
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // FAQ Modal State
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(null);

  // Bug Report Modal State
  const [bugModalVisible, setBugModalVisible] = useState(false);
  const [bugTitle, setBugTitle] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [submittingBug, setSubmittingBug] = useState(false);

  // App Rating Modal State
  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [rating, setRating] = useState(5);

  // Notification toggle (local UI state)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Order Tracking & Cart Modals
  const [orderTrackingVisible, setOrderTrackingVisible] = useState(false);
  const [cartModalVisible, setCartModalVisible] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (user) {
        setEmail(user.email || '');
        
        // Fetch profile
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data) {
          setProfile(data);
          setFullName(data.full_name || '');
          setUsername(data.username || '');
          setLocation(data.location || '');
          setAvatarUrl(data.avatar_url || null);
        } else {
          // If no profile exists, let's create a default one for them
          const defaultProfile = {
            id: user.id,
            username: user.email?.split('@')[0] || 'farmer',
            full_name: 'Farming Expert',
            location: 'Madi, Chitwan',
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          };

          const { data: insertedData, error: insertError } = await supabase
            .from('profiles')
            .insert([defaultProfile])
            .select()
            .single();

          if (insertError) throw insertError;
          if (insertedData) {
            setProfile(insertedData);
            setFullName(insertedData.full_name || '');
            setUsername(insertedData.username || '');
            setLocation(insertedData.location || '');
            setAvatarUrl(insertedData.avatar_url || null);
          }
        }

        // Fetch dynamic fields count
        const { count, error: countError } = await supabase
          .from('fields')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (!countError && count !== null) {
          setFieldsCount(count);
        }
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUnitsPreference = async () => {
    try {
      const savedUnits = await AsyncStorage.getItem('user_units');
      if (savedUnits) {
        setUnits(savedUnits);
      }
    } catch (err) {
      console.warn('Failed to load units preference:', err);
    }
  };

  const toggleUnitsPreference = async () => {
    const nextUnits = units === 'bigha' ? 'acres' : 'bigha';
    setUnits(nextUnits);
    try {
      await AsyncStorage.setItem('user_units', nextUnits);
    } catch (err) {
      console.warn('Failed to save units preference:', err);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert(t('settings.error'), t('settings.passwordMinLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('settings.error'), t('settings.passwordsDoNotMatch'));
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert(t('settings.success'), t('settings.passwordUpdatedSuccess'));
      setChangePasswordModalVisible(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      Alert.alert(t('settings.error'), err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const openLogsModal = async (type: 'crop' | 'soil') => {
    setLogsModalType(type);
    setLogsModalVisible(true);
    setLoadingLogs(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data, error } = await supabase
        .from('field_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('type', type)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (e) {
      console.warn('Error fetching field logs:', e);
      // Fallback mocks
      setLogs([
        {
          id: 'log-1',
          title: type === 'crop' ? '🌾 Sowing Rice Seeds' : '🧪 N-P-K Soil Analysis',
          description: type === 'crop' 
            ? 'Completed seeding of the main nursery bed block. Soil moisture is optimal at 42%.'
            : 'Soil test indicates slightly low nitrogen levels. Recommended top-dress of urea booster.',
          created_at: new Date().toISOString(),
          severity: 'normal'
        }
      ]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const [testingAlerts, setTestingAlerts] = useState(false);

  const handleTestWeatherAlerts = async () => {
    setTestingAlerts(true);
    try {
      await triggerManualWeatherAlertTest(language);
      Alert.alert('Alert Processed', 'AI analyzed crop conditions and processed dynamic weather alerts!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to trigger alerts.');
    } finally {
      setTestingAlerts(false);
    }
  };

  const handleSubmitBug = async () => {
    if (!bugTitle.trim() || !bugDescription.trim()) {
      Alert.alert(t('settings.error'), 'Please fill in both title and description.');
      return;
    }
    setSubmittingBug(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from('field_logs').insert({
          user_id: session.user.id,
          title: `Bug Report: ${bugTitle.trim()}`,
          description: bugDescription.trim(),
          type: 'bug',
          severity: 'critical'
        });
      }
      Alert.alert('Thank you!', 'Bug report submitted successfully.');
      setBugModalVisible(false);
      setBugTitle('');
      setBugDescription('');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmittingBug(false);
    }
  };

  const handleRatingSubmit = () => {
    Alert.alert('Thank you!', t('settings.ratingFeedback'));
    setRateModalVisible(false);
  };

  useEffect(() => {
    fetchProfile();
    loadUnitsPreference();
  }, []);

  const handleUpdateProfile = async () => {
    if (!profile) return;
    
    setSaving(true);
    try {
      const updatedProfile = {
        full_name: fullName.trim(),
        username: username.trim(),
        location: location.trim(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('profiles')
        .update(updatedProfile)
        .eq('id', profile.id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setProfile(data);
        setEditModalVisible(false);
        Alert.alert(t('settings.success'), t('settings.profileUpdatedSuccess'));
      }
    } catch (error: any) {
      Alert.alert(t('settings.errorUpdatingProfile'), error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert(t('settings.errorSigningOut'), error.message);
    }
  };

  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'JD';

  const handlePickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('settings.error'), 'Sorry, we need camera roll permissions to make this work!');
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingAvatar(true);
        const imageUri = result.assets[0].uri;
        const uploadedUrl = await uploadImageToCloudinary(imageUri);
        
        if (uploadedUrl && profile) {
          // Update Supabase profile
          const { error } = await supabase
            .from('profiles')
            .update({ avatar_url: uploadedUrl, updated_at: new Date().toISOString() })
            .eq('id', profile.id);
            
          if (error) throw error;
          
          setAvatarUrl(uploadedUrl);
          Alert.alert(t('settings.success'), 'Profile picture updated successfully!');
        } else {
          throw new Error('Failed to upload image.');
        }
      }
    } catch (error: any) {
      Alert.alert(t('settings.error'), error.message || 'Error updating profile picture');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Icon background tints per section
  const accountIconBg = '#6B8F5E';
  const prefIconBg = '#7A6B8F';
  const farmIconBg = '#4A6B3E';
  const supportIconBg = '#8F7B5E';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandGreen} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Profile Header ── */}
          <View style={[styles.profileHeader, { backgroundColor: colors.background }]}>
            {/* Avatar */}
            <TouchableOpacity style={styles.avatarWrapper} onPress={handlePickAvatar} activeOpacity={0.7}>
              <View style={styles.avatarRing}>
                <View style={[styles.avatarCircle, { backgroundColor: isDarkMode ? '#3A4A38' : '#D5E6D0', overflow: 'hidden' }]}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <Text style={[styles.avatarText, { color: '#6B8F5E' }]}>{initials}</Text>
                  )}
                </View>
              </View>
              <View style={styles.cameraOverlay}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="camera" size={12} color="#FFFFFF" />
                )}
              </View>
            </TouchableOpacity>

            {/* User Info */}
            <Text style={[styles.profileName, { color: colors.text }]}>
              {fullName || 'Avani User'}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.secondaryText }]}>
              {email}
            </Text>
            {(location ? true : false) && (
              <View style={styles.locationRow}>
                <Text style={styles.locationPin}>📍</Text>
                <Text style={[styles.profileLocation, { color: colors.secondaryText }]}>
                  {location}
                </Text>
              </View>
            )}
          </View>

          {/* ── ACCOUNT Section ── */}
          <Text style={[styles.sectionHeader, { color: colors.secondaryText }]}>{t('settings.account')}</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderBottomColor: isDarkMode ? '#1B272E' : '#CDCDCD' }]}>
            <SettingRow
              icon="person-outline"
              iconBg={accountIconBg}
              label={t('settings.editProfile')}
              showChevron
              onPress={() => setEditModalVisible(true)}
              textColor={colors.text}
              secondaryTextColor={colors.secondaryText}
              dividerColor={colors.border}
            />
            <SettingRow
              icon="lock-closed-outline"
              iconBg={accountIconBg}
              label={t('settings.changePassword')}
              showChevron
              onPress={() => setChangePasswordModalVisible(true)}
              textColor={colors.text}
              secondaryTextColor={colors.secondaryText}
              dividerColor={colors.border}
            />
            <SettingRow
              icon="globe-outline"
              iconBg={accountIconBg}
              label={t('settings.language')}
              value={language === 'en' ? 'English' : 'नेपाली'}
              showDivider={false}
              onPress={toggleLanguage}
              textColor={colors.text}
              secondaryTextColor={colors.secondaryText}
              dividerColor={colors.border}
            />
          </View>

          {/* ── PREFERENCES Section ── */}
          <Text style={[styles.sectionHeader, { color: colors.secondaryText }]}>{t('settings.preferences')}</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderBottomColor: isDarkMode ? '#1B272E' : '#CDCDCD' }]}>
            <SettingRow
              icon="moon-outline"
              iconBg={prefIconBg}
              label={t('settings.darkMode')}
              rightElement={
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#D1D1D6', true: '#6B8F5E' }}
                  thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
                />
              }
              textColor={colors.text}
              secondaryTextColor={colors.secondaryText}
              dividerColor={colors.border}
            />
            <SettingRow
              icon="notifications-outline"
              iconBg={prefIconBg}
              label={t('settings.notifications')}
              rightElement={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: '#D1D1D6', true: '#6B8F5E' }}
                  thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
                />
              }
              textColor={colors.text}
              secondaryTextColor={colors.secondaryText}
              dividerColor={colors.border}
            />
            <SettingRow
              icon="resize-outline"
              iconBg={prefIconBg}
              label={t('settings.units')}
              value={units === 'bigha' ? (language === 'en' ? 'Bigha / Kattha' : 'विघा / कठ्ठा') : (language === 'en' ? 'Acres / Hectares' : 'एकड / हेक्टर')}
              showDivider={false}
              onPress={toggleUnitsPreference}
              textColor={colors.text}
              secondaryTextColor={colors.secondaryText}
              dividerColor={colors.border}
            />
          </View>

          {/* ── FARM MANAGEMENT Section ── */}
          <Text style={[styles.sectionHeader, { color: colors.secondaryText }]}>{t('settings.farmManagement')}</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderBottomColor: isDarkMode ? '#1B272E' : '#CDCDCD' }]}>
            <SettingRow
              icon="map-outline"
              iconBg={farmIconBg}
              label={t('settings.myFields')}
              badge={fieldsCount.toString()}
              showChevron
              onPress={() => navigation.navigate('Home')}
              textColor={colors.text}
              secondaryTextColor={colors.secondaryText}
              dividerColor={colors.border}
            />
            <SettingRow
              icon="calendar-outline"
              iconBg={farmIconBg}
              label={t('settings.cropHistory')}
              showChevron
              onPress={() => openLogsModal('crop')}
              textColor={colors.text}
              secondaryTextColor={colors.secondaryText}
              dividerColor={colors.border}
            />
            <SettingRow
              icon="document-text-outline"
              iconBg={farmIconBg}
              label={t('settings.soilReports')}
              showChevron
              showDivider={false}
              onPress={() => openLogsModal('soil')}
              textColor={colors.text}
              secondaryTextColor={colors.secondaryText}
              dividerColor={colors.border}
            />
          </View>

          {/* ── ORDERS & PURCHASES Section ── */}
          <Text style={[styles.sectionHeader, { color: colors.secondaryText }]}>
            {language === 'ne' ? 'अर्डर तथा खरिद' : 'Orders & Purchases'}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderBottomColor: isDarkMode ? '#1B272E' : '#CDCDCD' }]}>
            <SettingRow
              icon="cube-outline"
              iconBg="#2563eb"
              label={language === 'ne' ? 'मेरो अर्डर ट्र्याकिङ' : 'Order Tracking'}
              badge={language === 'ne' ? 'सक्रिय ट्र्याकिङ' : 'Live Tracking'}
              showChevron
              onPress={() => setOrderTrackingVisible(true)}
              textColor={colors.text}
              secondaryTextColor={colors.secondaryText}
              dividerColor={colors.border}
            />
            <SettingRow
              icon="bag-handle-outline"
              iconBg="#059669"
              label={language === 'ne' ? 'खरीद झोला हेर्नुहोस्' : 'View Shopping Cart'}
              showChevron
              showDivider={false}
              onPress={() => setCartModalVisible(true)}
              textColor={colors.text}
              secondaryTextColor={colors.secondaryText}
              dividerColor={colors.border}
            />
          </View>

          {/* ── SUPPORT Section ── */}
          <Text style={[styles.sectionHeader, { color: colors.secondaryText }]}>{t('settings.support')}</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderBottomColor: isDarkMode ? '#1B272E' : '#CDCDCD' }]}>
            <SettingRow
              icon="help-circle-outline"
              iconBg={supportIconBg}
              label={t('settings.help')}
              showChevron
              onPress={() => setHelpModalVisible(true)}
              textColor={colors.text}
              secondaryTextColor={colors.secondaryText}
              dividerColor={colors.border}
            />
            <SettingRow
              icon="bug-outline"
              iconBg={supportIconBg}
              label={t('settings.bug')}
              showChevron
              onPress={() => setBugModalVisible(true)}
              textColor={colors.text}
              secondaryTextColor={colors.secondaryText}
              dividerColor={colors.border}
            />
            <SettingRow
              icon={testingAlerts ? "sync-outline" : "notifications-outline"}
              iconBg={supportIconBg}
              label="Test Weather Alerts"
              value={testingAlerts ? "AI Processing..." : undefined}
              showChevron={!testingAlerts}
              onPress={handleTestWeatherAlerts}
              textColor={colors.text}
              secondaryTextColor={colors.secondaryText}
              dividerColor={colors.border}
            />
            <SettingRow
              icon="star-outline"
              iconBg={supportIconBg}
              label={t('settings.rate')}
              showChevron
              onPress={() => setRateModalVisible(true)}
              textColor={colors.text}
              secondaryTextColor={colors.secondaryText}
              dividerColor={colors.border}
            />
            <SettingRow
              icon="information-circle-outline"
              iconBg={supportIconBg}
              label={t('settings.about')}
              value="v2.1.0"
              showDivider={false}
              textColor={colors.text}
              secondaryTextColor={colors.secondaryText}
              dividerColor={colors.border}
            />
          </View>

          {/* ── Sign Out Button ── */}
          <TouchableOpacity
            style={[
              styles.signOutButton, 
              { 
                backgroundColor: colors.accent, 
                borderColor: colors.accentDark, 
                borderBottomColor: '#7B3D22' 
              }
            ]}
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={[styles.signOutText, { color: '#FFFFFF', fontWeight: '800' }]}>{t('settings.signOut')}</Text>
          </TouchableOpacity>

          {/* ── Footer ── */}
          <Text style={[styles.footerText, { color: colors.secondaryText }]}>
            {t('settings.footerText')}
          </Text>
        </ScrollView>
      )}

      {/* ── Edit Profile Modal ── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={responsiveOverlayStyle}>
          <View style={responsiveContentStyle()}>
            {/* Modal Handle Bar */}
            <View style={styles.modalHandleBar} />

            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('settings.editProfile')}</Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={[styles.modalCloseBtn, { backgroundColor: isDarkMode ? '#3A3A38' : '#F0F0F0' }]}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm}>
              {/* Avatar in modal */}
              <TouchableOpacity style={styles.modalAvatarContainer} onPress={handlePickAvatar} activeOpacity={0.7}>
                <View style={styles.avatarRing}>
                  <View style={[styles.avatarCircle, { backgroundColor: isDarkMode ? '#3A4A38' : '#D5E6D0', overflow: 'hidden' }]}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Text style={[styles.avatarText, { color: '#6B8F5E' }]}>{initials}</Text>
                    )}
                  </View>
                </View>
                <View style={[styles.cameraOverlay, { right: '35%', bottom: 0 }]}>
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="camera" size={12} color="#FFFFFF" />
                  )}
                </View>
              </TouchableOpacity>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.secondaryText }]}>{t('settings.fullName')}</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Ionicons name="person-outline" size={16} color={colors.secondaryText} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder={t('settings.fullNamePlaceholder')}
                    placeholderTextColor={colors.secondaryText}
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.secondaryText }]}>{t('settings.username')}</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Ionicons name="at" size={16} color={colors.secondaryText} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder={t('settings.usernamePlaceholder')}
                    placeholderTextColor={colors.secondaryText}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.secondaryText }]}>{t('settings.location')}</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Ionicons name="location-outline" size={16} color={colors.secondaryText} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder={t('settings.locationPlaceholder')}
                    placeholderTextColor={colors.secondaryText}
                    value={location}
                    onChangeText={setLocation}
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.submitButton, { backgroundColor: '#6B8F5E' }]} 
                onPress={handleUpdateProfile}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>{t('settings.saveChanges')}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditModalVisible(false)}
                activeOpacity={0.6}
              >
                <Text style={[styles.cancelButtonText, { color: colors.secondaryText }]}>{t('settings.cancel')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Change Password Modal ── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={changePasswordModalVisible}
        onRequestClose={() => setChangePasswordModalVisible(false)}
      >
        <View style={responsiveOverlayStyle}>
          <View style={responsiveContentStyle()}>
            <View style={styles.modalHandleBar} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('settings.changePasswordTitle')}</Text>
              <TouchableOpacity
                onPress={() => setChangePasswordModalVisible(false)}
                style={[styles.modalCloseBtn, { backgroundColor: isDarkMode ? '#3A3A38' : '#F0F0F0' }]}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalForm}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.secondaryText }]}>{t('settings.newPassword')}</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed-outline" size={16} color={colors.secondaryText} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.secondaryText}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.secondaryText }]}>{t('settings.confirmPassword')}</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed-outline" size={16} color={colors.secondaryText} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.secondaryText}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.submitButton, { backgroundColor: '#6B8F5E' }]} 
                onPress={handleUpdatePassword}
                disabled={savingPassword}
                activeOpacity={0.8}
              >
                {savingPassword ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>{t('settings.submit')}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Field Logs Viewer Modal (Crop History & Soil Reports) ── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={logsModalVisible}
        onRequestClose={() => setLogsModalVisible(false)}
      >
        <View style={responsiveOverlayStyle}>
          <View style={responsiveContentStyle({ height: '80%' })}>
            <View style={styles.modalHandleBar} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {logsModalType === 'crop' ? t('settings.cropHistoryTitle') : t('settings.soilReportsTitle')}
              </Text>
              <TouchableOpacity
                onPress={() => setLogsModalVisible(false)}
                style={[styles.modalCloseBtn, { backgroundColor: isDarkMode ? '#3A3A38' : '#F0F0F0' }]}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            {loadingLogs ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#6B8F5E" />
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                {logs.length === 0 ? (
                  <View style={{ alignItems: 'center', marginVertical: 40 }}>
                    <Ionicons name="folder-open-outline" size={48} color={colors.secondaryText} style={{ marginBottom: 12 }} />
                    <Text style={{ color: colors.secondaryText, textAlign: 'center', fontSize: 14 }}>
                      {t('settings.noLogsFound')}
                    </Text>
                  </View>
                ) : (
                  logs.map((item, index) => (
                    <View 
                      key={item.id || index} 
                      style={{
                        backgroundColor: isDarkMode ? '#243022' : '#F4F8F3',
                        padding: 16,
                        borderRadius: 14,
                        marginBottom: 12,
                        borderLeftWidth: 4,
                        borderLeftColor: '#6B8F5E',
                        borderWidth: 1,
                        borderColor: colors.border
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontWeight: '700', fontSize: 15, color: colors.text }}>{item.title}</Text>
                        <Text style={{ fontSize: 10, color: colors.secondaryText }}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 13, color: colors.secondaryText, lineHeight: 18 }}>{item.description}</Text>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Help Accordion Modal ── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={helpModalVisible}
        onRequestClose={() => setHelpModalVisible(false)}
      >
        <View style={responsiveOverlayStyle}>
          <View style={responsiveContentStyle({ height: '80%' })}>
            <View style={styles.modalHandleBar} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('settings.faqTitle')}</Text>
              <TouchableOpacity
                onPress={() => setHelpModalVisible(false)}
                style={[styles.modalCloseBtn, { backgroundColor: isDarkMode ? '#3A3A38' : '#F0F0F0' }]}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {[
                {
                  q: language === 'en' ? 'How do I map a new field?' : 'नयाँ खेत कसरी नक्सांकन गर्ने?',
                  a: language === 'en' 
                    ? 'Navigate to the Home tab and scroll down to "My Fields". Click "Add Field" to draw or pin your farm boundary using real GPS coordinates from Google Maps.'
                    : 'गृह ट्याबमा जानुहोस् र "मेरो खेतहरू" मा स्क्रोल गर्नुहोस्। गुगल नक्साको वास्तविक GPS समन्वयहरू प्रयोग गरेर आफ्नो खेतको सिमाना कोर्न वा पिन गर्न "खेत थप्नुहोस्" मा क्लिक गर्नुहोस्।'
                },
                {
                  q: language === 'en' ? 'How does Avaani AI chatbot work?' : 'अवानी एआई च्याटबोटले कसरी काम गर्छ?',
                  a: language === 'en' 
                    ? 'Avaani AI uses Google Gemini, loaded with your soil test database and local weather parameters, to provide personalized agricultural recommendations in English and Nepali.'
                    : 'अवानी एआईले गुगल जेमिनी प्रयोग गर्दछ, जुन माटो परीक्षण डाटाबेस र स्थानीय मौसम प्यारामिटरहरूसँग लोड गरिएको हुन्छ, जसले अंग्रेजी र नेपालीमा व्यक्तिगत कृषि सल्लाहहरू प्रदान गर्दछ।'
                },
                {
                  q: language === 'en' ? 'How do I calibrate my soil sensors?' : 'माटो सेन्सर कसरी क्यालिब्रेट गर्ने?',
                  a: language === 'en' 
                    ? 'Go to Field Details modal, select "Soil Health Sensors" and tap on any gauge (e.g. Moisture or pH) to calibrate your physics thresholds based on loamy or clay contents.'
                    : 'खेत विवरण मोडलमा जानुहोस्, "माटो स्वास्थ्य सेन्सर" चयन गर्नुहोस् र दोमट वा चिम्ट्याइलो सामग्रीहरूको आधारमा आफ्नो भौतिकी क्यालिब्रेसन गर्न कुनै पनि मापक (जस्तै चिस्यान वा pH) मा ट्याप गर्नुहोस्।'
                }
              ].map((faq, idx) => {
                const isOpen = activeFaqIndex === idx;
                return (
                  <View 
                    key={idx}
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      paddingVertical: 14
                    }}
                  >
                    <TouchableOpacity 
                      onPress={() => setActiveFaqIndex(isOpen ? null : idx)}
                      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontWeight: '600', fontSize: 14, color: colors.text, flex: 1, paddingRight: 8 }}>{faq.q}</Text>
                      <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.secondaryText} />
                    </TouchableOpacity>
                    {isOpen && (
                      <Text style={{ color: colors.secondaryText, fontSize: 13, lineHeight: 18, marginTop: 8, paddingLeft: 4 }}>
                        {faq.a}
                      </Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Bug Report Modal ── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={bugModalVisible}
        onRequestClose={() => setBugModalVisible(false)}
      >
        <View style={responsiveOverlayStyle}>
          <View style={responsiveContentStyle()}>
            <View style={styles.modalHandleBar} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('settings.reportBugTitle')}</Text>
              <TouchableOpacity
                onPress={() => setBugModalVisible(false)}
                style={[styles.modalCloseBtn, { backgroundColor: isDarkMode ? '#3A3A38' : '#F0F0F0' }]}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalForm}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.secondaryText }]}>{t('settings.fullName')}</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder={t('settings.bugTitlePlaceholder')}
                    placeholderTextColor={colors.secondaryText}
                    value={bugTitle}
                    onChangeText={setBugTitle}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.secondaryText }]}>{t('settings.about')}</Text>
                <View style={[
                  styles.inputWrapper, 
                  { 
                    backgroundColor: colors.inputBg, 
                    borderColor: colors.border,
                    height: 100,
                    alignItems: 'flex-start',
                    paddingVertical: 8
                  }
                ]}>
                  <TextInput
                    style={[styles.input, { color: colors.text, height: '100%', textAlignVertical: 'top' }]}
                    placeholder={t('settings.bugDescPlaceholder')}
                    placeholderTextColor={colors.secondaryText}
                    value={bugDescription}
                    onChangeText={setBugDescription}
                    multiline
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.submitButton, { backgroundColor: '#6B8F5E' }]} 
                onPress={handleSubmitBug}
                disabled={submittingBug}
                activeOpacity={0.8}
              >
                {submittingBug ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>{t('settings.submit')}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── App Rating Modal ── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={rateModalVisible}
        onRequestClose={() => setRateModalVisible(false)}
      >
        <View style={responsiveOverlayStyle}>
          <View style={responsiveContentStyle()}>
            <View style={styles.modalHandleBar} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('settings.ratingTitle')}</Text>
              <TouchableOpacity
                onPress={() => setRateModalVisible(false)}
                style={[styles.modalCloseBtn, { backgroundColor: isDarkMode ? '#3A3A38' : '#F0F0F0' }]}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={[styles.modalForm, { alignItems: 'center' }]}>
              <Ionicons name="ribbon-outline" size={48} color="#C4704A" style={{ marginBottom: 12 }} />
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 16 }}>
                {language === 'en' ? 'How would you rate Avaani AI?' : 'तपाईं अवानी एआईलाई कसरी मूल्याङ्कन गर्नुहुन्छ?'}
              </Text>
              <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                {[1, 2, 3, 4, 5].map((starValue) => (
                  <TouchableOpacity key={starValue} onPress={() => setRating(starValue)} style={{ paddingHorizontal: 6 }}>
                    <Ionicons 
                      name={starValue <= rating ? "star" : "star-outline"} 
                      size={32} 
                      color={starValue <= rating ? "#C4704A" : colors.secondaryText} 
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity 
                style={[styles.submitButton, { backgroundColor: '#6B8F5E', width: '100%' }]} 
                onPress={handleRatingSubmit}
                activeOpacity={0.8}
              >
                <Text style={styles.submitButtonText}>{t('settings.submit')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Order Tracking & Cart Modals */}
      <OrderTrackingModal 
        visible={orderTrackingVisible} 
        onClose={() => setOrderTrackingVisible(false)} 
      />
      <CartModal 
        visible={cartModalVisible} 
        onClose={() => setCartModalVisible(false)} 
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    paddingBottom: 160,
  },

  /* ── Profile Header ── */
  profileHeader: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 14,
  },
  avatarRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2.5,
    borderColor: '#6B8F5E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6B8F5E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationPin: {
    fontSize: 12,
    marginRight: 3,
  },
  profileLocation: {
    fontSize: 12,
    fontWeight: '500',
  },

  /* ── Section Header ── */
  sectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 24,
  },

  /* ── Card ── */
  card: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderBottomWidth: 4,
    overflow: 'hidden',
  },

  /* ── Sign Out ── */
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderBottomWidth: 5,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
  },

  /* ── Footer ── */
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '400',
    marginTop: 20,
    marginBottom: 8,
  },

  /* ── Modal ── */
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 24,
    maxHeight: '88%',
  },
  modalHandleBar: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D1D6',
    marginTop: 10,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalForm: {
    paddingBottom: 24,
  },
  modalAvatarContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
  },
  submitButton: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#6B8F5E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 10,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default SettingsScreen;
