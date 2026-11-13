package com.lifetracker.feature.finance

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
 * glyphs the RN finance screens use (`lucide-react-native`), same technique as
 * `feature/time`'s TimeIcons (no material-icons dependency needed).
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
object FinanceIcons

/**
 * Rounded triangle-alert (the `alert-triangle` lucide glyph; the tiny arcs are
 * unrolled as curves).
 */
val FinanceIcons.AlertTriangle: ImageVector by lazy { strokeIcon("Finance.LbAlertTriangle", listOf(
    "M21.73 18 L13.73 4 C13.15 3.05 10.85 3.05 10.27 4 L2.27 18 C1.7 18.95 2.43 20 4 20 L20 20 C21.57 20 22.3 18.95 21.73 18",
    "M12 9 L12 13",
    "M12 17 L12.01 17",
)) }

/** lucide `plus`. */
val FinanceIcons.Plus: ImageVector by lazy { strokeIcon("Finance.LbPlus", listOf(
    "M5 12 L19 12",
    "M12 5 L12 19",
)) }

/** lucide `x`. */
val FinanceIcons.X: ImageVector by lazy { strokeIcon("Finance.LbX", listOf(
    "M18 6 L6 18",
    "M6 6 L12 12",
)) }

/** lucide `sliders-horizontal`. */
val FinanceIcons.SlidersHorizontal: ImageVector by lazy { strokeIcon("Finance.LbSlidersHorizontal", listOf(
    "M21 4 L14 4",
    "M10 4 L3 4",
    "M21 12 L12 12",
    "M8 12 L3 12",
    "M21 20 L16 20",
    "M12 20 L3 20",
    "M14 2 L14 6",
    "M8 10 L8 14",
    "M16 18 L16 22",
)) }

/** lucide `trending-up`. */
val FinanceIcons.TrendingUp: ImageVector by lazy { strokeIcon("Finance.LbTrendingUp", listOf(
    "M22 7 L13.5 15.5 L8.5 10.5 L2 17",
    "M16 7 L22 7 L22 13",
)) }

/** lucide `trending-down`. */
val FinanceIcons.TrendingDown: ImageVector by lazy { strokeIcon("Finance.LbTrendingDown", listOf(
    "M22 17 L13.5 8.5 L8.5 13.5 L2 7",
    "M16 17 L22 17 L22 11",
)) }

/** lucide `dollar-sign`. */
val FinanceIcons.DollarSign: ImageVector by lazy { strokeIcon("Finance.LbDollarSign", listOf(
    "M12 2 L12 22",
    "M17 5 L9.5 5 C7.57 5 6 6.57 6 8.5 C6 10.43 7.57 12 9.5 12 L14.5 12 C16.43 12 18 13.57 18 15.5 C18 17.43 16.43 19 14.5 19 L6 19",
)) }

// ---- hamburger navigation glyphs (same datums as feature/time's set) ----

/** lucide `wallet`. */
val FinanceIcons.Wallet: ImageVector by lazy { strokeIcon("Finance.LbWallet", listOf(
    "M21 12 L21 7 L5 7 C3.9 7 3 6.1 3 5 C3 3.9 3.9 3 5 3 L19 3",
    "M3 5 L3 19 C3 20.1 3.9 21 5 21 L21 21 L21 19 L21 16",
    "M18 12 C17 12 16 12.9 16 14 C16 15.1 17 16 18 16 L22 16 L22 12 Z",
)) }

/** lucide `chart-pie`. */
val FinanceIcons.ChartPie: ImageVector by lazy { strokeIcon("Finance.LbChartPie", listOf(
    "M21 12 C21.6 12 21.95 11.56 21.95 11 A10 10 0 0 0 13 2 C12.45 2 12 2.45 12 3 L12 11 C12 11.55 12.45 12 13 12 Z",
    "M21.21 15.89 A10 10 0 1 1 8 2.83",
)) }

