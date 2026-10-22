import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { themeColors, type ThemeMode } from '@shared/lib/theme-colors';

// app/globals.css must stay in exact hex parity with the shared token
// source of truth (packages/shared/src/lib/theme-colors.ts). The class-based
// theme system relies on this: the CSS palette IS the runtime palette, so
// drift here would silently ship wrong colors before hydration.

const css = readFileSync(
  path.resolve(process.cwd(), 'app/globals.css'),
  'utf8'
);

// Canonical shared tokens, camelCase -> kebab-case CSS var names.
const TOKEN_VARS: Array<[keyof typeof themeColors.light, string]> = [
  ['background', '--background'],
  ['surface', '--surface'],
  ['surfaceElevated', '--surface-elevated'],
  ['foreground', '--foreground'],
  ['textMuted', '--text-muted'],
  ['primary', '--primary'],
  ['primaryForeground', '--primary-foreground'],
  ['secondary', '--secondary'],
  ['secondaryForeground', '--secondary-foreground'],
  ['accent', '--accent'],
  ['danger', '--danger'],
  ['success', '--success'],
  ['warning', '--warning'],
  ['border', '--border'],
  ['sticky', '--sticky'],
];

function extractBlock(selector: string): string {
  const match = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`globals.css has no ${selector} block`);
  return match[1];
}

describe('globals.css palette parity with theme-colors.ts', () => {
  it.each(['light', 'dark'] as ThemeMode[])(
    '%s mode defines every shared token with the exact same hex value',
    (mode) => {
      const block = extractBlock(
        mode === 'light' ? ':root' : String.raw`\.dark`
      );
      for (const [token, cssVar] of TOKEN_VARS) {
        const value = themeColors[mode][token];
        const re = new RegExp(`${cssVar}:\\s*${value}\\s*;`);
        expect(
          re.test(block),
          `${cssVar} should be ${value} in ${mode} mode`
        ).toBe(true);
      }
    }
  );
});
