import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const lightColors = {
  background: '#FFFFFF',
  card: '#FFFFFF',
  text: '#3C3C3C',
  secondaryText: '#777777',
  border: '#E5E5E5',
  tabBarBg: '#FFFFFF',
  brandGreen: '#6B8F5E',
  brandGreenDark: '#4A6341',
  accent: '#C4704A',
  accentDark: '#9C5232',
  inputBg: '#F7F7F7',
};

export const darkColors = {
  background: '#131F24',
  card: '#1F2E35',
  text: '#FFFFFF',
  secondaryText: '#AFBCC2',
  border: '#37464F',
  tabBarBg: '#1F2E35',
  brandGreen: '#6B8F5E',
  brandGreenDark: '#4A6341',
  accent: '#C4704A',
  accentDark: '#9C5232',
  inputBg: '#152025',
};

type ThemeColors = typeof lightColors;

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Load theme preference on mount
    AsyncStorage.getItem('theme_mode').then((savedTheme) => {
      if (savedTheme === 'dark') {
        setIsDarkMode(true);
      }
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => {
      const newMode = !prev;
      AsyncStorage.setItem('theme_mode', newMode ? 'dark' : 'light');
      return newMode;
    });
  }, []);

  const colors = isDarkMode ? darkColors : lightColors;

  const value = useMemo(() => ({
    isDarkMode,
    toggleTheme,
    colors
  }), [isDarkMode, toggleTheme, colors]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
