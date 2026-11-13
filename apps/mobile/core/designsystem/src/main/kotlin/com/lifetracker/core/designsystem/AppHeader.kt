package com.lifetracker.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lifetracker.core.i18n.I18n

/**
 * Top app bar: title left, profile avatar right (M3 convention). Primary
 * navigation lives in the app-host bottom navigation bar; the title carries
 * the screen name instead of the app brand (the brand is the launcher).
 * Used by every main screen; sub-screens (backup, public profile) render
 * their own back-navigation headers.
 */

/** Header row height (RN `HEADER_HEIGHT` = 56). */
private val HeaderHeight = 56.dp

@Composable
fun AppHeader(
    title: String,
    onProfile: () -> Unit = {},
    /** Optional trailing actions (before the profile avatar), e.g. the
     *  finance screens' dashboard/transactions cross-links. */
    actions: @Composable RowScope.() -> Unit = {},
) {
    val colors = LocalAppColors.current
    Column(modifier = Modifier.background(colors.background).statusBarsPadding()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(HeaderHeight - 1.dp)
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = title,
                fontSize = 20.sp,
                color = colors.foreground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            actions()
            // Profile entry point on every screen.
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = onProfile,
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Outlined.AccountCircle,
                    contentDescription = I18n.t("nav.profile"),
                    tint = colors.primary,
                    modifier = Modifier.size(24.dp),
                )
            }
        }
        HorizontalDivider(thickness = 1.dp, color = colors.border)
    }
}
