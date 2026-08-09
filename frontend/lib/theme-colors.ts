export type ThemeMode = "light" | "dark"

export const themeColors = {
  light: {
    background: "#ffffff",
    surface: "#f6f8fa",
    foreground: "#1f2328",
    textMuted: "#57606a",
    primary: "#0583f2",
    secondary: "#61dafb",
    accent: "#79c0ff",
    danger: "#cf222e",
    success: "#1a7f37",
    warning: "#9a6700",
    border: "#d0d7de",
  },
  dark: {
    background: "#0d1117",
    surface: "#161b22",
    foreground: "#f0f6fc",
    textMuted: "#c9d1d9",
    primary: "#61dafb",
    secondary: "#79c0ff",
    accent: "#a5d6ff",
    danger: "#ff7b72",
    success: "#56d364",
    warning: "#e3b341",
    border: "#30363d",
  },
} as const
