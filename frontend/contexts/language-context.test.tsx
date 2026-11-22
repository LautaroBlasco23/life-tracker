import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  LanguageProvider,
  useLanguage,
  useTranslations,
} from '@shared/contexts/language-context';

// The shared language context is consumed from source via @shared; jsdom
// localStorage backs the storage adapter so persistence is observable.
// vitest.config.ts pins react to the frontend copy so the shared source and
// the renderer share one module instance (hook dispatch requires it).

function wrapper({ children }: PropsWithChildren) {
  return <LanguageProvider>{children}</LanguageProvider>;
}

beforeEach(() => {
  localStorage.clear();
});

describe('LanguageProvider / useLanguage', () => {
  it('defaults to English', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.locale).toBe('en');
  });

  it('persists a language switch to localStorage', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    act(() => result.current.setLocale('es'));

    expect(result.current.locale).toBe('es');
    expect(localStorage.getItem('locale')).toBe('es');
  });

  it('restores the saved locale on mount', async () => {
    localStorage.setItem('locale', 'es');

    const { result } = renderHook(() => useLanguage(), { wrapper });

    await waitFor(() => expect(result.current.locale).toBe('es'));
  });

  it('ignores invalid saved locales', async () => {
    localStorage.setItem('locale', 'fr');

    const { result } = renderHook(() => useLanguage(), { wrapper });

    await waitFor(() => expect(result.current.locale).toBe('en'));
  });
});

describe('useTranslations', () => {
  it('returns the English message for a known key', () => {
    const { result } = renderHook(() => useTranslations('auth'), { wrapper });

    expect(result.current('signIn')).toBe('Sign in');
  });

  it('switches languages with the provider locale', async () => {
    localStorage.setItem('locale', 'es');
    const { result } = renderHook(() => useTranslations('auth'), { wrapper });

    await waitFor(() =>
      expect(result.current('signIn')).toBe('Iniciar sesión')
    );
  });

  it('interpolates variables into the message', () => {
    const onboarding = renderHook(() => useTranslations('onboarding'), {
      wrapper,
    });

    expect(onboarding.result.current('welcome_title', { name: 'Ada' })).toBe(
      'Welcome to Life Tracker, Ada!'
    );
  });

  it('replaces every occurrence of each variable', () => {
    const onboarding = renderHook(() => useTranslations('onboarding'), {
      wrapper,
    });

    expect(
      onboarding.result.current('creating_done_description', {
        activities: 3,
        bills: 2,
      })
    ).toBe('3 activities and 2 bills created.');
  });

  it('falls back to the raw key for unknown messages', () => {
    const activities = renderHook(() => useTranslations('activities'), {
      wrapper,
    });

    // Day names have no message entries; the key itself is the fallback.
    expect(activities.result.current('monday')).toBe('monday');
  });
});
