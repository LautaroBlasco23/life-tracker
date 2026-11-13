package com.lifetracker.feature.time

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.graphics.vector.ImageVector
import com.lifetracker.core.designsystem.LbButton
import com.lifetracker.core.designsystem.LbButtonVariant
import com.lifetracker.core.designsystem.LbOptionSelect
import com.lifetracker.core.designsystem.LbSelectOption
import com.lifetracker.core.designsystem.LocalAppColors
import com.lifetracker.core.designsystem.ToastState
import com.lifetracker.core.i18n.I18n
import com.lifetracker.core.network.model.CalendarEventResponse
import com.lifetracker.core.network.model.EventScope
import com.lifetracker.domain.lib.calendarweek.formatDayHeading
import com.lifetracker.domain.lib.calendarweek.formatTimeRange
import com.lifetracker.domain.lib.calendarweek.formatWeekLabel
import com.lifetracker.domain.lib.calendarweek.formatWeekday
import com.lifetracker.domain.lib.calendarweek.getDayRange
import com.lifetracker.domain.lib.calendarweek.getWeekDays
import com.lifetracker.domain.lib.calendarweek.getWeekStart
import com.lifetracker.domain.lib.calendarweek.isSameDay
import com.lifetracker.domain.lib.calendarweek.isToday
import com.lifetracker.domain.lib.calendarweek.shiftWeek
import com.lifetracker.domain.lib.filters.categoryLabel
import com.lifetracker.domain.time.parseInstant
import java.time.ZoneId
import java.time.ZonedDateTime

/** Defaults for a freshly opened create form (RN constants). */
private const val DEFAULT_START_MINUTES = 9 * 60
private const val DEFAULT_DURATION_MINUTES = 60

/**
 * Calendar tab (mobile port of web's calendar-view): a 7-day strip for the
 * current week plus the agenda of the selected day.
 *
 * Tab-local state (week + selection) is `remember`ed so it resets when the
 * tabs switch — matching the RN remount of `<CalendarView />`.
 */
