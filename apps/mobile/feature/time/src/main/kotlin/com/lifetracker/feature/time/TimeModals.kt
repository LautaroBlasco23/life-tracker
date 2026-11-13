package com.lifetracker.feature.time

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lifetracker.core.designsystem.LbButton
import com.lifetracker.core.designsystem.LbButtonVariant
import com.lifetracker.core.designsystem.LbModalSheet
import com.lifetracker.core.designsystem.LbOptionSelect
import com.lifetracker.core.designsystem.LbSelectOption
import com.lifetracker.core.designsystem.LbTextField
import com.lifetracker.core.designsystem.LocalAppColors
import com.lifetracker.core.designsystem.ToastState
import com.lifetracker.core.i18n.I18n
import com.lifetracker.core.network.model.CalendarEventResponse
import com.lifetracker.core.network.model.CalendarRecurrenceRequest
import com.lifetracker.core.network.model.CreateCalendarEventRequest
import com.lifetracker.core.network.model.EventScope
import com.lifetracker.core.network.model.RecurrenceRule
import com.lifetracker.core.network.model.TimeRecordResponse
import com.lifetracker.core.network.model.UpdateCalendarEventRequest
import com.lifetracker.domain.lib.calendarweek.addDaysToDateValue
import com.lifetracker.domain.lib.calendarweek.combineDateAndTime
import com.lifetracker.domain.lib.calendarweek.isNextDayEnd
import com.lifetracker.domain.lib.calendarweek.isValidDateValue
import com.lifetracker.domain.lib.calendarweek.isValidTimeOfDay
import com.lifetracker.domain.lib.calendarweek.isWithinMaxDuration
import com.lifetracker.domain.lib.calendarweek.toDateInputValue
import com.lifetracker.domain.lib.calendarweek.toEndOfDayInstant
import com.lifetracker.domain.lib.filters.categoryLabel
import com.lifetracker.domain.lib.filters.monthYearOptions
import com.lifetracker.domain.time.parseInstant
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.coroutines.launch

/// ---------------------------------------------------------------------
/// Delete confirm — port of `components/ui/delete-modal.tsx` with a live
/// details slot (the fixed design-system variant cannot host the details
/// box / delete-scope select this screen needs).
/// ---------------------------------------------------------------------

@Composable
internal fun DeleteModal(
    visible: Boolean,
    onDismiss: () -> Unit,
    title: String,
    itemName: String,
    details: (@Composable () -> Unit)?,
    confirmLabel: String,
    onConfirm: suspend () -> String?,
) {
    if (!visible) return
    val colors = LocalAppColors.current
    var isDeleting by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(
            modifier = Modifier
                .padding(horizontal = 24.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(colors.background)
                .padding(20.dp),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(bottom = 16.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(colors.danger.copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = TimeIcons.Trash,
                        contentDescription = null,
                        tint = colors.danger,
                        modifier = Modifier.size(18.dp),
                    )
                }
                Column {
                    Text(title, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = colors.foreground)
                    Text(
                        I18n.t("deleteModal.cannotBeUndone"),
                        fontSize = 13.sp,
                        color = colors.textMuted,
                    )
                }
            }
            Text(
                t("deleteModal.areYouSure", "name" to itemName),
                fontSize = 14.sp,
                color = colors.textMuted,
                modifier = Modifier.padding(bottom = 12.dp),
            )
            if (details != null) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .border(1.dp, colors.border, RoundedCornerShape(8.dp))
                        .background(colors.surface)
                        .padding(12.dp),
                ) {
                    details()
                }
            }
            Row(
                modifier = Modifier.padding(top = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                LbButton(
                    text = I18n.t("common.cancel"),
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f),
                    variant = LbButtonVariant.SECONDARY,
                    enabled = !isDeleting,
                )
                LbButton(
                    text = confirmLabel,
                    onClick = {
                        if (!isDeleting) {
                            scope.launch {
                                isDeleting = true
                                val error = onConfirm()
                                isDeleting = false
                                // RN: `await onConfirm(); onClose()` — throws keep it open.
                                if (error == null) onDismiss()
                            }
                        }
                    },
                    modifier = Modifier.weight(1f),
                    variant = LbButtonVariant.DANGER,
                    enabled = !isDeleting,
                    loading = isDeleting,
                )
            }
        }
    }
}

