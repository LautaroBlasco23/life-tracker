import { describe, expect, it } from 'vitest';
import { themeColors, type ThemeMode } from './theme-colors';

// theme-colors.ts is the cross-platform token contract (see styles.md):
// web CSS vars and mobile tailwind.config.js are derived from it, so any
// key drift between modes or an invalid color breaks both apps at once.
// WCAG AA contrast for critical foreground/background pairs is enforced
// below so palette edits can never silently break readability.

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

// --- WCAG 2.x contrast -----------------------------------------------------

function luminance(hex: string): number {
  const channels = [0, 2, 4].map((i) =>
    parseInt(hex.slice(1 + i, 3 + i), 16) / 255
  );
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg: string, bg: string): number {
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** [fgToken, bgToken, minRatio] — WCAG AA: 4.5:1 normal text, 3:1 large text/UI. */
const AA_PAIRS: Array<[keyof typeof themeColors.light, keyof typeof themeColors.light, number]> = [
  // Body text on every surface level.
  ['foreground', 'background', 4.5],
  ['foreground', 'surface', 4.5],
  ['foreground', 'surfaceElevated', 4.5],
  // Supporting text on every surface level.
  ['textMuted', 'background', 4.5],
  ['textMuted', 'surface', 4.5],
  ['textMuted', 'surfaceElevated', 4.5],
  // Button/label text on the primary accent.
  ['primaryForeground', 'primary', 4.5],
  ['secondaryForeground', 'secondary', 4.5],
  // Semantic colors used as text on surfaces (with icon/label reinforcement).
  ['danger', 'surface', 4.5],
  ['success', 'surface', 4.5],
  ['warning', 'surface', 4.5],
  ['danger', 'background', 4.5],
  ['success', 'background', 4.5],
  ['warning', 'background', 4.5],
  // Large text / UI components on the primary accent.
  ['foreground', 'accent', 3],
];

// Amber (secondary) is highlight-only: as text or a standalone UI fill on
// light surfaces it sits below 3:1 by design (see the comment in
// theme-colors.ts). Enforce the rule that keeps it readable: the dark ink
// token must pass AA when placed on an amber fill in each mode.
const HIGHLIGHT_INK: Record<ThemeMode, keyof typeof themeColors.light> = {
  light: 'foreground', // #30372F on light amber
  dark: 'background', // #1C1D19 on dark-mode amber
};

describe('themeColors WCAG AA contrast', () => {
  it.each(['light', 'dark'] as ThemeMode[])(
    '%s mode meets AA for required pairs',
    (mode) => {
      for (const [fg, bg, min] of AA_PAIRS) {
        const ratio = contrastRatio(themeColors[mode][fg], themeColors[mode][bg]);
        expect(
          ratio,
          `${mode}: ${fg} on ${bg} must be ≥ ${min}:1`
        ).toBeGreaterThanOrEqual(min);
      }
    }
  );

  it.each(['light', 'dark'] as ThemeMode[])(
    '%s mode keeps text readable on amber highlights',
    (mode) => {
      const ink = HIGHLIGHT_INK[mode];
      const ratio = contrastRatio(themeColors[mode][ink], themeColors[mode].secondary);
      expect(
        ratio,
        `${mode}: ${ink} on secondary must be ≥ 4.5:1`
      ).toBeGreaterThanOrEqual(4.5);
    }
  );
});
