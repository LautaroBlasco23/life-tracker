package com.lifetracker.feature.time

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathBuilder
import androidx.compose.ui.graphics.vector.PathNode
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

/**
 * Stroke icons (`24x24` viewport, 2px round stroke) mirroring the lucide
 * glyphs the RN screen uses (`lucide-react-native`). `Icon(..., tint = …)`
 * re-colors them since the tint is applied as a color filter over the mask.
 *
 * `compose-material-icons-extended` is not a dependency of this module, so
 * the needed vectors are declared locally (visual parity, same size hint):
 * each one is the lucide SVG path data, parsed into the builder DSL.
 */

private fun strokeIcon(name: String, datum: List<String>): ImageVector {
    val builder = ImageVector.Builder(
        name = name,
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f,
    )
    datum.forEach { pathData ->
        builder.path(
            fill = null,
            stroke = SolidColor(Color(0xFF000000)),
            strokeAlpha = 1f,
            strokeLineWidth = 2f,
            strokeLineCap = StrokeCap.Round,
            strokeLineJoin = StrokeJoin.Round,
            strokeLineMiter = 4f,
            pathFillType = PathFillType.NonZero,
            pathBuilder = { applyPathData(pathData) },
        )
    }
    return builder.build()
}

/**
 * Plays the lucide SVG path chunk (`M/L/H/V/C/A/Z`, all absolute — the only
 * forms used by the datums below) into the builder DSL.
 */
private fun PathBuilder.applyPathData(datum: String) {
    val nodes = PathParser().parsePathString(datum).toNodes()
    nodes.forEach { node ->
        when (node) {
            is PathNode.MoveTo -> moveTo(node.x, node.y)
            is PathNode.LineTo -> lineTo(node.x, node.y)
            is PathNode.HorizontalTo -> horizontalLineTo(node.x)
            is PathNode.VerticalTo -> verticalLineTo(node.y)
            is PathNode.CurveTo -> curveTo(node.x1, node.y1, node.x2, node.y2, node.x3, node.y3)
            is PathNode.ArcTo -> arcTo(
                node.horizontalEllipseRadius,
                node.verticalEllipseRadius,
                node.theta,
                node.isMoreThanHalf,
                node.isPositiveArc,
                node.arcStartX,
                node.arcStartY,
            )
            is PathNode.Close -> close()
            else -> error("Unsupported path chunk in $datum: $node")
        }
    }
}

/** Namespace marker, mirroring the `Icons.X` usage style. */
object TimeIcons

/** lucide `timer`. */
val TimeIcons.Timer: ImageVector by lazy { strokeIcon("Time.LbTimer", listOf(
    "M10 2 L14 2",
    "M12 14 L15 11",
    "M20 14 A8 8 0 1 1 4 14 A8 8 0 1 1 20 14",
)) }

/** lucide `plus`. */
val TimeIcons.Plus: ImageVector by lazy { strokeIcon("Time.LbPlus", listOf(
    "M5 12 L19 12",
    "M12 5 L12 19",
)) }

/** lucide `filter`. */
val TimeIcons.Filter: ImageVector by lazy { strokeIcon("Time.LbFilter", listOf(
    "M22 3 L2 3 L10 12.46 L10 19 L14 21 L14 12.46 Z",
)) }

/** lucide `clock`. */
val TimeIcons.Clock: ImageVector by lazy { strokeIcon("Time.LbClock", listOf(
    "M22 12 A10 10 0 1 1 2 12 A10 10 0 1 1 22 12",
    "M12 6 L12 12 L16 14",
)) }

/** lucide `trash-2`. */
val TimeIcons.Trash: ImageVector by lazy { strokeIcon("Time.LbTrash", listOf(
    "M3 6 L21 6",
    "M19 6 L19 20 C19 21 18 22 17 22 L7 22 C6 22 5 21 5 20 L5 6",
    "M8 6 L8 4 C8 3 9 2 10 2 L14 2 C15 2 16 3 16 4 L16 6",
    "M10 11 L10 17",
    "M14 11 L14 17",
)) }

/** lucide `chevron-left`. */
val TimeIcons.ChevronLeft: ImageVector by lazy { strokeIcon("Time.LbChevronLeft", listOf(
    "M15 18 L9 12 L15 6",
)) }

/** lucide `chevron-right`. */
val TimeIcons.ChevronRight: ImageVector by lazy { strokeIcon("Time.LbChevronRight", listOf(
    "M9 18 L15 12 L9 6",
)) }

/** lucide `calendar-x`. */
val TimeIcons.CalendarX: ImageVector by lazy { strokeIcon("Time.LbCalendarX", listOf(
    "M8 2 L8 4",
    "M16 2 L16 4",
    "M5 4 L17 4 C18.1 4 19 4.9 19 6 L19 20 C19 21.1 18.1 22 17 22 L5 22 C3.9 22 3 21.1 3 20 L3 6 C3 4.9 3.9 4 5 4 Z",
    "M3 10 L19 10",
    "M10 15 L14 19",
    "M14 15 L10 19",
)) }

/** lucide `activity`. */
val TimeIcons.Activity: ImageVector by lazy { strokeIcon("Time.LbActivity", listOf(
    "M22 12 L18 12 L15 21 L9 3 L6 12 L2 12",
)) }

/** lucide `sticky-note`. */
val TimeIcons.StickyNote: ImageVector by lazy { strokeIcon("Time.LbStickyNote", listOf(
    "M15.5 3 L5 3 C3.9 3 3 3.9 3 5 L3 19 C3 20.1 3.9 21 5 21 L19 21 C20.1 21 21 20.1 21 19 L21 8.5 Z",
    "M15 3 L15 8.5 L21 8.5",
)) }

/** lucide `wallet`. */
val TimeIcons.Wallet: ImageVector by lazy { strokeIcon("Time.LbWallet", listOf(
    "M21 12 L21 7 L5 7 C3.9 7 3 6.1 3 5 C3 3.9 3.9 3 5 3 L19 3",
    "M3 5 L3 19 C3 20.1 3.9 21 5 21 L21 21 L21 19 L21 16",
    "M18 12 C17 12 16 12.9 16 14 C16 15.1 17 16 18 16 L22 16 L22 12 Z",
)) }

/** lucide `chart-pie`. */
val TimeIcons.ChartPie: ImageVector by lazy { strokeIcon("Time.LbChartPie", listOf(
    "M21 12 C21.6 12 21.95 11.56 21.95 11 A10 10 0 0 0 13 2 C12.45 2 12 2.45 12 3 L12 11 C12 11.55 12.45 12 13 12 Z",
    "M21.21 15.89 A10 10 0 1 1 8 2.83",
)) }

/** lucide `users`. */
val TimeIcons.Users: ImageVector by lazy { strokeIcon("Time.LbUsers", listOf(
    "M16 21 L16 19 C16 16.8 14.2 15 12 15 L6 15 C3.8 15 2 16.8 2 19 L2 21",
    "M13 7 A4 4 0 1 1 5 7 A4 4 0 1 1 13 7",
    "M22 21 L22 19 C22 17.13 20.87 15.63 19 15.13",
    "M16 3.13 A4 4 0 0 1 16 10.87",
)) }
