package com.lifetracker.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Row of the active filter values + "Clear all" action (web filter-chips
 * parity): one bordered 12sp chip per label, then a primary-tinted clear
 * control with an × icon. Replaces per-screen "Filters (n)" fourth chips.
 */
@Composable
fun LbFilterChipsRow(
    labels: List<String>,
    clearLabel: String,
    onClear: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = LocalAppColors.current
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = modifier.fillMaxWidth(),
    ) {
        labels.forEach { label ->
            Text(
                text = label,
                fontSize = 12.sp,
                color = colors.textMuted,
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .border(1.dp, colors.border, RoundedCornerShape(6.dp))
                    .padding(horizontal = 8.dp, vertical = 2.dp),
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(2.dp),
            modifier = Modifier
                .heightIn(min = 32.dp)
                .clip(RoundedCornerShape(6.dp))
                .clickable(onClick = onClear)
                .padding(horizontal = 8.dp),
        ) {
            Icon(
                imageVector = Icons.Outlined.Close,
                contentDescription = null,
                tint = colors.primary,
                modifier = Modifier.size(12.dp),
            )
            Text(
                text = clearLabel,
                fontSize = 12.sp,
                color = colors.primary,
            )
        }
    }
}
