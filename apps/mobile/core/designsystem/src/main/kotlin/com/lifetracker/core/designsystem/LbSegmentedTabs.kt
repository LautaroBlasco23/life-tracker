package com.lifetracker.core.designsystem

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Port of RN `components/ui/segmented-tabs.tsx`: in-page segmented control.
 * Surface-colored track (p-1, rounded-lg), selected pill gets the background
 * color and foreground ink, unselected labels are muted.
 *
 * The RN component bakes a `mb-4` bottom margin — kept for visual parity.
 */
@Composable
fun LbSegmentedTabs(
    items: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = LocalAppColors.current
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(bottom = 16.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(colors.surface)
            .padding(4.dp),
    ) {
        items.forEachIndexed { index, item ->
            val selected = index == selectedIndex
            val container by animateColorAsState(
                if (selected) colors.background else Color.Transparent,
                label = "segmentContainer",
            )
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(6.dp))
                    .background(container)
                    .clickable { onSelect(index) }
                    .height(36.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = item,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = if (selected) colors.foreground else colors.textMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}
