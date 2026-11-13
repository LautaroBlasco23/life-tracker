package com.lifetracker.feature.activities

import kotlinx.serialization.json.Json
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.WbCloudy
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lifetracker.core.designsystem.LbProgressBar
import com.lifetracker.core.designsystem.LbStreakBadge
import com.lifetracker.core.designsystem.LocalAppColors
import com.lifetracker.core.i18n.I18n
import com.lifetracker.core.network.model.ActivityResponse
import com.lifetracker.core.network.model.DayTime
import com.lifetracker.core.network.model.Frequency

/**
 * Feature-local activities list visuals, mirroring RN
 * `components/ui/activity-card.tsx`. Section identity (icons + accent colors)
 * ports the web `CATEGORY_CONFIG` from `app/activities/page.tsx` and renders
 * through the shared design-system [LbCategoryHeader].
 */

/** Wire/raw value of a [Frequency] (`DAILY` → "daily", matches enums.kt). */
internal val Frequency.wire: String
    get() = when (this) {
        Frequency.DAILY -> "daily"
        Frequency.WEEKLY -> "weekly"
        Frequency.MONTHLY -> "monthly"
    }

/** Wire/raw value of a [DayTime] (`NOT_SPECIFIED` → "notSpecified"). */
internal val DayTime.wire: String
    get() = when (this) {
        DayTime.NOT_SPECIFIED -> "notSpecified"
        DayTime.MORNING -> "morning"
        DayTime.AFTERNOON -> "afternoon"
        DayTime.EVENING -> "evening"
    }

/** Localized frequency/time-of-day label: `t('activities').<wire>`. */
internal fun activityLabel(raw: String): String = I18n.t("activities.$raw")

/** Localized day name for chips: `t('createActivity').<day>`. */
internal fun dayLabel(day: String): String = I18n.t("createActivity.$day")

private val json = Json { ignoreUnknownKeys = true }

/** `JSON.parse(activity.dayFrequency)` → day-name list; null when absent/broken. */
internal fun parseDayFrequency(dayFrequency: String?): List<String>? {
    if (dayFrequency == null) return null
    return runCatching { json.decodeFromString<List<String>>(dayFrequency) }.getOrNull()
}

/** Identity of one day-time section: icon + accent token + localized copy. */
internal data class SectionSpec(
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val accent: androidx.compose.ui.graphics.Color,
    val label: String,
    val tagline: String,
)

/**
 * Day-time section identity (web `CATEGORY_CONFIG` parity): icon + accent
 * token + localized label and tagline. `raw` is the wire day-time value;
 * the reminders section passes "reminders".
 */
@Composable
internal fun sectionSpec(raw: String): SectionSpec {
    val colors = LocalAppColors.current
    return when (raw) {
        "morning" -> SectionSpec(
            icon = Icons.Outlined.LightMode,
            accent = colors.sectionMorning,
            label = activityLabel("morning"),
            tagline = I18n.t("activities.startYourDay"),
        )
        "afternoon" -> SectionSpec(
            icon = Icons.Outlined.WbCloudy,
            accent = colors.sectionAfternoon,
            label = activityLabel("afternoon"),
            tagline = I18n.t("activities.keepMomentum"),
        )
        "evening" -> SectionSpec(
            icon = Icons.Outlined.DarkMode,
            accent = colors.sectionEvening,
            label = activityLabel("evening"),
            tagline = I18n.t("activities.windDown"),
        )
        "reminders" -> SectionSpec(
            icon = Icons.Outlined.Notifications,
            accent = colors.sectionEvening,
            label = I18n.t("reminders.title"),
            tagline = I18n.t("reminders.description"),
        )
        else -> SectionSpec(
            icon = Icons.Outlined.Schedule,
            accent = colors.sectionAnytime,
            label = I18n.t("activities.anyMoment"),
            tagline = I18n.t("activities.flexibleTiming"),
        )
    }
}

/** "5 activities" / "1 activity" hint for a section header. */
internal fun activityCountHint(count: Int): String =
    if (count == 1) I18n.t("common.activityCountOne")
    else I18n.t("common.activityCount", "count" to count)

