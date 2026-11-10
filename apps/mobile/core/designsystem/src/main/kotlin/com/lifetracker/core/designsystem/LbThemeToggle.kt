package com.lifetracker.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp

/**
 * Port of RN `components/theme-toggle.tsx`: small header icon button that
 * flips the theme. Shows the icon of the mode you switch *to* (sun in dark
 * mode, moon in light mode), matching the RN component exactly.
 *
 * State lives in [ThemeController]; the callback receives the next preference
 * to persist (port of RN `toggleTheme`'s flip between light and dark).
 */
@Composable
fun LbThemeToggleButton(
    themePreference: ThemePreference,
    onSelect: (ThemePreference) -> Unit,
) {
    val colors = LocalAppColors.current
    // Resolve like the RN hook: 'system' follows the OS scheme.
    val resolvedDark = when (themePreference) {
        ThemePreference.DARK -> true
        ThemePreference.LIGHT -> false
        ThemePreference.SYSTEM -> isSystemInDarkTheme()
    }
    Box(
        modifier = Modifier
            .size(36.dp)
            .clip(RoundedCornerShape(8.dp))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = {
                    onSelect(if (resolvedDark) ThemePreference.LIGHT else ThemePreference.DARK)
                },
            ),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = if (resolvedDark) Icons.Outlined.LightMode else Icons.Outlined.DarkMode,
            contentDescription = "Toggle theme",
            tint = colors.textMuted,
            modifier = Modifier.size(16.dp),
        )
    }
}
