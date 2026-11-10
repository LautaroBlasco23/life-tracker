package com.lifetracker.feature.activities

import kotlinx.serialization.json.Json
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lifetracker.core.designsystem.LbStreakBadge
import com.lifetracker.core.designsystem.LocalAppColors
import com.lifetracker.core.i18n.I18n
import com.lifetracker.core.network.model.ActivityResponse
import com.lifetracker.core.network.model.DayTime
import com.lifetracker.core.network.model.Frequency

/**
 * Feature-local activities list visuals, mirroring RN
 * `components/ui/activity-card.tsx` and the plain per-category group headers
 * rendered by `app/(app)/activities.tsx` (not the web CategoryHeader, which
 * the RN screen does not use).
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

/** Group header: `text-sm font-medium text-muted` above each non-empty category. */
@Composable
internal fun GroupHeader(label: String) {
    val colors = LocalAppColors.current
    Text(
        text = label,
        fontSize = 14.sp,
        fontWeight = FontWeight.Medium,
        color = colors.textMuted,
        modifier = Modifier.padding(bottom = 8.dp),
    )
}

/**
 * One activity card: title/description, frequency + weekly-days chips,
 * `n/m` progress and streak badge. Tapping records a completion; long-press
 * opens the Edit / Revert last / Delete menu (RN parity).
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
            .background(colors.surface)
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
            Column(Modifier.weight(1f)) {
                Text(
                    text = activity.title,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    color = colors.foreground,
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
            }
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