@Composable
internal fun CalendarTab(
    viewModel: TimeViewModel,
    view: TimeView,
    events: List<CalendarEventResponse>,
    isLoadingEvents: Boolean,
    eventsReloadKey: Int,
    toast: ToastState,
) {
    val colors = LocalAppColors.current
    val zone = remember { ZoneId.systemDefault() }

    var weekStart by remember { mutableStateOf(getWeekStart(ZonedDateTime.now())) }
    var selectedDay by remember { mutableStateOf(ZonedDateTime.now()) }
    val days = remember(weekStart) { getWeekDays(weekStart) }

    // RN `useFocusEffect`: reload on tab focus and on week / reloadKey change.
    LaunchedEffect(view, weekStart, eventsReloadKey) {
        if (view == TimeView.CALENDAR) {
            viewModel.loadEvents(weekStart)
        }
    }

    // Agenda of the selected day: overlapping events sorted by start instant.
    val dayEvents: List<CalendarEventResponse> = remember(events, selectedDay) {
        val range = getDayRange(selectedDay)
        events
            .filter { event ->
                val eventStart = parseInstant(event.startAt, zone)
                    ?.toInstant() ?: return@filter false
                val eventEnd = parseInstant(event.endAt, zone)?.toInstant() ?: return@filter false
                eventStart < range.end.toInstant() && eventEnd > range.start.toInstant()
            }
            .sortedBy { event -> parseInstant(event.startAt, zone)?.toInstant() }
    }

    var showFormModal by remember { mutableStateOf(false) }
    var editingEvent by remember { mutableStateOf<CalendarEventResponse?>(null) }
    var formDefaults by remember { mutableStateOf<CalendarEventDefaults?>(null) }
    var deletingEvent by remember { mutableStateOf<CalendarEventResponse?>(null) }
    var deleteScope by remember { mutableStateOf(EventScope.OCCURRENCE) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 96.dp),
    ) {
        item {
            Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                // ---- week navigation row ----
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp),
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        ChevronButton(
                            icon = TimeIcons.ChevronLeft,
                            contentDescription = I18n.t("calendar.previousWeek"),
                            onClick = {
                                val next = shiftWeek(weekStart, -1)
                                weekStart = next
                                selectedDay = next
                            },
                        )
                        LbButton(
                            text = I18n.t("calendar.today"),
                            onClick = {
                                val today = ZonedDateTime.now()
                                weekStart = getWeekStart(today)
                                selectedDay = today
                            },
                            variant = LbButtonVariant.SECONDARY,
                        )
                        ChevronButton(
                            icon = TimeIcons.ChevronRight,
                            contentDescription = I18n.t("calendar.nextWeek"),
                            onClick = {
                                val next = shiftWeek(weekStart, 1)
                                weekStart = next
                                selectedDay = next
                            },
                        )
                    }
                    LbButton(
                        text = I18n.t("calendar.newEvent"),
                        onClick = {
                            val dayInWeek = days.firstOrNull { isSameDay(it, selectedDay) } ?: selectedDay
                            editingEvent = null
                            formDefaults = CalendarEventDefaults(
                                date = dayInWeek,
                                startMinutes = DEFAULT_START_MINUTES,
                                endMinutes = DEFAULT_START_MINUTES + DEFAULT_DURATION_MINUTES,
                            )
                            showFormModal = true
                        },
                    )
                }

                Text(
                    formatWeekLabel(weekStart, currentIntlLocale),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = colors.foreground,
                    modifier = Modifier.padding(bottom = 12.dp),
                )

                // ---- 7-day picker strip (web's small-screen fallback) ----
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp),
                ) {
                    days.forEach { day ->
                        val selected = isSameDay(day, selectedDay)
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .then(
                                    if (selected) {
                                        Modifier
                                            .background(colors.primary)
                                            .border(1.dp, colors.primary, RoundedCornerShape(8.dp))
                                    } else {
                                        Modifier
                                            .border(1.dp, colors.border, RoundedCornerShape(8.dp))
                                            .background(colors.surface)
                                    }
                                )
                                .clickable(
                                    interactionSource = remember { MutableInteractionSource() },
                                    indication = null,
                                    onClick = { selectedDay = day },
                                )
                                .padding(horizontal = 4.dp, vertical = 8.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text(
                                formatWeekday(day, currentIntlLocale).uppercase(),
                                fontSize = 10.sp,
                                color = if (selected) colors.primaryForeground else colors.textMuted,
                                maxLines = 1,
                            )
                            Text(
                                day.dayOfMonth.toString(),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = when {
                                    selected -> colors.primaryForeground
                                    isToday(day) -> colors.primary
                                    else -> colors.foreground
                                },
                            )
                        }
                    }
                }

                Text(
                    formatDayHeading(selectedDay, currentIntlLocale),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = colors.foreground,
                    modifier = Modifier.padding(bottom = 12.dp),
                )
            }
        }

        when {
            dayEvents.isNotEmpty() -> {
                items(dayEvents.size) { index ->
                    val event = dayEvents[index]
                    AgendaEventCard(event = event, onClick = { editingEvent = event; showFormModal = true })
                    Spacer(Modifier.height(8.dp))
                }
            }
            else -> item {
                if (isLoadingEvents) {
                    Box(
                        modifier = Modifier.fillMaxWidth().height(120.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(color = colors.primary)
                    }
                } else {
                    EmptyAgenda(onNewEvent = {
                        val dayInWeek = days.firstOrNull { isSameDay(it, selectedDay) } ?: selectedDay
                        editingEvent = null
                        formDefaults = CalendarEventDefaults(
                            date = dayInWeek,
                            startMinutes = DEFAULT_START_MINUTES,
                            endMinutes = DEFAULT_START_MINUTES + DEFAULT_DURATION_MINUTES,
                        )
                        showFormModal = true
                    })
                }
            }
        }
    }

    EventFormModal(
        visible = showFormModal,
        onDismiss = {
            showFormModal = false
            editingEvent = null
            formDefaults = null
        },
        event = editingEvent,
        defaults = formDefaults,
        onCreate = viewModel::createEvent,
        onUpdate = viewModel::updateEvent,
        toast = toast,
        onRequestDelete = { event ->
            showFormModal = false
            editingEvent = null
            deletingEvent = event
            deleteScope = EventScope.OCCURRENCE
        },
    )

    val deleteTarget = deletingEvent
    DeleteModal(
        visible = deleteTarget != null,
        onDismiss = { deletingEvent = null },
        title = I18n.t("calendar.deleteEvent"),
        itemName = deleteTarget?.title ?: "",
        confirmLabel = I18n.t("calendar.deleteEventConfirm"),
        details = if (deleteTarget != null) {
            {
                DeleteEventDetails(event = deleteTarget, scope = deleteScope, onScopeChange = { deleteScope = it })
            }
        } else {
            null
        },
        onConfirm = {
            val target = deleteTarget ?: return@DeleteModal ""
            val error = viewModel.deleteEvent(target.id, if (target.seriesId != null) deleteScope else null)
            if (error == null) {
                toast.show(
                    toastText(I18n.t("calendar.eventDeleted"), I18n.t("calendar.eventDeletedDescription")),
                )
            } else {
                toast.show(toastText(I18n.t("calendar.failedToDelete"), error), isError = true)
            }
            error
        },
    )
}

