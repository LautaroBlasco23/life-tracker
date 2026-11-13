package com.lifetracker.core.designsystem

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * Type scale from styles.md (mobile: system default font). Sizes map the
 * sizes actually used in the app onto Material 3 roles:
 * - titleLarge  = page title (24sp w600)
 * - titleMedium = section / modal title (18sp w600)
 * - bodyLarge   = body / input text (16sp)
 * - bodyMedium  = body, secondary rows (14sp)
 * - bodySmall   = supporting text (12sp)
 * - labelLarge  = button labels (16sp w500)
 * Colors are intentionally unset (Color.Unspecified): the app inks text via
 * `LocalAppColors`, so the type scale only defines size/weight/spacing.
 */
val AppTypography = Typography(
    titleLarge = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.SemiBold, lineHeight = 30.sp),
    titleMedium = TextStyle(fontSize = 18.sp, fontWeight = FontWeight.SemiBold, lineHeight = 24.sp),
    titleSmall = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.SemiBold, lineHeight = 22.sp),
    bodyLarge = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Normal, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Normal, lineHeight = 20.sp),
    bodySmall = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Normal, lineHeight = 16.sp),
    labelLarge = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Medium),
    labelMedium = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Medium),
    labelSmall = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Medium),
)
