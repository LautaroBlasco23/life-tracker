package com.lifetracker.feature.profile

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
 * glyphs the RN profile screen uses (`lucide-react-native`), declared locally
 * like `feature/time/TimeIcons.kt` (the extended material icon pack is not a
 * dependency of feature modules). Nav icons duplicate the Time definitions
 * with the intended visual parity.
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
object ProfileIcons

/** lucide `activity` (nav drawer). */
val ProfileIcons.Activity: ImageVector by lazy { strokeIcon("Profile.LbActivity", listOf(
    "M22 12 L18 12 L15 21 L9 3 L6 12 L2 12",
)) }

/** lucide `timer` (nav drawer). */
val ProfileIcons.Timer: ImageVector by lazy { strokeIcon("Profile.LbTimer", listOf(
    "M10 2 L14 2",
    "M12 14 L15 11",
    "M20 14 A8 8 0 1 1 4 14 A8 8 0 1 1 20 14",
)) }

/** lucide `sticky-note` (nav drawer). */
val ProfileIcons.StickyNote: ImageVector by lazy { strokeIcon("Profile.LbStickyNote", listOf(
    "M15.5 3 L5 3 C3.9 3 3 3.9 3 5 L3 19 C3 20.1 3.9 21 5 21 L19 21 C20.1 21 21 20.1 21 19 L21 8.5 Z",
    "M15 3 L15 8.5 L21 8.5",
)) }

/** lucide `wallet` (nav drawer). */
val ProfileIcons.Wallet: ImageVector by lazy { strokeIcon("Profile.LbWallet", listOf(
    "M21 12 L21 7 L5 7 C3.9 7 3 6.1 3 5 C3 3.9 3.9 3 5 3 L19 3",
    "M3 5 L3 19 C3 20.1 3.9 21 5 21 L21 21 L21 19 L21 16",
    "M18 12 C17 12 16 12.9 16 14 C16 15.1 17 16 18 16 L22 16 L22 12 Z",
)) }

/** lucide `chart-pie` (nav drawer). */
val ProfileIcons.ChartPie: ImageVector by lazy { strokeIcon("Profile.LbChartPie", listOf(
    "M21 12 C21.6 12 21.95 11.56 21.95 11 A10 10 0 0 0 13 2 C12.45 2 12 2.45 12 3 L12 11 C12 11.55 12.45 12 13 12 Z",
    "M21.21 15.89 A10 10 0 1 1 8 2.83",
)) }

/** lucide `users` (nav drawer). */
val ProfileIcons.Users: ImageVector by lazy { strokeIcon("Profile.LbUsers", listOf(
    "M16 21 L16 19 C16 16.8 14.2 15 12 15 L6 15 C3.8 15 2 16.8 2 19 L2 21",
    "M13 7 A4 4 0 1 1 5 7 A4 4 0 1 1 13 7",
    "M22 21 L22 19 C22 17.13 20.87 15.63 19 15.13",
    "M16 3.13 A4 4 0 0 1 16 10.87",
)) }

/** lucide `lock` (privacy row). */
val ProfileIcons.Lock: ImageVector by lazy { strokeIcon("Profile.LbLock", listOf(
    "M7.5 12 L7.5 7 A4.5 4.5 0 0 1 16.5 7 L16.5 12",
    "M6 11 L18 11 C19.1 11 20 11.9 20 13 L20 19 C20 20.1 19.1 21 18 21 L6 21 C4.9 21 4 20.1 4 19 L4 13 C4 11.9 4.9 11 6 11",
)) }

/** lucide `key-round` (change password). */
val ProfileIcons.KeyRound: ImageVector by lazy { strokeIcon("Profile.LbKeyRound", listOf(
    "M23 7.5 A6.5 6.5 0 1 1 10 7.5 A6.5 6.5 0 1 1 23 7.5",
    "M11.4 12.6 L6 18 L6 21 L3 21",
    "M9.4 14.6 L11.9 17.1",
)) }

/** lucide `mail` (change email). */
val ProfileIcons.Mail: ImageVector by lazy { strokeIcon("Profile.LbMail", listOf(
    "M2 6 C2 5 3 4 4 4 L20 4 C21 4 22 5 22 6 L22 18 C22 19 21 20 20 20 L4 20 C3 20 2 19 2 18 Z",
    "M22 7 L13 12.6 C12.4 13 11.6 13 11 12.6 L2 7",
)) }

/** lucide `download` (backup export). */
val ProfileIcons.Download: ImageVector by lazy { strokeIcon("Profile.LbDownload", listOf(
    "M21 15 L21 19 C21 20 20 21 19 21 L5 21 C4 21 3 20 3 19 L3 15",
    "M7 10 L12 15 L17 10",
    "M12 15 L12 3",
)) }

/** lucide `upload` (backup import). */
val ProfileIcons.Upload: ImageVector by lazy { strokeIcon("Profile.LbUpload", listOf(
    "M21 15 L21 19 C21 20 20 21 19 21 L5 21 C4 21 3 20 3 19 L3 15",
    "M17 8 L12 3 L7 8",
    "M12 3 L12 15",
)) }

/** lucide `arrow-left` (backup route back button). */
val ProfileIcons.ArrowLeft: ImageVector by lazy { strokeIcon("Profile.LbArrowLeft", listOf(
    "M19 12 L5 12",
    "M12 19 L5 12 L12 5",
)) }
