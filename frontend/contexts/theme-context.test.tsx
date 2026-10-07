import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider, useTheme } from '@/contexts/theme-context';
import { themeColors } from '@shared/lib/theme-colors';

function wrapper({ children }: PropsWithChildren) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.style.cssText = '';
  document.documentElement.className = '';
});

describe('ThemeProvider / useTheme', () => {
  it('defaults to dark and applies its tokens as CSS variables', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark');

    for (const [key, value] of Object.entries(themeColors.dark)) {
      const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      expect(document.documentElement.style.getPropertyValue(cssVar)).toBe(
        value
      );
    }
  });

  it('persists the theme and restores it on next mount', () => {
    const first = renderHook(() => useTheme(), { wrapper });
    act(() => first.result.current.setTheme('light'));
    expect(localStorage.getItem('theme')).toBe('light');

    const second = renderHook(() => useTheme(), { wrapper });
    expect(second.result.current.theme).toBe('light');
  });

  it('toggles between modes and updates the dark class', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
