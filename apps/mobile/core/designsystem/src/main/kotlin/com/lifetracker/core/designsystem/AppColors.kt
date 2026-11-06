package com.lifetracker.core.designsystem

import androidx.compose.ui.graphics.Color

/**
 * Warm Minimalism palette — direct port of `packages/shared/src/lib/theme-colors.ts`.
 * These are the ONLY colors allowed in mobile UI code; never hardcode a hex that
 * isn't mirrored in `theme-colors.ts` (single source of truth, see styles.md).
 */
data class AppColors(
    val background: Color,
    val surface: Color,
    val surfaceElevated: Color,
    val foreground: Color,
    val textMuted: Color,
    val primary: Color,
    val primaryForeground: Color,
    val secondary: Color,
    val secondaryForeground: Color,
    val accent: Color,
    val danger: Color,
    val success: Color,
    val warning: Color,
    val border: Color,
    val sticky: Color,
)

val LightAppColors = AppColors(
    background = Color(0xFFF5F2EA),
    surface = Color(0xFFFFFFFF),
    surfaceElevated = Color(0xFFFFFFFF),
    foreground = Color(0xFF30372F),
    textMuted = Color(0xFF6A6C61),
    primary = Color(0xFF5C6F55),
    primaryForeground = Color(0xFFFFFFFF),
    secondary = Color(0xFFD6A36D),
    secondaryForeground = Color(0xFF30372F),
    accent = Color(0xFFE3E7DC),
    danger = Color(0xFFB54D45),
    success = Color(0xFF477653),
    warning = Color(0xFF96642A),
    border = Color(0xFFE8E3D8),
    sticky = Color(0xFFF4E8D4),
)

val DarkAppColors = AppColors(
    background = Color(0xFF1C1D19),
    surface = Color(0xFF262821),
    surfaceElevated = Color(0xFF33352C),
    foreground = Color(0xFFF2EFE6),
    textMuted = Color(0xFFAAA99F),
    primary = Color(0xFFA5B59A),
    primaryForeground = Color(0xFF1C1D19),
    secondary = Color(0xFFD8B58A),
    secondaryForeground = Color(0xFF1C1D19),
    accent = Color(0xFF2F332A),
    danger = Color(0xFFD98878),
    success = Color(0xFF8FBF96),
    warning = Color(0xFFD8B58A),
    border = Color(0xFF3A3C33),
    sticky = Color(0xFF3E3524),
)
