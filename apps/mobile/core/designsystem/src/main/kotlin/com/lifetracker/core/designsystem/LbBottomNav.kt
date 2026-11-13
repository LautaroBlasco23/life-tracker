package com.lifetracker.core.designsystem

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.MonitorHeart
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.StickyNote2
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material.icons.outlined.Wallet
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lifetracker.core.i18n.I18n

/** One navigation destination (route key + localized label + icon). */
data class NavEntry(val key: String, val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector)

/**
 * The five bottom-nav destinations, declared once (route keys match the
 * AppHost `Routes` string values; the finance tab targets the transactions
 * screen). Composable so labels re-resolve on runtime language switches.
 */
@Composable
fun mainNavTabs(): List<NavEntry> = listOf(
    NavEntry("activities", I18n.t("nav.activities"), Icons.Outlined.MonitorHeart),
    NavEntry("time", I18n.t("nav.time"), Icons.Outlined.Timer),
    NavEntry("notes", I18n.t("nav.notes"), Icons.Outlined.StickyNote2),
    NavEntry("finance/transactions", I18n.t("nav.finance"), Icons.Outlined.Wallet),
    NavEntry("social", I18n.t("nav.social"), Icons.Outlined.People),
)

/**
 * M3 bottom navigation bar: five primary destinations (activities, time,
 * notes, finance, social), replacing the RN hamburger drawer. Surface
 * background with a 1px top border (borders over shadows), 22dp outlined
 * icons + labels, sage primary for the selected tab.
 */
@Composable
fun LbBottomNav(
    items: List<NavEntry>,
    currentKey: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = LocalAppColors.current
    Column(modifier) {
        HorizontalDivider(thickness = 1.dp, color = colors.border)
        NavigationBar(containerColor = colors.surface, tonalElevation = 0.dp) {
            items.forEach { item ->
                val selected = item.key == currentKey
                NavigationBarItem(
                    selected = selected,
                    onClick = { onSelect(item.key) },
                    icon = {
                        Icon(
                            imageVector = item.icon,
                            contentDescription = null,
                            tint = if (selected) colors.primary else colors.textMuted,
                            modifier = Modifier.size(22.dp),
                        )
                    },
                    label = {
                        Text(
                            text = item.label,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            color = if (selected) colors.primary else colors.textMuted,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = colors.primary,
                        selectedTextColor = colors.primary,
                        unselectedIconColor = colors.textMuted,
                        unselectedTextColor = colors.textMuted,
                        indicatorColor = colors.primary.copy(alpha = 0.12f),
                    ),
                )
            }
        }
    }
}
