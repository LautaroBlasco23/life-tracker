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
    background: "#F5F2EA",
    surface: "#FFFFFF",
    surfaceElevated: "#FFFFFF",
    foreground: "#30372F",
    textMuted: "#6A6C61",
    primary: "#5C6F55",
    primaryForeground: "#FFFFFF",
    // Warm amber — highlights and secondary emphasis only; pair with dark
    // text on light backgrounds (it fails 3:1 as text/UI on light surfaces).
    secondary: "#D6A36D",
    secondaryForeground: "#30372F",
    // Sage-tinted subtle surface for hover/selected states.
    accent: "#E3E7DC",
    danger: "#B54D45",
    success: "#477653",
    warning: "#96642A",
    border: "#E8E3D8",
    sticky: "#F4E8D4",
  },
  dark: {
    background: "#1C1D19",
    surface: "#262821",
    surfaceElevated: "#33352C",
    foreground: "#F2EFE6",
    textMuted: "#AAA99F",
    primary: "#A5B59A",
    primaryForeground: "#1C1D19",
    secondary: "#D8B58A",
    secondaryForeground: "#1C1D19",
    accent: "#2F332A",
    danger: "#D98878",
    success: "#8FBF96",
    warning: "#D8B58A",
    border: "#3A3C33",
    sticky: "#3E3524",
  },
} as const
