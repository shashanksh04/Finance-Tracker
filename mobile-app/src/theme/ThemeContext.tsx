import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as lightColors, spacing, radius, fontSize, fontWeight, shadow } from './tokens';
import { darkColors } from './dark';

const THEME_KEY = 'finance_tracker_theme';

interface ThemeValue {
  isDark: boolean;
  colors: typeof lightColors;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  shadow: typeof shadow;
  toggleTheme: () => void;
  setDark: (dark: boolean) => void;
}

const ThemeContext = createContext<ThemeValue>({
  isDark: false,
  colors: lightColors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  shadow,
  toggleTheme: () => {},
  setDark: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === 'dark') setIsDark(true);
      setLoaded(true);
    });
  }, []);

  const value = useMemo(() => ({
    isDark,
    colors: isDark ? darkColors : lightColors,
    spacing,
    radius,
    fontSize,
    fontWeight,
    shadow,
    toggleTheme: () => {
      setIsDark((prev) => {
        const next = !prev;
        AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
        return next;
      });
    },
    setDark: (dark: boolean) => {
      setIsDark(dark);
      AsyncStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    },
  }), [isDark]);

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