/** Occurrence/series scope select shown only for series events (RN details). */
@Composable
private fun DeleteEventDetails(
    event: CalendarEventResponse,
    scope: EventScope,
    onScopeChange: (EventScope) -> Unit,
) {
    val colors = LocalAppColors.current
    Column {
        Text(event.title, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = colors.foreground)
        Text(
            "${categoryLabel({ key -> I18n.t("timeCategories.$key") }, event.category)} · ${formatTimeRange(event.startAt, event.endAt)}",
            fontSize = 12.sp,
            color = colors.textMuted,
            modifier = Modifier.padding(top = 4.dp),
        )
        if (event.seriesId != null) {
            LbOptionSelect(
                label = I18n.t("calendar.deleteScope"),
                options = listOf(
                    LbSelectOption(EventScope.OCCURRENCE, I18n.t("calendar.applyToOccurrence")),
                    LbSelectOption(EventScope.SERIES, I18n.t("calendar.applyToSeries")),
                ),
                selected = scope,
                onSelect = onScopeChange,
                placeholder = I18n.t("calendar.deleteScope"),
                modifier = Modifier.padding(top = 12.dp),
            )
        }
    }
}

/** 44dp outline chevron (touch-target token; was a 36dp h-9 port). */
@Composable
private fun ChevronButton(icon: ImageVector, contentDescription: String, onClick: () -> Unit) {
    val colors = LocalAppColors.current
    Box(
        modifier = Modifier
            .size(44.dp)
            .clip(RoundedCornerShape(8.dp))
            .border(1.dp, colors.border, RoundedCornerShape(8.dp))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = colors.foreground,
            modifier = Modifier.size(20.dp),
        )
    }
}

/** Single agenda card: accent bar, title, time range, description, chip. */
@Composable
private fun AgendaEventCard(event: CalendarEventResponse, onClick: () -> Unit) {
    val colors = LocalAppColors.current
    val accent = accentColor(categoryVisual(event.category).accent)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .padding(horizontal = 16.dp)
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .clip(RoundedCornerShape(12.dp))
            .border(1.dp, colors.border, RoundedCornerShape(12.dp))
            .background(colors.surface)
            .clickable(onClick = onClick)
            .padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .width(4.dp)
                .fillMaxHeight()
                .clip(RoundedCornerShape(50))
                .background(accent),
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(event.title, fontSize = 16.sp, fontWeight = FontWeight.Medium, color = colors.foreground)
            Text(
                formatTimeRange(event.startAt, event.endAt),
                fontSize = 12.sp,
                color = colors.textMuted,
                modifier = Modifier.padding(top = 2.dp),
            )
            if (event.description.isNotEmpty()) {
                Text(
                    event.description,
                    fontSize = 12.sp,
                    color = colors.textMuted,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            Box(
                modifier = Modifier
                    .padding(top = 8.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(colors.primary.copy(alpha = 0.1f))
                    .padding(horizontal = 8.dp, vertical = 2.dp),
            ) {
                Text(
                    categoryLabel({ key -> I18n.t("timeCategories.$key") }, event.category),
                    fontSize = 12.sp,
                    color = colors.primary,
                )
            }
        }
    }
}

/** Empty day state: icon + "no events" + New event button. */
@Composable
private fun EmptyAgenda(onNewEvent: () -> Unit) {
    val colors = LocalAppColors.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(CircleShape)
                .background(colors.surface),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = TimeIcons.CalendarX,
                contentDescription = null,
                tint = colors.textMuted,
                modifier = Modifier.size(28.dp),
            )
        }
        Text(
            I18n.t("calendar.noEventsForDay"),
            fontSize = 18.sp,
            fontWeight = FontWeight.Medium,
            color = colors.foreground,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Spacer(Modifier.height(16.dp))
        LbButton(
            text = I18n.t("calendar.newEvent"),
            onClick = onNewEvent,
            variant = LbButtonVariant.SECONDARY,
        )
    }
}
