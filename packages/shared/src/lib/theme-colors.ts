export type ThemeMode = "light" | "dark"
export type ThemePreference = ThemeMode | "system"

/**
 * Warm Minimalism palette — single source of truth for light/dark tokens
 * (see styles.md).
 *
 * Consumers derive their palettes from these values; never hardcode a color
 * that isn't here:
 * - web: frontend/app/globals.css (hex parity is enforced by a test)
 * - mobile: apps/mobile/tailwind.config.js
 *
 * WCAG AA contrast for the critical foreground/background pairs is enforced
 * in theme-colors.test.ts — run it after changing any value.
 */
export const themeColors = {
  light: {
    background: "#f5f2ea",
    surface: "#ffffff",
    surfaceElevated: "#ffffff",
    foreground: "#30372f",
    textMuted: "#6a6c61",
    primary: "#5c6f55",
    primaryForeground: "#ffffff",
    // Warm amber — highlights and secondary emphasis only; pair with dark
    // text on light backgrounds (it fails 3:1 as text/UI on light surfaces).
    secondary: "#d6a36d",
    secondaryForeground: "#30372f",
    // Sage-tinted subtle surface for hover/selected states.
    accent: "#e3e7dc",
    danger: "#b54d45",
    success: "#477653",
    warning: "#96642a",
    border: "#e8e3d8",
    sticky: "#f4e8d4",
    // Day-time section accents (activities page: morning/afternoon/evening/
    // any-moment). Used as section icons, 4px left bars and count numerals.
    // Warm-leaning hues tuned to pass AA 4.5:1 on background/surface in both
    // modes; the light `sectionMorning` is the darker amber (warning value)
    // because the bright `secondary` amber fails text contrast on light
    // surfaces by design.
    sectionAnytime: "#6a6c61",
    sectionMorning: "#96642a",
    sectionAfternoon: "#4a7183",
    sectionEvening: "#6b5b8e",
  },
  dark: {
    background: "#1c1d19",
    surface: "#262821",
    surfaceElevated: "#33352c",
    foreground: "#f2efe6",
    textMuted: "#aaa99f",
    primary: "#a5b59a",
    primaryForeground: "#1c1d19",
    secondary: "#d8b58a",
    secondaryForeground: "#1c1d19",
    accent: "#2f332a",
    danger: "#d98878",
    success: "#8fbf96",
    warning: "#d8b58a",
    border: "#3a3c33",
    sticky: "#3e3524",
    // Dark-mode section accents (lighter, role-adapted counterparts of the
    // light values above; morning reuses the light secondary amber).
    sectionAnytime: "#aaa99f",
    sectionMorning: "#d8b58a",
    sectionAfternoon: "#93bccb",
    sectionEvening: "#b3a6cf",
  },
} as const
