package com.lifetracker.feature.activities

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Undo
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lifetracker.core.designsystem.LocalAppColors
import com.lifetracker.core.i18n.I18n
import com.lifetracker.core.network.model.ReminderResponse
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * Port of `components/reminder/reminder-card.tsx` + the shared reminder type
 * helpers the RN screen re-derives from the 30 s `now` clock.
 */

/** `ReminderStatus` from `packages/shared/src/types/reminder.ts`. */
internal enum class ReminderStatus { LOCKED, ACTIVE, MISSED, COMPLETED }

private val BUCKET_ORDER = listOf(
    ReminderStatus.MISSED, // overdue
    ReminderStatus.ACTIVE,
    ReminderStatus.LOCKED, // upcoming
    ReminderStatus.COMPLETED,
)

/**
 * `getReminderStatus(reminder, now)`: completed wins, then the hard deadline
 * (`dueAt`) turns into missed, then `activeFrom` gates completion as locked.
 */
internal fun reminderStatus(
    reminder: ReminderResponse,
    now: ZonedDateTime,
    zone: ZoneId = ZoneId.systemDefault(),
): ReminderStatus {
    if (reminder.completedAt != null) return ReminderStatus.COMPLETED
    val due = parseJsDate(reminder.dueAt, zone) ?: return ReminderStatus.ACTIVE
    if (now > due) return ReminderStatus.MISSED
    val activeFrom = reminder.activeFrom?.let { parseJsDate(it, zone) }
    if (activeFrom != null && now < activeFrom) return ReminderStatus.LOCKED
    return ReminderStatus.ACTIVE
}

/** Orders reminders overdue → active → upcoming → completed (stable, RN parity). */
internal fun sortReminders(reminders: List<ReminderResponse>, now: ZonedDateTime): List<ReminderResponse> =
    reminders.sortedBy { reminder -> BUCKET_ORDER.indexOf(reminderStatus(reminder, now)) }

/**
 * One-time event card hosted inside the Activities screen: missed/locked/
 * active/completed states with badges + countdown, tap-to-complete (or
 * revert), undo icon on completed, long-press for the context menu.
 */
@Composable
internal fun ReminderCard(
    reminder: ReminderResponse,
    now: ZonedDateTime,
    processing: Boolean,
    onComplete: () -> Unit,
    onRevert: () -> Unit,
    onLongPress: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = LocalAppColors.current
    val status = reminderStatus(reminder, now)
    val isCompleted = status == ReminderStatus.COMPLETED
    val completable = status == ReminderStatus.ACTIVE || status == ReminderStatus.MISSED
    val shape = RoundedCornerShape(12.dp)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .alpha(if (processing) 0.6f else if (isCompleted) 0.7f else 1f)
            .clip(shape)
            .background(colors.surface)
            .border(
                1.dp,
                if (completable && !isCompleted) colors.success.copy(alpha = 0.5f)
                else colors.border,
                shape,
            )
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = {
                    when {
                        completable -> onComplete()
                        isCompleted -> onRevert()
                        else -> {}
                    }
                },
            )
            .padding(16.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.weight(1f)) {
                Text(
                    text = reminder.title,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    color = if (isCompleted) colors.textMuted else colors.foreground,
                    textDecoration = if (isCompleted) TextDecoration.LineThrough else null,
                )
                if (reminder.description.isNotEmpty()) {
                    Text(
                        text = reminder.description,
                        fontSize = 14.sp,
                        color = colors.textMuted,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                StatusBadges(reminder, status)
                CountdownLine(reminder, status, now)
            }
            if (isCompleted) {
                Icon(
                    imageVector = Icons.Outlined.Undo,
                    contentDescription = I18n.t("reminders.revertCompletion"),
                    tint = colors.textMuted,
                    modifier = Modifier
                        .size(18.dp)
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = onRevert,
                        ),
                )
            } else if (completable) {
                Icon(
                    imageVector = Icons.Filled.Check,
                    contentDescription = null,
                    tint = colors.primary,
                    modifier = Modifier.size(20.dp),
                )
            }
        }
    }
}

/** The conditional status chips row of the RN card. */
@Composable
private fun StatusBadges(reminder: ReminderResponse, status: ReminderStatus) {
    val colors = LocalAppColors.current
    val dueDate = parseJsDate(reminder.dueAt)

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (status == ReminderStatus.MISSED && dueDate != null) {
            LbChip(text = I18n.t("reminders.statusMissed") + " · " + I18n.t("reminders.expired", "date" to formatDateTime(dueDate)))
        }
        if (status == ReminderStatus.LOCKED) {
            val opensText = reminder.activeFrom
                ?.let { parseJsDate(it) }
                ?.let { " · " + I18n.t("reminders.opensAt", "date" to formatDateTime(it)) }
                ?: ""
            LbChip(text = I18n.t("reminders.statusLocked") + opensText)
        }
        if (status == ReminderStatus.ACTIVE && dueDate != null) {
            LbChip(text = I18n.t("reminders.dueBy", "date" to formatDateTime(dueDate)))
        }
        if (status == ReminderStatus.COMPLETED) {
            val completed = reminder.completedAt?.let { parseJsDate(it) }
            val due2 = parseJsDate(reminder.dueAt)
            if (completed != null && due2 != null && completed > due2) {
                LbChip(text = I18n.t("reminders.completedLate"))
            }
        }
    }
}

/** The clock + countdown line (`locked` counts to open, `active` to deadline). */
@Composable
private fun CountdownLine(reminder: ReminderResponse, status: ReminderStatus, now: ZonedDateTime) {
    val colors = LocalAppColors.current
    val target = when (status) {
        ReminderStatus.LOCKED -> reminder.activeFrom?.let { parseJsDate(it) }
        ReminderStatus.ACTIVE -> parseJsDate(reminder.dueAt)
        else -> null
    } ?: return
    val remaining = java.time.Duration.between(now, target).toMillis()
    if (remaining <= 0) return

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.padding(top = 4.dp),
    ) {
        Icon(
            imageVector = Icons.Outlined.Schedule,
            contentDescription = null,
            tint = colors.textMuted,
            modifier = Modifier.size(14.dp),
        )
        Text(
            text = if (status == ReminderStatus.LOCKED) {
                I18n.t("reminders.opensAt", "date" to formatDateTime(target))
            } else {
                I18n.t("reminders.dueBy", "date" to formatDateTime(target))
            },
            fontSize = 14.sp,
            color = colors.textMuted,
        )
        Text(
            text = formatRemaining(remaining),
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = colors.foreground,
        )
    }
}
