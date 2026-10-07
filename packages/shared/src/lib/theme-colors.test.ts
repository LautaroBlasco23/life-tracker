import { describe, expect, it } from 'vitest';
import { themeColors, type ThemeMode } from './theme-colors';

// theme-colors.ts is the cross-platform token contract (see styles.md):
// web CSS vars and mobile tailwind.config.js are derived from it, so any
// key drift between modes or an invalid color breaks both apps at once.

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

describe('themeColors contract', () => {
  it('has exactly the two supported modes', () => {
    expect(Object.keys(themeColors).sort()).toEqual(['dark', 'light']);
  });

  it.each(['light', 'dark'] as ThemeMode[])(
    '%s mode uses the same token keys',
    (mode) => {
      const keys = Object.keys(themeColors[mode]).sort();
      expect(keys).toEqual(
        Object.keys(themeColors.light).sort()
      );
      expect(keys.length).toBeGreaterThan(0);
    }
  );

  it.each(['light', 'dark'] as ThemeMode[])(
    '%s mode values are valid hex colors',
    (mode) => {
      for (const [token, value] of Object.entries(themeColors[mode])) {
        expect(value, `${mode}.${token}`).toMatch(HEX);
      }
    }
  );

  it('has distinct light and dark palettes', () => {
    expect(themeColors.light.background).not.toBe(themeColors.dark.background);
    expect(themeColors.light.foreground).not.toBe(themeColors.dark.foreground);
  });
});
