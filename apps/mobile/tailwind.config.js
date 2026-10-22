/**
 * Tailwind config for the mobile app.
 *
 * Colors are duplicated from packages/shared/src/lib/theme-colors.ts (the
 * single source of truth for light/dark palettes — the WCAG AA contract
 * lives there). Use `dark:` variants for theme switching — the ThemeProvider
 * drives Appearance.setColorScheme.
 */
const light = {
  background: '#F5F2EA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  foreground: '#30372F',
  textMuted: '#6A6C61',
  primary: '#5C6F55',
  secondary: '#D6A36D',
  primaryForeground: '#FFFFFF',
  accent: '#E3E7DC',
  danger: '#B54D45',
  success: '#477653',
  warning: '#96642A',
  border: '#E8E3D8',
  sticky: '#F4E8D4',
};

const dark = {
  background: '#1C1D19',
  surface: '#262821',
  surfaceElevated: '#33352C',
  foreground: '#F2EFE6',
  textMuted: '#AAA99F',
  primary: '#A5B59A',
  secondary: '#D8B58A',
  primaryForeground: '#1C1D19',
  accent: '#2F332A',
  danger: '#D98878',
  success: '#8FBF96',
  warning: '#D8B58A',
  border: '#3A3C33',
  sticky: '#3E3524',
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: light.background,
        surface: light.surface,
        'surface-elevated': light.surfaceElevated,
        foreground: light.foreground,
        muted: light.textMuted,
        primary: light.primary,
        secondary: light.secondary,
        'secondary-foreground': light.secondaryForeground,
        'primary-foreground': light.primaryForeground,
        accent: light.accent,
        danger: light.danger,
        success: light.success,
        warning: light.warning,
        border: light.border,
        sticky: light.sticky,
        'dark-background': dark.background,
        'dark-surface': dark.surface,
        'dark-surface-elevated': dark.surfaceElevated,
        'dark-foreground': dark.foreground,
        'dark-muted': dark.textMuted,
        'dark-primary': dark.primary,
        'dark-secondary': dark.secondary,
        'dark-secondary-foreground': dark.secondaryForeground,
        'dark-primary-foreground': dark.primaryForeground,
        'dark-accent': dark.accent,
        'dark-danger': dark.danger,
        'dark-success': dark.success,
        'dark-warning': dark.warning,
        'dark-border': dark.border,
        'dark-sticky': dark.sticky,
      },
    },
  },
  plugins: [],
};
