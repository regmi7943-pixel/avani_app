import React, { useEffect, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Keyboard,
  Platform,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/ThemeContext';
import { useLanguage } from '../lib/LanguageContext';

const ICON_SIZE = 24;

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface TabIconConfig {
  active: IoniconsName;
  inactive: IoniconsName;
  labelEn: string;
  labelNe: string;
}

const TAB_CONFIG: Record<string, TabIconConfig> = {
  Home: { active: 'home', inactive: 'home-outline', labelEn: 'Home', labelNe: 'गृह' },
  'AI Assistant': { active: 'chatbubble-ellipses', inactive: 'chatbubble-ellipses-outline', labelEn: 'Assistant', labelNe: 'सहायक' },
  Scan: { active: 'scan', inactive: 'scan-outline', labelEn: 'Scan', labelNe: 'स्क्यान' },
  Tutorial: { active: 'play-circle', inactive: 'play-circle-outline', labelEn: 'Tutorial', labelNe: 'ट्युटोरियल' },
  Marketplace: { active: 'storefront', inactive: 'storefront-outline', labelEn: 'Market', labelNe: 'बजार' },
  Settings: { active: 'settings', inactive: 'settings-outline', labelEn: 'Settings', labelNe: 'सेटिङ्स' },
};

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, isDarkMode } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom || 0;
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  if (keyboardVisible) {
    return null;
  }

  const containerHeight = 64 + bottomInset;

  return (
    <View 
      style={[
        styles.container, 
        { 
          height: containerHeight, 
          paddingBottom: bottomInset,
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.border,
        }
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = route.name;
        const isFocused = state.index === index;
        const config = TAB_CONFIG[label] || { 
          active: 'help-circle', 
          inactive: 'help-circle-outline', 
          labelEn: label,
          labelNe: label
        };

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={0.7}
            style={styles.tabItem}
          >
            {/* Top Border Active Indicator */}
            {isFocused && (
              <View 
                style={[
                  styles.activeIndicator, 
                  { backgroundColor: colors.brandGreen }
                ]} 
              />
            )}
            
            <View style={styles.iconContainer}>
              <Ionicons 
                name={isFocused ? config.active : config.inactive} 
                size={ICON_SIZE} 
                color={isFocused ? colors.brandGreen : colors.secondaryText} 
              />
              <Text 
                style={[
                  styles.tabLabel, 
                  { 
                    color: isFocused ? colors.brandGreen : colors.secondaryText,
                    fontWeight: isFocused ? '800' : '600'
                  }
                ]}
              >
                {language === 'ne' ? config.labelNe : config.labelEn}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 2,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  activeIndicator: {
    position: 'absolute',
    top: -2,
    width: '50%',
    height: 4,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 3,
    fontFamily: 'System',
  },
});
