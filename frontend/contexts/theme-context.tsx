"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { themeColors, type ThemeMode } from "@/lib/theme-colors"

interface ThemeContextType {
  theme: ThemeMode
  toggleTheme: () => void
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark")

  useEffect(() => {
    // Check for saved theme preference or default to dark
    const savedTheme = localStorage.getItem("theme") as ThemeMode
    if (savedTheme && (savedTheme === "light" || savedTheme === "dark")) {
      setThemeState(savedTheme)
    }
  }, [])

  useEffect(() => {
    // Apply theme colors to CSS variables
    const colors = themeColors[theme]
    const root = document.documentElement

    Object.entries(colors).forEach(([key, value]) => {
      const cssVar = `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`
      root.style.setProperty(cssVar, value)
    })

    // Update class for dark mode detection
    if (theme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }

    // Save theme preference
    localStorage.setItem("theme", theme)
  }, [theme])

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"))
  }

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme)
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
