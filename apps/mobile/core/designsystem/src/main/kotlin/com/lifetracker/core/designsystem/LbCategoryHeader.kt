package com.lifetracker.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Port of web `components/ui/category/categoryHeader.tsx`: a 4px colored left
 * accent bar, a section-colored icon, the section label with tagline, and a
 * right-aligned section summary (`done/total` in the accent color plus an
 * item-count hint).
 *
 * Mobile extension over the web version: passing [onToggle] makes the header
 * tappable to collapse/expand its section (chevron rotates; expanded = up,
 * collapsed = right) — a phone screen shows ~1.5 sections at a time, so
 * sections need a collapse affordance.
 */
@Composable
fun LbCategoryHeader(
    label: String,
    icon: ImageVector,
    accent: Color,
    modifier: Modifier = Modifier,
    description: String? = null,
    /** Bold accent-colored summary, e.g. "2/5". */
    summary: String? = null,
    /** Small muted line under [summary], e.g. "5 activities". */
    summaryHint: String? = null,
    collapsed: Boolean = false,
    onToggle: (() -> Unit)? = null,
) {
    val colors = LocalAppColors.current
    val accentBar = 4.dp
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = AppDimens.MinTouchTarget)
            .drawBehind {
                drawRect(
                    color = accent,
                    topLeft = Offset.Zero,
                    size = Size(accentBar.toPx(), size.height),
                )
            }
            .let { base ->
                if (onToggle != null) {
                    base.semantics { role = Role.Button }.clickable(onClick = onToggle)
                } else {
                    base
                }
            }
            .padding(start = accentBar + AppDimens.SpacingLg, top = AppDimens.SpacingLg, bottom = AppDimens.SpacingLg),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = accent,
            modifier = Modifier.size(24.dp),
        )
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(start = AppDimens.SpacingLg),
        ) {
            Text(
                text = label,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = colors.foreground,
            )
            if (description != null) {
                Text(
                    text = description,
                    fontSize = 13.sp,
                    color = colors.textMuted,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
        if (summary != null || summaryHint != null) {
            Column(horizontalAlignment = Alignment.End) {
                if (summary != null) {
                    Text(
                        text = summary,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = accent,
                    )
                }
                if (summaryHint != null) {
                    Text(
                        text = summaryHint,
                        fontSize = 12.sp,
                        color = colors.textMuted,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
        }
        if (onToggle != null) {
            Icon(
                imageVector = Icons.Outlined.ChevronRight,
                contentDescription = null,
                tint = colors.textMuted,
                modifier = Modifier
                    .padding(start = AppDimens.SpacingSm)
                    .size(20.dp)
                    // Expanded sections point up; collapsed point right.
                    .rotate(if (collapsed) 0f else 90f),
            )
        }
    }
}
