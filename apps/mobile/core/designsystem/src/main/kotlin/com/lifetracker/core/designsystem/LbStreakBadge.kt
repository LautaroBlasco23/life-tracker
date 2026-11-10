package com.lifetracker.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.outlined.LocalFireDepartment
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lifetracker.core.network.model.StreakInfo

/**
 * Port of RN `components/ui/streak-badge.tsx`: flame badge with visual tiers —
 * warm >= 3, hot >= 7, on-fire >= 30. Amber intensity grows with the streak;
 * filled flame from warm up, warning ink otherwise, muted at zero.
 *
 * Hidden at zero unless `showZero` (RN semantics; `null` streak counts as zero).
 * Only `current` is displayed (same as the RN badge); `longest` is available to callers.
 */
@Composable
fun LbStreakBadge(
    streak: StreakInfo?,
    modifier: Modifier = Modifier,
    showZero: Boolean = false,
) {
    val current = streak?.current ?: 0
    if (current == 0 && !showZero) return

    val colors = LocalAppColors.current
    val isWarm = current >= 3
    val isHot = current >= 7
    val isOnFire = current >= 30

    // Calm, token-driven tiers (styles.md): amber intensity grows; no gradients.
    val background = when {
        isOnFire -> colors.secondary
        isHot -> colors.secondary.copy(alpha = 0.15f)
        isWarm -> colors.secondary.copy(alpha = 0.10f)
        else -> colors.textMuted
    }
    val ink = when {
        isOnFire -> colors.secondaryForeground
        isWarm || isHot -> colors.warning
        else -> colors.textMuted
    }
    Row(
        modifier = modifier
            .clip(CircleShape)
            .background(background)
            .padding(horizontal = 8.dp, vertical = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            // Material stand-in for lucide `Flame`: filled variant once warm (fill='currentColor').
            imageVector = if (isWarm) Icons.Filled.LocalFireDepartment else Icons.Outlined.LocalFireDepartment,
            contentDescription = null,
            tint = ink,
            modifier = Modifier.size(16.dp),
        )
        Text(
            text = "×$current",
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = ink,
        )
    }
}
