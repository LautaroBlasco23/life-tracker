package com.lifetracker.core.designsystem

import androidx.compose.ui.unit.dp

/**
 * Spacing / radius / touch-target tokens (styles.md: spacing scale 4-8-12-16-24-32-48,
 * radius small 8 / medium 12 / large 16, mobile touch targets >= 44).
 * Use these instead of inline dp literals in feature code.
 */
object AppDimens {
    // Spacing scale
    val SpacingXs = 4.dp
    val SpacingSm = 8.dp
    val SpacingMd = 12.dp
    val SpacingLg = 16.dp
    val SpacingXl = 24.dp
    val SpacingXxl = 32.dp
    val SpacingXxxl = 48.dp

    // Corner radius
    val RadiusSm = 8.dp
    val RadiusMd = 12.dp
    val RadiusLg = 16.dp

    // Interaction
    val MinTouchTarget = 44.dp
}
