package com.lifetracker.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Icon + stacked-label header action tile (activities screen: routines,
 * templates, filters). Evenly weighted tiles replace the 36dp text-chip row
 * that could clip with longer localized labels; the 44dp+ height meets the
 * touch-target token. A [badgeCount] renders an amber count bubble on the
 * icon's top end; [highlighted] gives the tile a tonal accent surface
 * (active-filter state).
 */
@Composable
fun LbHeaderAction(
    text: String,
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    badgeCount: Int? = null,
    highlighted: Boolean = false,
) {
    val colors = LocalAppColors.current
    val shape = RoundedCornerShape(AppDimens.RadiusSm)
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = modifier
            .heightIn(min = AppDimens.MinTouchTarget)
            .clip(shape)
            .background(if (highlighted) colors.accent else colors.surface)
            .border(
                1.dp,
                if (highlighted) colors.secondary.copy(alpha = 0.4f) else colors.border,
                shape,
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 4.dp, vertical = 6.dp),
    ) {
        Box(modifier = Modifier.padding(top = 2.dp)) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = colors.primary,
                modifier = Modifier.size(20.dp),
            )
            if (badgeCount != null && badgeCount > 0) {
                Text(
                    text = badgeCount.toString(),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.secondaryForeground,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .offset(x = 8.dp, y = (-4).dp)
                        .clip(CircleShape)
                        .background(colors.secondary)
                        .defaultMinSize(minWidth = 16.dp)
                        .padding(horizontal = 4.dp, vertical = 1.dp),
                )
            }
        }
        Text(
            text = text,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            color = colors.foreground,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}
