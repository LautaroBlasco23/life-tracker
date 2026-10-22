import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider, useTheme } from '@/contexts/theme-context';

// matchMedia is stubbed globally in test/setup.ts; system scheme is driven
// via window.__systemPrefersDark + window.__matchMediaListeners.

function wrapper({ children }: PropsWithChildren) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  window.__systemPrefersDark = false;
});

describe('ThemeProvider / useTheme', () => {
  it("resolves the default 'system' preference to the OS scheme", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.preference).toBe('system');
    expect(result.current.theme).toBe('light'); // mocked system is light
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('resolves system preference to dark when the OS prefers dark', () => {
    window.__systemPrefersDark = true;
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('re-resolves when the OS scheme changes while on system', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => {
      window.__systemPrefersDark = true;
      window.__matchMediaListeners!.forEach((cb) => cb());
    });
    expect(result.current.theme).toBe('dark');
  });

  it("persists the preference and restores it, including 'system'", () => {
    const first = renderHook(() => useTheme(), { wrapper });
    act(() => first.result.current.setTheme('light'));
    expect(localStorage.getItem('theme')).toBe('light');

    const second = renderHook(() => useTheme(), { wrapper });
    expect(second.result.current.preference).toBe('light');
    expect(second.result.current.theme).toBe('light');

    act(() => second.result.current.setTheme('system'));
    expect(localStorage.getItem('theme')).toBe('system');
  });

  it('toggles between modes and updates the dark class', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
