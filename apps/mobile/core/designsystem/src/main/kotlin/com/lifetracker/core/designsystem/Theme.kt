package com.lifetracker.core.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.unit.dp

/** User theme preference: `system` mirrors the OS (same semantics as the RN ThemeProvider). */
enum class ThemePreference { SYSTEM, LIGHT, DARK }

/** Mutable theme controller; each screen can offer a toggle (port of `components/theme-toggle.tsx`). */
object ThemeController {
    var preference by mutableStateOf(ThemePreference.SYSTEM)
}

val LocalAppColors = staticCompositionLocalOf { LightAppColors }

/** Shape tokens (styles.md): small 8 / medium 12 / large 16. */
private val AppShapes = Shapes(
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
)

private fun appColorScheme(c: AppColors, dark: Boolean): ColorScheme =
    (if (dark) darkColorScheme() else lightColorScheme()).copy(
        background = c.background,
        onBackground = c.foreground,
        surface = c.surface,
        onSurface = c.foreground,
        surfaceVariant = c.surfaceElevated,
        onSurfaceVariant = c.textMuted,
        // Containers derive from the elevated surface so M3 components
        // (bottom sheets, menus) stay on the warm palette instead of defaults.
        surfaceContainer = c.surfaceElevated,
        surfaceContainerLow = c.surfaceElevated,
        surfaceContainerHigh = c.surfaceElevated,
        surfaceContainerHighest = c.border,
        primary = c.primary,
        onPrimary = c.primaryForeground,
        secondary = c.secondary,
        onSecondary = c.secondaryForeground,
        tertiary = c.success,
        error = c.danger,
        outline = c.border,
        outlineVariant = c.border,
        // Scrims stay dark in both modes (M3 convention); foreground-tinted
        // scrims read wrong in dark mode where foreground is near-white.
        scrim = androidx.compose.ui.graphics.Color.Black,
    )

@Composable
fun LifeTrackerTheme(content: @Composable () -> Unit) {
    val appColors = when (ThemeController.preference) {
        ThemePreference.SYSTEM -> if (isSystemInDarkTheme()) DarkAppColors else LightAppColors
        ThemePreference.LIGHT -> LightAppColors
        ThemePreference.DARK -> DarkAppColors
    }
    val scheme = appColorScheme(appColors, dark = appColors == DarkAppColors)
    CompositionLocalProvider(LocalAppColors provides appColors) {
        MaterialTheme(
            colorScheme = scheme,
            typography = AppTypography,
            shapes = AppShapes,
            content = content,
        )
    }
}
