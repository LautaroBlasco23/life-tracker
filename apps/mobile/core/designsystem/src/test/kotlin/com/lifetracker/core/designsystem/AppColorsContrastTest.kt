package com.lifetracker.core.designsystem

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * WCAG AA contrast guards over the Warm-Minimalism palette (mobile mirror of
 * the web `theme-colors.test.ts` critical-pair checks).
 *
 * Floors (styles.md): 4.5:1 normal text, 3:1 large text / UI components.
 * Rationale per pair class:
 * - textMuted/foreground/primary on background & surface: body/labels → 4.5.
 * - primaryForeground on primary & danger: buttons/toasts → 4.5 (small labels).
 * - warning/secondary on tinted amber (streak-badge tiers) → 3.0 (14sp medium
 *   badge, decorative flame + count; kept at the large-text floor).
 * - The "same token for ink and background" bug class (streak badge cold tier
 *   once rendered textMuted-on-textMuted) is covered by the distinctness test.
 */
class AppColorsContrastTest {

    private fun luminance(c: Color): Double {
        fun channel(v: Float): Double {
            val d = v.toDouble()
            return if (d <= 0.03928) d / 12.92 else Math.pow((d + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * channel(c.red) + 0.7152 * channel(c.green) + 0.0722 * channel(c.blue)
    }

    /** WCAG contrast ratio; alpha-composites fg, then bg, over `base`. */
    private fun contrast(fg: Color, bg: Color, base: Color): Double {
        val over = { over: Color, under: Color ->
            val a = over.alpha.toDouble()
            Color(
                red = (over.red * a + under.red * (1 - a)).toFloat(),
                green = (over.green * a + under.green * (1 - a)).toFloat(),
                blue = (over.blue * a + under.blue * (1 - a)).toFloat(),
                alpha = 1f,
            )
        }
        val fgOpaque = over(fg, base)
        val bgOpaque = over(bg, base)
        val l1 = luminance(fgOpaque)
        val l2 = luminance(bgOpaque)
        val (hi, lo) = if (l1 > l2) l1 to l2 else l2 to l1
        return (hi + 0.05) / (lo + 0.05)
    }

    private fun assertRatio(palette: AppColors, fg: Color, bg: Color, min: Double, label: String, base: Color = palette.background) {
        val ratio = contrast(fg, bg, base)
        assertTrue(
            "$label: contrast %.2f < $min".format(ratio),
            ratio >= min,
        )
    }

    private fun pairs(palette: AppColors, dark: Boolean) {
        val textFloor = 4.5
        val uiFloor = 3.0
        val surfaces = listOf(
            "background" to palette.background,
            "surface" to palette.surface,
            "surfaceElevated" to palette.surfaceElevated,
        )
        // Body/label inks on the page surfaces.
        for ((bgName, bg) in surfaces) {
            assertRatio(palette, palette.foreground, bg, textFloor, "foreground on $bgName")
            assertRatio(palette, palette.textMuted, bg, textFloor, "textMuted on $bgName")
            assertRatio(palette, palette.primary, bg, textFloor, "primary on $bgName")
        }
        // Filled controls: sage and danger fills with their ink.
        assertRatio(palette, palette.primaryForeground, palette.primary, textFloor, "primaryForeground on primary")
        assertRatio(palette, palette.primaryForeground, palette.danger, textFloor, "primaryForeground on danger")
        // Streak-badge cold/warm tiers: amber ink on amber-tinted surfaces.
        // Ink is role-adapted: dark amber (warning) in light mode, light
        // amber (secondary) in dark mode. The badge sits on the card surface.
        val tintedInk = if (dark) palette.secondary else palette.warning
        for ((tierName, tier) in listOf(
            "cold" to palette.secondary.copy(alpha = 0.10f),
            "hot" to palette.secondary.copy(alpha = 0.15f),
        )) {
            assertRatio(palette, tintedInk, tier, uiFloor, "amber ink on $tier amber tint", base = palette.surface)
        }
        // On-fire tier: dark ink on solid amber.
        assertRatio(palette, palette.secondaryForeground, palette.secondary, textFloor, "secondaryForeground on secondary")
        // Day-time section accents: icons, accent bars and section-count
        // numerals ink against background/surface (mobile mirror of the
        // theme-colors.test.ts section pair checks).
        for ((name, section) in listOf(
            "sectionAnytime" to palette.sectionAnytime,
            "sectionMorning" to palette.sectionMorning,
            "sectionAfternoon" to palette.sectionAfternoon,
            "sectionEvening" to palette.sectionEvening,
        )) {
            for ((bgName, bg) in surfaces) {
                assertRatio(palette, section, bg, textFloor, "$name on $bgName")
            }
        }
    }

    @Test
    fun `light palette meets AA floors`() = pairs(LightAppColors, dark = false)

    @Test
    fun `dark palette meets AA floors`() = pairs(DarkAppColors, dark = true)

    @Test
    fun `ink and background tokens are never identical`() {
        for (palette in listOf(LightAppColors, DarkAppColors)) {
            val surfaces = listOf(
                "background" to palette.background,
                "surface" to palette.surface,
                "surfaceElevated" to palette.surfaceElevated,
            )
            val inks = listOf(
                "foreground" to palette.foreground,
                "textMuted" to palette.textMuted,
                "primary" to palette.primary,
                "warning" to palette.warning,
                "danger" to palette.danger,
                "success" to palette.success,
            )
            for ((inkName, ink) in inks) {
                for ((bgName, bg) in surfaces) {
                    assertTrue(
                        "$inkName on $bgName: tokens render identically (contrast 1.0)",
                        contrast(ink, bg, palette.background) > 1.0,
                    )
                }
            }
        }
    }
}
