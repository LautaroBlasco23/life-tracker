import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { storage, type ThemeMode, type ThemePreference } from '@shared';

interface ThemeContextType {
  /** Resolved mode actually applied ('system' preference resolves to the OS scheme). */
  theme: ThemeMode;
  /** Persisted preference: 'light' | 'dark' | 'system'. */
  preference: ThemePreference;
  toggleTheme: () => void;
  setTheme: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  // RN's useColorScheme is reactive; null means "not yet determined".
  const systemScheme = useColorScheme();

  useEffect(() => {
    const saved = storage.getItem('theme') as ThemePreference | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      setPreferenceState(saved);
    }
  }, []);

  const theme: ThemeMode =
    preference === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : preference;

  useEffect(() => {
    // Drives NativeWind `dark:` variants and RN system chrome. Passing
    // 'unspecified' resets to the OS setting (the 'system' preference).
    Appearance.setColorScheme(
      preference === 'system' ? 'unspecified' : preference
    );
    storage.setItem('theme', preference);
  }, [preference]);

  const setTheme = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
  }, []);

  const toggleTheme = useCallback(
    () => setTheme(theme === 'light' ? 'dark' : 'light'),
    [theme, setTheme]
  );

  const value = useMemo(
    () => ({ theme, preference, toggleTheme, setTheme }),
    [theme, preference, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
