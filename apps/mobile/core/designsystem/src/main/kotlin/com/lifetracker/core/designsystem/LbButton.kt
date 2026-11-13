package com.lifetracker.core.designsystem

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Button variants mirroring RN `components/ui/button.tsx`
 * (`default` -> PRIMARY, `outline` -> SECONDARY, `destructive` -> DANGER, `ghost` -> GHOST).
 */
enum class LbButtonVariant { PRIMARY, SECONDARY, DANGER, GHOST }

/**
 * Solid-sage/outline/danger/ghost button: 44px tall, rounded-lg (8px), medium 16px label.
 * Loading state matches RN: button disables and dims to 50% opacity (no inline spinner).
 */
@Composable
fun LbButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: LbButtonVariant = LbButtonVariant.PRIMARY,
    enabled: Boolean = true,
    loading: Boolean = false,
) {
    val colors = LocalAppColors.current
    val ready = enabled && !loading

    val baseColor = when (variant) {
        LbButtonVariant.PRIMARY -> colors.primary
        LbButtonVariant.DANGER -> colors.danger
        // Secondary (outline) and ghost keep a transparent background; secondary draws a border.
        LbButtonVariant.SECONDARY, LbButtonVariant.GHOST -> Color.Transparent
    }
    val contentColor = when (variant) {
        LbButtonVariant.PRIMARY, LbButtonVariant.DANGER -> colors.primaryForeground
        LbButtonVariant.SECONDARY -> colors.foreground
        LbButtonVariant.GHOST -> colors.primary
    }
    val backgroundColor by animateColorAsState(baseColor, label = "buttonContainer")

    Box(
        modifier = modifier
            .height(44.dp)
            .alpha(if (ready) 1f else 0.5f)
            .clip(RoundedCornerShape(8.dp))
            .background(backgroundColor)
            .then(
                if (variant == LbButtonVariant.SECONDARY) {
                    Modifier.border(1.dp, colors.border, RoundedCornerShape(8.dp))
                } else {
                    Modifier
                }
            )
            .clickable(enabled = ready, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.material3.Text(
            text = text,
            color = contentColor,
            fontSize = 16.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 16.dp),
        )
    }
}
