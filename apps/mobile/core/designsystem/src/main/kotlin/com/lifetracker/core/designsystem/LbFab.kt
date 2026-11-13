package com.lifetracker.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp

/**
 * Primary create action: 56dp primary-tinted circle with elevation and a
 * 24dp icon (M3 FAB shape without the M3 defaults, so the palette controls
 * the color). App-root convention: one FAB per screen for the create flow.
 */
@Composable
fun LbFab(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = LocalAppColors.current
    val shape = RoundedCornerShape(28.dp)
    Box(
        modifier = modifier
            .size(56.dp)
            .shadow(elevation = 6.dp, shape = shape, clip = false)
            .clip(shape)
            .background(colors.primary)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = colors.primaryForeground,
            modifier = Modifier.size(24.dp),
        )
    }
}
