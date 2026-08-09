'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import type React from 'react';
import en from '@/messages/en.json';
import es from '@/messages/es.json';

export type Locale = 'en' | 'es';

type Messages = typeof en;
type Namespace = keyof Messages;
type NamespaceMessages = Messages[Namespace];

const allMessages: Record<Locale, Messages> = { en, es };

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: 'en',
  setLocale: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const saved = localStorage.getItem('locale') as Locale | null;
    if (saved === 'en' || saved === 'es') {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
  }, []);

  return (
    <LanguageContext.Provider value={{ locale, setLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useTranslations(namespace: Namespace) {
  const { locale } = useLanguage();
  const ns = allMessages[locale][namespace] as NamespaceMessages;

  return useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let str = (ns as Record<string, string>)[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return str;
    },
    [ns]
  );
}