/// ---------------------------------------------------------------------
/// Manual Log Time / edit entry form (RN `components/time/record-form-modal.tsx`).
/// ---------------------------------------------------------------------

@Composable
internal fun RecordFormModal(
    visible: Boolean,
    onDismiss: () -> Unit,
    /** Set when editing an existing entry; null creates a manual entry. */
    record: TimeRecordResponse?,
    onCreate: suspend (category: String, description: String, durationMinutes: Int) -> String?,
    onUpdate: suspend (id: Long, category: String, description: String, durationMinutes: Int) -> String?,
    toast: ToastState,
) {
    val isEdit = record != null
    val colors = LocalAppColors.current
    var category by remember { mutableStateOf<String?>(null) }
    var description by remember { mutableStateOf("") }
    var hours by remember { mutableStateOf("") }
    var minutes by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    // RN prefills on every open; empty for the create path.
    LaunchedEffect(visible) {
        if (visible) {
            if (record != null) {
                category = record.category
                description = record.description
                hours = (record.durationMinutes / 60).toString()
                minutes = (record.durationMinutes % 60).toString()
            } else {
                category = null
                description = ""
                hours = ""
                minutes = ""
            }
        }
    }

    LbModalSheet(visible = visible, onDismiss = onDismiss, title = if (isEdit) t("editEntry") else t("logTime")) {
        Column(
            // RN sheet capped at 90% of the screen; cap + scroll keeps the
            // Save/Cancel buttons reachable on small displays.
            modifier = Modifier
                .heightIn(max = 560.dp)
                .verticalScroll(rememberScrollState()),
        ) {
        LbOptionSelect(
            label = t("category"),
            options = TIME_CATEGORIES.map { cat -> LbSelectOption(cat, categoryLabel({ key -> I18n.t("timeCategories.$key") }, cat)) },
            selected = category,
            onSelect = { category = it },
            placeholder = t("selectCategory"),
        )
        Spacer(Modifier.height(16.dp))

        LbTextField(
            value = description,
            onValueChange = { description = it },
            label = t("description"),
            placeholder = t("whatAreYouWorkingOn"),
        )
        Spacer(Modifier.height(16.dp))

        Text(t("duration"), fontSize = 14.sp, color = colors.foreground, modifier = Modifier.padding(bottom = 6.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            LbTextField(
                value = hours,
                onValueChange = { if (it.length <= 3) hours = it },
                label = "",
                placeholder = "0",
                keyboardType = androidx.compose.ui.text.input.KeyboardType.Number,
                modifier = Modifier.weight(1f),
            )
            Text(":", fontSize = 16.sp, color = colors.textMuted)
            LbTextField(
                value = minutes,
                onValueChange = { if (it.length <= 2) minutes = it },
                label = "",
                placeholder = "0",
                keyboardType = androidx.compose.ui.text.input.KeyboardType.Number,
                modifier = Modifier.weight(1f),
            )
        }
        Row(modifier = Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(t("hours"), fontSize = 12.sp, color = colors.textMuted, modifier = Modifier.weight(1f))
            Text(t("minutes"), fontSize = 12.sp, color = colors.textMuted, modifier = Modifier.weight(1f))
        }

        Row(
            modifier = Modifier.padding(top = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            LbButton(
                text = I18n.t("common.cancel"),
                onClick = onDismiss,
                modifier = Modifier.weight(1f),
                variant = LbButtonVariant.SECONDARY,
                enabled = !isSubmitting,
            )
            LbButton(
                text = when {
                    isSubmitting && isEdit -> I18n.t("common.updating")
                    isSubmitting -> I18n.t("common.saving")
                    else -> I18n.t("common.save")
                },
                onClick = {
                    if (isSubmitting) return@LbButton
                    scope.launch {
                        // JS: `(parseInt(h) || 0) * 60 + (parseInt(m) || 0)`.
                        val totalMinutes = (hours.toIntOrNull() ?: 0) * 60 + (minutes.toIntOrNull() ?: 0)
                        if (totalMinutes <= 0) {
                            toast.show(toastText(t("invalidDuration"), t("enterValidDuration")), isError = true)
                            return@launch
                        }
                        val chosenCategory = category
                        if (chosenCategory == null) {
                            toast.show(toastText(t("invalidDuration"), t("selectCategory")), isError = true)
                            return@launch
                        }
                        isSubmitting = true
                        if (isEdit && record != null) {
                            val error = onUpdate(record.id, chosenCategory, description, totalMinutes)
                            if (error == null) {
                                toast.show(
                                    toastText(t("timeUpdated"), t("timeUpdatedDescription")),
                                    isError = false,
                                )
                                onDismiss()
                            } else {
                                toast.show(toastText(I18n.t("common.error"), error), isError = true)
                            }
                        } else {
                            val error = onCreate(chosenCategory, description, totalMinutes)
                            if (error == null) {
                                toast.show(
                                    toastText(
                                        t("timeRecorded"),
                                        t("timeRecordedDescription", "duration" to manualDurationText(totalMinutes), "category" to chosenCategory),
                                    ),
                                )
                                onDismiss()
                            } else {
                                toast.show(toastText(t("failedToSave"), error), isError = true)
                            }
                        }
                        isSubmitting = false
                    }
                },
                modifier = Modifier.weight(1f),
                variant = LbButtonVariant.PRIMARY,
                enabled = !isSubmitting && category != null,
                loading = isSubmitting,
            )
        }
        }
    }
}

/// ---------------------------------------------------------------------
/// Filter modal (month / year / category) — RN `FilterModal` for the time
/// screen fields; local draft, "all" sentinels, Reset + Apply.
/// ---------------------------------------------------------------------

private const val ALL_VALUE = "all"

@Composable
internal fun FilterModal(
    visible: Boolean,
    title: String,
    currentFilter: TimeFilter,
    onApply: (TimeFilter) -> Unit,
    onDismiss: () -> Unit,
) {
    val colors = LocalAppColors.current
    val now = remember(visible) { LocalDate.now() }
    val options = monthYearOptions(
        tMonths = { key -> I18n.t("months.$key") },
        now = now,
    )
    var draft by remember { mutableStateOf(currentFilter) }
    LaunchedEffect(visible) { if (visible) draft = currentFilter }

    LbModalSheet(visible = visible, onDismiss = onDismiss, title = title) {
        LbOptionSelect(
            label = t("month"),
            options = listOf(LbSelectOption(ALL_VALUE, t("allMonths"))) +
                options.monthOptions.map { LbSelectOption(it.value, it.label) },
            selected = draft.month ?: ALL_VALUE,
            onSelect = { value -> draft = draft.copy(month = value.takeUnless { it == ALL_VALUE }) },
            placeholder = t("allMonths"),
        )
        Spacer(Modifier.height(16.dp))
        LbOptionSelect(
            label = t("year"),
            options = listOf(LbSelectOption(ALL_VALUE, t("allYears"))) +
                options.yearOptions.map { LbSelectOption(it.value, it.label) },
            selected = draft.year ?: ALL_VALUE,
            onSelect = { value -> draft = draft.copy(year = value.takeUnless { it == ALL_VALUE }) },
            placeholder = t("allYears"),
        )
        Spacer(Modifier.height(16.dp))
        LbOptionSelect(
            label = t("category"),
            options = listOf(LbSelectOption(ALL_VALUE, t("allCategories"))) +
                TIME_CATEGORIES.map {
                    LbSelectOption(it, categoryLabel({ key -> I18n.t("timeCategories.$key") }, it))
                },
            selected = draft.category ?: ALL_VALUE,
            onSelect = { value -> draft = draft.copy(category = value.takeUnless { it == ALL_VALUE }) },
            placeholder = t("allCategories"),
        )

        Row(
            modifier = Modifier.padding(top = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (draft.activeCount > 0) {
                LbButton(
                    text = I18n.t("filterModal.reset"),
                    onClick = { draft = TimeFilter() },
                    variant = LbButtonVariant.GHOST,
                )
            }
            LbButton(
                text = I18n.t("filterModal.applyFilters"),
                onClick = {
                    onApply(draft)
                    onDismiss()
                },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

/// ---------------------------------------------------------------------
/// Create / edit calendar event form (RN
/// `components/time/calendar-event-form-modal.tsx`).
/// ---------------------------------------------------------------------

internal const val DEFAULT_SERIES_WEEKS = 4
internal const val DEFAULT_EVENT_DURATION_MINUTES = 60

private const val DEFAULT_EVENT_CATEGORY = "Other"
private const val DEFAULT_START_HOURS = 9

/** Prefill for creation (selected day + default time), RN `CalendarEventDefaults`. */
data class CalendarEventDefaults(
    val date: java.time.ZonedDateTime,
    val startMinutes: Int,
    val endMinutes: Int,
)

/** Two numeric inputs (hours + minutes) with a ":" separator + captions. */
@Composable
private fun TimeInput(
    label: String,
    hours: String,
    minutes: String,
    onChangeHours: (String) -> Unit,
    onChangeMinutes: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = LocalAppColors.current
    Column(modifier = modifier) {
        Text(label, fontSize = 14.sp, color = colors.foreground, modifier = Modifier.padding(bottom = 6.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            LbTextField(
                value = hours,
                onValueChange = { if (it.length <= 2) onChangeHours(it) },
                modifier = Modifier.weight(1f),
                placeholder = "09",
                keyboardType = androidx.compose.ui.text.input.KeyboardType.Number,
            )
            Text(":", fontSize = 16.sp, color = colors.textMuted)
            LbTextField(
                value = minutes,
                onValueChange = { if (it.length <= 2) onChangeMinutes(it) },
                modifier = Modifier.weight(1f),
                placeholder = "00",
                keyboardType = androidx.compose.ui.text.input.KeyboardType.Number,
            )
        }
        Row(modifier = Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(t("hours"), fontSize = 12.sp, color = colors.textMuted, modifier = Modifier.weight(1f))
            Text(t("minutes"), fontSize = 12.sp, color = colors.textMuted, modifier = Modifier.weight(1f))
        }
    }
}

@Composable
internal fun EventFormModal(
    visible: Boolean,
    onDismiss: () -> Unit,
    /** Event being edited; null creates a new one. */
    event: CalendarEventResponse?,
    /** Prefill for creation (selected day + default time). */
    defaults: CalendarEventDefaults?,
    onCreate: suspend (CreateCalendarEventRequest) -> String?,
    onUpdate: suspend (id: Long, request: UpdateCalendarEventRequest) -> String?,
    toast: ToastState,
    /** Asks the parent to open the delete confirmation. */
    onRequestDelete: (CalendarEventResponse) -> Unit,
) {
    val zone = ZoneId.systemDefault()
    val colors = LocalAppColors.current
    val isEdit = event != null
    // The repeat rule is fixed once the event exists: a series is materialized
    // at creation time, so it cannot be turned into one (or back) later.
    val isSeriesEvent = event?.seriesId != null

    var title by remember { mutableStateOf("") }
    var category by remember { mutableStateOf(DEFAULT_EVENT_CATEGORY) }
    var description by remember { mutableStateOf("") }
    var dateValue by remember { mutableStateOf("") }
    var startHours by remember { mutableStateOf(twoDigits(DEFAULT_START_HOURS)) }
    var startMinutes by remember { mutableStateOf("00") }
    var endHours by remember { mutableStateOf("") }
    var endMinutes by remember { mutableStateOf("") }
    var weeklyRepeat by remember { mutableStateOf(false) }
    var untilDate by remember { mutableStateOf("") }
    var scope by remember { mutableStateOf(EventScope.OCCURRENCE) }
    var endsNextDay by remember { mutableStateOf(false) }
    var isSubmitting by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(visible) {
        if (!visible) return@LaunchedEffect
        if (event != null) {
            val start = parseInstant(event.startAt, zone)
            val end = parseInstant(event.endAt, zone)
            title = event.title
            category = event.category.ifEmpty { DEFAULT_EVENT_CATEGORY }
            description = event.description
            dateValue = start?.let { toDateInputValue(it) } ?: ""
            startHours = twoDigits(start?.hour ?: 0)
            startMinutes = twoDigits(start?.minute ?: 0)
            endHours = twoDigits(end?.hour ?: 0)
            endMinutes = twoDigits(end?.minute ?: 0)
            weeklyRepeat = event.recurrenceRule == "weekly"
            untilDate = event.recurrenceUntil
                ?.let { parseInstant(it, zone) }
                ?.let { toDateInputValue(it) }
                ?: ""
            scope = EventScope.OCCURRENCE
            endsNextDay = isNextDayEnd(event.startAt, event.endAt, zone)
        } else {
            val date = defaults?.date ?: java.time.ZonedDateTime.now(zone)
            val startMinutesValue = defaults?.startMinutes ?: DEFAULT_START_HOURS * 60
            val endMinutesValue = defaults?.endMinutes ?: startMinutesValue + DEFAULT_EVENT_DURATION_MINUTES
            title = ""
            category = DEFAULT_EVENT_CATEGORY
            description = ""
            dateValue = toDateInputValue(date)
            startHours = twoDigits(startMinutesValue / 60)
            startMinutes = twoDigits(startMinutesValue % 60)
            endHours = twoDigits((endMinutesValue % (24 * 60)) / 60)
            endMinutes = twoDigits(endMinutesValue % 60)
            weeklyRepeat = false
            untilDate = ""
            scope = EventScope.OCCURRENCE
            endsNextDay = false
        }
    }

    LbModalSheet(
        visible = visible,
        onDismiss = onDismiss,
        title = if (isEdit) t("calendar.editEvent") else t("calendar.newEvent"),
    ) {
        Column(
            // Same cap + scroll as the record form (RN max-h-[90%] sheet).
            modifier = Modifier
                .heightIn(max = 560.dp)
                .verticalScroll(rememberScrollState()),
        ) {
        LbTextField(
            value = title,
            onValueChange = { if (it.length <= 255) title = it },
            label = t("calendar.eventTitle"),
            placeholder = t("calendar.titlePlaceholder"),
        )
        Spacer(Modifier.height(16.dp))

        LbOptionSelect(
            label = t("calendar.category"),
            options = TIME_CATEGORIES.map { cat ->
                LbSelectOption(cat, categoryLabel({ key -> I18n.t("timeCategories.$key") }, cat))
            },
            selected = category,
            onSelect = { category = it },
            placeholder = t("calendar.category"),
        )
        Spacer(Modifier.height(16.dp))

        LbTextField(
            value = dateValue,
            onValueChange = { dateValue = it },
            label = t("calendar.date"),
            placeholder = "YYYY-MM-DD",
            keyboardType = androidx.compose.ui.text.input.KeyboardType.Ascii,
        )
        Spacer(Modifier.height(16.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            TimeInput(
                label = t("calendar.startTime"),
                hours = startHours,
                minutes = startMinutes,
                onChangeHours = { startHours = it },
                onChangeMinutes = { startMinutes = it },
                modifier = Modifier.weight(1f),
            )
            TimeInput(
                label = t("calendar.endTime"),
                hours = endHours,
                minutes = endMinutes,
                onChangeHours = { endHours = it },
                onChangeMinutes = { endMinutes = it },
                modifier = Modifier.weight(1f),
            )
        }
        Spacer(Modifier.height(12.dp))

        // Overnight toggle: same explicit pattern as the weekday chips of the
        // activity form — the end time is never reinterpreted.
        val toggleInk = if (endsNextDay) colors.primaryForeground else colors.foreground
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .let { base ->
                    if (endsNextDay) {
                        base.background(colors.primary).border(1.dp, colors.primary, RoundedCornerShape(8.dp))
                    } else {
                        base.border(1.dp, colors.border, RoundedCornerShape(8.dp))
                    }
                }
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = { endsNextDay = !endsNextDay },
                )
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(0.dp),
        ) {
            Text(
                t("calendar.endsNextDay"),
                fontSize = 14.sp,
                color = toggleInk,
            )
        }
        Spacer(Modifier.height(16.dp))

        if (!isEdit) {
            LbOptionSelect(
                label = t("calendar.repeat"),
                options = listOf(
                    LbSelectOption("none", I18n.t("calendar.repeatNone")),
                    LbSelectOption("weekly", I18n.t("calendar.repeatWeekly")),
                ),
                selected = if (weeklyRepeat) "weekly" else "none",
                onSelect = { value ->
                    weeklyRepeat = value == "weekly"
                    if (weeklyRepeat && untilDate.isEmpty()) {
                        // Pre-signs the series: +4 weeks past the event date.
                        untilDate = addDaysToDateValue(dateValue, DEFAULT_SERIES_WEEKS * 7, zone)
                    }
                },
                placeholder = t("calendar.repeat"),
            )
            Spacer(Modifier.height(16.dp))
            if (weeklyRepeat) {
                LbTextField(
                    value = untilDate,
                    onValueChange = { untilDate = it },
                    label = t("calendar.repeatUntil"),
                    placeholder = "YYYY-MM-DD",
                    keyboardType = androidx.compose.ui.text.input.KeyboardType.Ascii,
                )
                Spacer(Modifier.height(16.dp))
            }
        }

        if (isEdit && isSeriesEvent) {
            LbOptionSelect(
                label = t("calendar.applyTo"),
                options = listOf(
                    LbSelectOption(EventScope.OCCURRENCE, I18n.t("calendar.applyToOccurrence")),
                    LbSelectOption(EventScope.SERIES, I18n.t("calendar.applyToSeries")),
                ),
                selected = scope,
                onSelect = { scope = it },
                placeholder = t("calendar.applyTo"),
            )
            Spacer(Modifier.height(4.dp))
            Text(
                I18n.t("calendar.seriesEvent"),
                fontSize = 12.sp,
                color = colors.textMuted,
            )
            Spacer(Modifier.height(16.dp))
        }

        LbTextField(
            value = description,
            onValueChange = { if (it.length <= 1000) description = it },
            label = t("calendar.description"),
            placeholder = t("calendar.descriptionPlaceholder"),
            singleLine = false,
        )

        Row(
            modifier = Modifier.padding(top = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (isEdit && event != null) {
                LbButton(
                    text = I18n.t("common.delete"),
                    onClick = {
                        onRequestDelete(event)
                    },
                    modifier = Modifier.weight(1f),
                    variant = LbButtonVariant.DANGER,
                    enabled = !isSubmitting,
                )
            } else {
                Spacer(modifier = Modifier.weight(1f))
            }
            LbButton(
                text = I18n.t("common.cancel"),
                onClick = onDismiss,
                modifier = Modifier.weight(1f),
                variant = LbButtonVariant.SECONDARY,
                enabled = !isSubmitting,
            )
            LbButton(
                text = when {
                    isSubmitting && isEdit -> I18n.t("common.updating")
                    isSubmitting -> I18n.t("common.saving")
                    else -> I18n.t("common.save")
                },
                onClick = {
                    if (isSubmitting) return@LbButton
                    coroutineScope.launch {
                        // ---- validation, each step in order with its own toast ----
                        val trimmedTitle = title.trim()
                        if (trimmedTitle.isEmpty()) {
                            toast.show(toastText(I18n.t("calendar.titleRequired"), I18n.t("calendar.titleRequiredDescription")), isError = true)
                            return@launch
                        }
                        if (!isValidDateValue(dateValue, zone)) {
                            toast.show(I18n.t("calendar.invalidDate"), isError = true)
                            return@launch
                        }
                        val sh = startHours.toIntOrNull()
                        val sm = startMinutes.toIntOrNull()
                        val eh = endHours.toIntOrNull()
                        val em = endMinutes.toIntOrNull()
                        if (sh == null || sm == null || eh == null || em == null ||
                            !isValidTimeOfDay(sh, sm) || !isValidTimeOfDay(eh, em)
                        ) {
                            toast.show(I18n.t("calendar.invalidTime"), isError = true)
                            return@launch
                        }

                        val start = combineDateAndTime(dateValue, sh, sm, zone)
                        val end = combineDateAndTime(
                            if (endsNextDay) addDaysToDateValue(dateValue, 1, zone) else dateValue,
                            eh,
                            em,
                            zone,
                        )
                        if (start == null || end == null || !end.isAfter(start)) {
                            toast.show(I18n.t("calendar.invalidRange"), isError = true)
                            return@launch
                        }
                        if (!isWithinMaxDuration(start, end)) {
                            toast.show(I18n.t("calendar.tooLong"), isError = true)
                            return@launch
                        }

                        // ---- submit ----
                        isSubmitting = true
                        val startAt = start.toInstant().toString()
                        val endAt = end.toInstant().toString()
                        if (isEdit && event != null) {
                            val error = onUpdate(
                                event.id,
                                UpdateCalendarEventRequest(
                                    title = trimmedTitle,
                                    description = description,
                                    category = category,
                                    startAt = startAt,
                                    endAt = endAt,
                                    scope = scope,
                                ),
                            )
                            if (error == null) {
                                toast.show(
                                    toastText(I18n.t("calendar.eventUpdated"), t("calendar.eventUpdatedDescription", "title" to trimmedTitle)),
                                )
                                onDismiss()
                            } else {
                                toast.show(toastText(I18n.t("calendar.failedToSave"), error), isError = true)
                            }
                        } else {
                            if (weeklyRepeat) {
                                if (untilDate.isEmpty()) {
                                    toast.show(I18n.t("calendar.repeatUntilRequired"), isError = true)
                                    isSubmitting = false
                                    return@launch
                                }
                                if (untilDate < dateValue) {
                                    toast.show(I18n.t("calendar.repeatUntilBeforeStart"), isError = true)
                                    isSubmitting = false
                                    return@launch
                                }
                            }
                            val request = CreateCalendarEventRequest(
                                title = trimmedTitle,
                                description = description,
                                category = category,
                                startAt = startAt,
                                endAt = endAt,
                                recurrence = if (weeklyRepeat) {
                                    CalendarRecurrenceRequest(
                                        rule = RecurrenceRule.WEEKLY,
                                        interval = 1,
                                        until = toEndOfDayInstant(untilDate, zone),
                                    )
                                } else {
                                    null
                                },
                            )
                            val error = onCreate(request)
                            if (error == null) {
                                toast.show(
                                    toastText(I18n.t("calendar.eventCreated"), t("calendar.eventCreatedDescription", "title" to trimmedTitle)),
                                )
                                onDismiss()
                            } else {
                                toast.show(toastText(I18n.t("calendar.failedToSave"), error), isError = true)
                            }
                        }
                        isSubmitting = false
                    }
                },
                modifier = Modifier.weight(1f),
                variant = LbButtonVariant.PRIMARY,
                enabled = !isSubmitting,
                loading = isSubmitting,
            )
        }
    }
}
}
