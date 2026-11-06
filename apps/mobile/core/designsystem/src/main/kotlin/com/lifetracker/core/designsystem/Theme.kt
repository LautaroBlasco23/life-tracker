package com.lifetracker.core.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf

/** User theme preference: `system` mirrors the OS (same semantics as the RN ThemeProvider). */
enum class ThemePreference { SYSTEM, LIGHT, DARK }

/** Mutable theme controller; each screen can offer a toggle (port of `components/theme-toggle.tsx`). */
object ThemeController {
    var preference by mutableStateOf(ThemePreference.SYSTEM)
}

val LocalAppColors = staticCompositionLocalOf { LightAppColors }

private fun appColorScheme(c: AppColors, dark: Boolean) =
    if (dark) {
        darkColorScheme(
            background = c.background,
            onBackground = c.foreground,
            surface = c.surface,
            onSurface = c.foreground,
            surfaceVariant = c.surfaceElevated,
            onSurfaceVariant = c.textMuted,
            primary = c.primary,
            onPrimary = c.primaryForeground,
            secondary = c.secondary,
            onSecondary = c.secondaryForeground,
            tertiary = c.success,
            error = c.danger,
            outline = c.border,
            outlineVariant = c.border,
        )
    } else {
        lightColorScheme(
            background = c.background,
            onBackground = c.foreground,
            surface = c.surface,
            onSurface = c.foreground,
            surfaceVariant = c.surfaceElevated,
            onSurfaceVariant = c.textMuted,
            primary = c.primary,
            onPrimary = c.primaryForeground,
            secondary = c.secondary,
            onSecondary = c.secondaryForeground,
            tertiary = c.success,
            error = c.danger,
            outline = c.border,
            outlineVariant = c.border,
        )
    }

@Composable
fun LifeTrackerTheme(content: @Composable () -> Unit) {
    val appColors = when (ThemeController.preference) {
        ThemePreference.SYSTEM -> if (isSystemInDarkTheme()) DarkAppColors else LightAppColors
        ThemePreference.LIGHT -> LightAppColors
        ThemePreference.DARK -> DarkAppColors
    }
    val scheme = appColorScheme(appColors, dark = appColors == DarkAppColors)
    CompositionLocalProvider(LocalAppColors provides appColors) {
        MaterialTheme(colorScheme = scheme, content = content)
    }
}
