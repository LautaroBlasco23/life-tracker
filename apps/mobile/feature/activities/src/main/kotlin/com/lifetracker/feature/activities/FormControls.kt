package com.lifetracker.feature.activities

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lifetracker.core.designsystem.LocalAppColors

/**
 * Chip/checkbox building blocks shared by the activity form, routines modal
 * and templates modal (RN `Pressable` chips + bordered checkbox rows). Kept
 * feature-local so the DS only holds the cross-screen primitives.
 */

/** Wrapping horizontal row of chips (RN `flex-row flex-wrap gap-2`). */
@Composable
internal fun ChipRow(
    modifier: Modifier = Modifier,
    content: @Composable RowScope.() -> Unit,
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        content = content,
    )
}

/** Selectable bordered chip (`px-3 py-2 rounded-lg border`, primary when on). */
@Composable
internal fun LbSelectableChip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val colors = LocalAppColors.current
    val shape = RoundedCornerShape(8.dp)
    Box(
        modifier = Modifier
            .clip(shape)
            .background(if (selected) colors.primary else Color.Transparent)
            .border(
                1.dp,
                if (selected) colors.primary else colors.border,
                shape,
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Text(
            text = text,
            fontSize = 14.sp,
            color = if (selected) colors.primaryForeground else colors.textMuted,
        )
    }
}

/** Small status-filter/category chip (`h-7 px-2.5`): used by routines/templates. */
@Composable
internal fun LbSmallChip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val colors = LocalAppColors.current
    val shape = RoundedCornerShape(8.dp)
    Box(
        modifier = Modifier
            .clip(shape)
            .background(if (selected) colors.primary else Color.Transparent)
            .border(
                1.dp,
                if (selected) colors.primary else colors.border,
                shape,
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(
            text = text,
            fontSize = 12.sp,
            color = if (selected) colors.primaryForeground else colors.textMuted,
        )
    }
}

/** Bordered checkbox row with hint text (RN's rounded `h-5 w-5` check rows). */
@Composable
internal fun LbCheckboxRow(
    checked: Boolean,
    onToggle: () -> Unit,
    label: String,
    hint: String? = null,
) {
    val colors = LocalAppColors.current
    val shape = RoundedCornerShape(12.dp)
    Box(
        modifier = Modifier
            .clip(shape)
            .border(1.dp, colors.border, shape)
            .padding(12.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onToggle,
            ),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(if (checked) colors.primary else Color.Transparent)
                    .border(1.dp, if (checked) colors.primary else colors.border, RoundedCornerShape(4.dp)),
                contentAlignment = Alignment.Center,
            ) {
                if (checked) {
                    Icon(
                        imageVector = Icons.Filled.Check,
                        contentDescription = null,
                        tint = colors.primaryForeground,
                        modifier = Modifier.size(14.dp),
                    )
                }
            }
            Text(
                text = label,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = colors.foreground,
            )
        }
        if (hint != null) {
            Text(
                text = hint,
                fontSize = 12.sp,
                color = colors.textMuted,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}
