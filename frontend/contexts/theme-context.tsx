'use client';

import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ThemeMode, ThemePreference } from '@shared/lib/theme-colors';

const STORAGE_KEY = 'theme';

interface ThemeContextType {
  /** Resolved mode actually applied ('system' preference resolves to the OS scheme). */
  theme: ThemeMode;
  /** Persisted preference: 'light' | 'dark' | 'system'. */
  preference: ThemePreference;
  toggleTheme: () => void;
  setTheme: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemScheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initial render matches the pre-paint script in app/layout.tsx: light
  // unless the system prefers dark, until the stored preference is loaded.
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [systemScheme, setSystemScheme] = useState<ThemeMode>('light');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      setPreferenceState(saved);
    }
  }, []);

  // Track the OS color scheme so the 'system' preference resolves live.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemScheme(getSystemScheme());
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const theme = preference === 'system' ? systemScheme : preference;

  // The static palette in app/globals.css already matches the tokens; the
  // class toggle is the only runtime theming needed.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, preference);
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
