package com.lifetracker.core.designsystem

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Menu
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import com.lifetracker.core.i18n.I18n

/**
 * Port of `apps/mobile/components/navigation.tsx`: top app bar with a
 * hamburger + slide-down navigation drawer (no bottom tabs, parity with the
 * RN/web mobile navigation).
 */

/** One navigation destination in the hamburger panel. */
data class NavEntry(val key: String, val label: String, val icon: ImageVector)

/** Header row height (RN `HEADER_HEIGHT` = 56). */
private val HeaderHeight = 56.dp

/**
 * Header layout: hamburger left, title centered, `actions` right. The
 * hamburger toggles a full-height dimmed scrim + slide-down panel right below
 * the header; the entry matching `currentKey` is highlighted (primary tint).
 * Provide [items] with already-translated labels (RN resolved them via i18n).
 */
@Composable
fun AppHeader(
    title: String,
    items: List<NavEntry>,
    currentKey: String?,
    onNavigate: (String) -> Unit,
    actions: @Composable RowScope.() -> Unit = {},
) {
    var menuOpen by rememberSaveable { mutableStateOf(false) }
    val density = LocalDensity.current
    val colors = LocalAppColors.current

    // Header row (56px incl. 1px bottom border).
    Column(modifier = Modifier.height(HeaderHeight)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .background(colors.background)
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = { menuOpen = !menuOpen },
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = if (menuOpen) Icons.Outlined.Close else Icons.Outlined.Menu,
                    contentDescription = I18n.t(if (menuOpen) "nav.closeMenu" else "nav.openMenu"),
                    tint = colors.textMuted,
                    modifier = Modifier.size(20.dp),
                )
            }
            Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                Text(
                    title,
                    fontSize = 20.sp,
                    color = colors.foreground,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                content = actions,
            )
        }
        HorizontalDivider(thickness = 1.dp, color = colors.border)
    }

    if (menuOpen) {
        Popup(
            alignment = Alignment.TopStart,
            offset = with(density) { IntOffset(0, HeaderHeight.roundToPx()) },
            onDismissRequest = { menuOpen = false },
            properties = PopupProperties(focusable = true),
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                // Dimmed scrim below the header; tap anywhere to close.
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.4f))
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = { menuOpen = false },
                        ),
                )
                // Subtle slide-down/fade-in on open (RN opened instantly; Compose eases it in).
                val progress = remember { Animatable(0f) }
                LaunchedEffect(Unit) {
                    progress.animateTo(1f, animationSpec = tween(durationMillis = 200))
                }
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .graphicsLayer {
                            alpha = (0.6f + 0.4f * progress.value)
                            translationY = -(24.dp.toPx()) * (1f - progress.value)
                        }
                        .background(colors.background),
                ) {
                        items.forEach { item ->
                            val active = item.key == currentKey
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(
                                        if (active) {
                                            colors.primary.copy(alpha = 0.1f)
                                        } else {
                                            androidx.compose.ui.graphics.Color.Transparent
                                        }
                                    )
                                    .clickable {
                                        menuOpen = false
                                        onNavigate(item.key)
                                    }
                                    .padding(horizontal = 24.dp, vertical = 12.dp),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(
                                    imageVector = item.icon,
                                    contentDescription = null,
                                    tint = if (active) colors.primary else colors.textMuted,
                                    modifier = Modifier.size(20.dp),
                                )
                                Text(
                                    item.label,
                                    fontSize = 14.sp,
                                    fontWeight = androidx.compose.ui.text.font.FontWeight.Medium,
                                    color = if (active) colors.primary else colors.textMuted,
                                )
                            }
                        }
                        HorizontalDivider(thickness = 1.dp, color = colors.border)
                    }
                }
            }
        }
    }
