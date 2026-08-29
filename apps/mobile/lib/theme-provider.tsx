import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import { storage, type ThemeMode } from '@shared';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    const saved = storage.getItem('theme') as ThemeMode | null;
    if (saved === 'light' || saved === 'dark') {
      setThemeState(saved);
    }
  }, []);

  useEffect(() => {
    // Drives NativeWind `dark:` variants and RN system chrome.
    Appearance.setColorScheme(theme);
    storage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
