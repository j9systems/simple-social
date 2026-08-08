import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

export type Palette = {
  bg: string;
  surface: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  chip: string;
  accent: string;
  accentDeep: string;
  gradient: [string, string];
  isDark: boolean;
};

export const darkPalette: Palette = {
  bg: '#161826',
  surface: '#232532',
  ink: '#e9e9ed',
  ink2: '#9a9caf',
  ink3: '#6c6e80',
  line: 'rgba(233,233,237,0.1)',
  chip: '#2a2c3a',
  accent: '#9184d9',
  accentDeep: '#b8afe8',
  gradient: ['#9d90e2', '#7263c9'],
  isDark: true,
};

export const lightPalette: Palette = {
  bg: '#f2f2f7',
  surface: '#ffffff',
  ink: '#1d1e2a',
  ink2: '#5d5f70',
  ink3: '#8f91a2',
  line: 'rgba(29,30,42,0.1)',
  chip: '#e7e7ef',
  accent: '#695cc4',
  accentDeep: '#5245a8',
  gradient: ['#7a6cd0', '#584aa8'],
  isDark: false,
};

type ThemeContextValue = {
  theme: Palette;
  mode: 'light' | 'dark';
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: darkPalette,
  mode: 'dark',
  toggle: () => {},
});

const STORAGE_KEY = 'simple-social.theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') setMode(saved);
      else setMode(system === 'light' ? 'light' : 'dark');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolved = mode ?? (system === 'light' ? 'light' : 'dark');

  const toggle = () => {
    const next = resolved === 'dark' ? 'light' : 'dark';
    setMode(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  return (
    <ThemeContext.Provider
      value={{ theme: resolved === 'dark' ? darkPalette : lightPalette, mode: resolved, toggle }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
