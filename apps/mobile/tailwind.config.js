/**
 * Tailwind config for the mobile app.
 *
 * Colors are duplicated from packages/shared/src/lib/theme-colors.ts (the
 * single source of truth for light/dark palettes). Use `dark:` variants for
 * theme switching — the ThemeProvider drives Appearance.setColorScheme.
 */
const light = {
  background: '#ffffff',
  surface: '#f6f8fa',
  foreground: '#1f2328',
  textMuted: '#57606a',
  primary: '#0583f2',
  secondary: '#61dafb',
  primaryForeground: '#ffffff',
  accent: '#79c0ff',
  danger: '#cf222e',
  success: '#1a7f37',
  warning: '#9a6700',
  border: '#d0d7de',
};

const dark = {
  background: '#0d1117',
  surface: '#161b22',
  foreground: '#f0f6fc',
  textMuted: '#c9d1d9',
  primary: '#61dafb',
  secondary: '#79c0ff',
  primaryForeground: '#0d1117',
  accent: '#a5d6ff',
  danger: '#ff7b72',
  success: '#56d364',
  warning: '#e3b341',
  border: '#30363d',
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
        foreground: light.foreground,
        muted: light.textMuted,
        primary: light.primary,
        secondary: light.secondary,
        'primary-foreground': light.primaryForeground,
        accent: light.accent,
        danger: light.danger,
        success: light.success,
        warning: light.warning,
        border: light.border,
        'dark-background': dark.background,
        'dark-surface': dark.surface,
        'dark-foreground': dark.foreground,
        'dark-muted': dark.textMuted,
        'dark-primary': dark.primary,
        'dark-secondary': dark.secondary,
        'dark-primary-foreground': dark.primaryForeground,
        'dark-accent': dark.accent,
        'dark-danger': dark.danger,
        'dark-success': dark.success,
        'dark-warning': dark.warning,
        'dark-border': dark.border,
      },
    },
  },
  plugins: [],
};
