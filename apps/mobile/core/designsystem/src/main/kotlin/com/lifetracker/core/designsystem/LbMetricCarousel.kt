package com.lifetracker.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** One swipeable metric: icon + ink + label + display value (+ optional subline). */
data class LbMetricPage(
    val label: String,
    val value: String,
    val icon: ImageVector,
    val ink: Color,
    val subline: String? = null,
)

/**
 * Full-width swipeable metric card (web's icon-chipped stat grid, mobile-adapted):
 * a single `LbCard` holding a snap `HorizontalPager` of metric pages plus a dot
 * indicator (active = primary pill, inactive = muted dot). No auto-advance —
 * metrics are glanceable, auto-rotation fights the user; swipe only.
 *
 * Pages should carry pre-formatted values (e.g. "$1.234,00"); the prominent
 * numeral renders with tabular figures per styles.md.
 */
@Composable
fun LbMetricCarousel(
    pages: List<LbMetricPage>,
    modifier: Modifier = Modifier,
) {
    val colors = LocalAppColors.current
    val pagerState = rememberPagerState(pageCount = { pages.size })
    LbCard(modifier = modifier) {
        HorizontalPager(state = pagerState, modifier = Modifier.fillMaxWidth()) { page ->
            MetricPageContent(page = pages[page])
        }
        if (pages.size > 1) {
            Row(
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = AppDimens.SpacingMd),
            ) {
                pages.indices.forEach { index ->
                    val selected = pagerState.currentPage == index
                    Box(
                        modifier = Modifier
                            .padding(horizontal = 3.dp)
                            .size(width = if (selected) 16.dp else 6.dp, height = 6.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(
                                if (selected) colors.primary else colors.textMuted.copy(alpha = 0.3f),
                            ),
                    )
                }
            }
        }
    }
}

@Composable
private fun MetricPageContent(page: LbMetricPage) {
    val colors = LocalAppColors.current
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(AppDimens.SpacingLg),
        modifier = Modifier
            .fillMaxWidth()
            // Read label + value + subline as one block for TalkBack.
            .semantics(mergeDescendants = true) {},
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(page.ink.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = page.icon,
                contentDescription = null,
                tint = page.ink,
                modifier = Modifier.size(22.dp),
            )
        }
        Column(Modifier.weight(1f)) {
            Text(
                text = page.label,
                fontSize = 13.sp,
                color = colors.textMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = page.value,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = page.ink,
                style = TextStyle(fontFeatureSettings = "tnum"),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 2.dp),
            )
            if (page.subline != null) {
                Text(
                    text = page.subline,
                    fontSize = 12.sp,
                    color = colors.textMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
    }
}