/** "5 reminders" / "1 reminder" hint for the reminders section header. */
internal fun reminderCountHint(count: Int): String =
    if (count == 1) I18n.t("common.reminderCountOne")
    else I18n.t("common.reminderCount", "count" to count)

/**
 * One activity card (web `EntityCard` parity): leading circular checkbox,
 * title/description, frequency + weekly-days chips, trailing `n/m` counter,
 * streak badge and a visible `⋯` overflow button (long-press kept as the
 * power-user shortcut to the same menu). Tapping the card or the checkbox
 * records a completion; the bottom progress bar fills with `primary`.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun ActivityCard(
    activity: ActivityResponse,
    isProcessing: Boolean,
    onPress: () -> Unit,
    onLongPress: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = LocalAppColors.current
    val done = activity.isCompletedToday
    val weeklyDays = parseDayFrequency(activity.dayFrequency)
    val shape = RoundedCornerShape(12.dp)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .alpha(if (isProcessing) 0.6f else 1f)
            .clip(shape)
            .background(if (done) colors.success.copy(alpha = 0.08f) else colors.surface)
            .border(
                1.dp,
                if (done) colors.success.copy(alpha = 0.6f) else colors.border,
                shape,
            )
            .combinedClickable(
                onClick = onPress,
                onLongClick = onLongPress,
            )
            .padding(16.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            CompleteCheckbox(
                done = done,
                onPress = onPress,
            )
            Column(Modifier.weight(1f)) {
                Text(
                    text = activity.title,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    color = if (done) colors.success else colors.foreground,
                )
                if (activity.description.isNotEmpty()) {
                    Text(
                        text = activity.description,
                        fontSize = 14.sp,
                        color = colors.textMuted,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(top = 8.dp),
                ) {
                    LbChip(text = activityLabel(activity.frequency.wire))
                }
                if (activity.frequency == Frequency.WEEKLY && weeklyDays != null) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(top = 8.dp),
                    ) {
                        LbChip(text = weeklyDays.joinToString(", ") { day -> dayLabel(day) })
                    }
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                val streak = activity.streak
                Text(
                    text = "${activity.todayCompletions}/${activity.completionAmount}",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (done) colors.success else colors.foreground,
                )
                if (streak != null && streak.current > 0) {
                    LbStreakBadge(
                        streak = streak,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                // Visible overflow menu (web EntityDropdown parity); opens the
                // same Edit / Revert last / Delete dialog as the long-press.
                Box(
                    modifier = Modifier
                        .padding(top = 4.dp)
                        .size(32.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .clickable(onClick = onLongPress),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Outlined.MoreVert,
                        contentDescription = I18n.t("common.moreOptions"),
                        tint = colors.textMuted,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
        }
        LbProgressBar(
            value = activity.todayCompletions * 100 / activity.completionAmount.coerceAtLeast(1),
            modifier = Modifier.padding(top = 12.dp),
        )
    }
}

/**
 * Leading completion checkbox (web: completion state badge + whole-card tap;
 * mobile gets the explicit affordance). 24dp circle: success fill + white
 * check when done, otherwise a muted outline. Tapping it completes too.
 */
@Composable
private fun CompleteCheckbox(done: Boolean, onPress: () -> Unit) {
    val colors = LocalAppColors.current
    Box(
        modifier = Modifier
            .size(24.dp)
            .clip(CircleShape)
            .background(if (done) colors.success else Color.Transparent)
            .border(2.dp, if (done) colors.success else colors.textMuted, CircleShape)
            .clickable(onClick = onPress),
        contentAlignment = Alignment.Center,
    ) {
        if (done) {
            Icon(
                imageVector = Icons.Filled.Check,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(16.dp),
            )
        }
    }
}

/** Grain of the RN chips: `rounded-md border px-2 py-0.5 text-xs text-muted`. */
@Composable
internal fun LbChip(text: String, modifier: Modifier = Modifier) {
    val colors = LocalAppColors.current
    val shape = RoundedCornerShape(6.dp)
    Text(
        text = text,
        fontSize = 12.sp,
        color = colors.textMuted,
        modifier = modifier
            .clip(shape)
            .border(1.dp, colors.border, shape)
            .padding(horizontal = 8.dp, vertical = 2.dp),
    )
}
