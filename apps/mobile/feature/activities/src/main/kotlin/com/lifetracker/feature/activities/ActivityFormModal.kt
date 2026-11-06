package com.lifetracker.feature.activities

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lifetracker.core.designsystem.LbButton
import com.lifetracker.core.designsystem.LbButtonVariant
import com.lifetracker.core.designsystem.LbModalSheet
import com.lifetracker.core.designsystem.LbTextField
import com.lifetracker.core.designsystem.LocalAppColors
import com.lifetracker.core.designsystem.ToastState
import com.lifetracker.core.i18n.I18n
import com.lifetracker.core.network.model.CreateActivityRequest
import com.lifetracker.core.network.model.CreateReminderRequest
import com.lifetracker.core.network.model.ActivityResponse
import com.lifetracker.core.network.model.DayTime
import com.lifetracker.core.network.model.Frequency
import com.lifetracker.core.network.model.ReminderResponse
import com.lifetracker.core.network.model.UpdateActivityRequest
import com.lifetracker.core.network.model.UpdateReminderRequest
import com.lifetracker.domain.lib.time.buildDateTime
import com.lifetracker.domain.lib.time.formatDateInput
import com.lifetracker.domain.lib.time.formatTimeInput
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.coroutines.launch

/**
 * Port of `components/activity/activity-form-modal.tsx`: single create/edit
 * form for recurring activities and reminders; a checkbox switches the field
 * set when creating (edit is locked to the entity being edited). Activity
 * validation/save failures alert in place; reminder validation reacts with
 * destructive toasts — mirroring the RN modals exactly.
 */

/** Wire day names in the RN chip order (monday…sunday). */
private val FORM_DAYS = listOf("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")

private val FREQUENCIES = listOf(Frequency.DAILY, Frequency.WEEKLY, Frequency.MONTHLY)
private val DAY_TIMES = listOf(DayTime.NOT_SPECIFIED, DayTime.MORNING, DayTime.AFTERNOON, DayTime.EVENING)

private val TIME_RE = Regex("^([01]\\d|2[0-3]):[0-5]\\d$")
private val DATE_RE = Regex("^\\d{4}-\\d{2}-\\d{2}$")

private val dayFrequencyJson = kotlinx.serialization.json.Json

/** Values to prefill an activity create form (e.g. a customized template). */
data class ActivityPrefill(
    val title: String,
    val completionAmount: Int,
    val frequency: Frequency,
    val dayTime: DayTime,
    val dayFrequency: List<String>? = null,
)

@Composable
internal fun ActivityFormModal(
    visible: Boolean,
    activity: ActivityResponse?,
    reminder: ReminderResponse?,
    prefill: ActivityPrefill?,
    onClose: () -> Unit,
    viewModel: ActivitiesViewModel,
    toast: ToastState,
) {
    val colors = LocalAppColors.current
    val scope = rememberCoroutineScope()

    var entityReminderMode by rememberSaveable { mutableStateOf(false) }
    var title by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("") }
    var completionAmount by rememberSaveable { mutableStateOf("1") }
    var frequency by rememberSaveable { mutableStateOf(Frequency.DAILY) }
    var dayTime by rememberSaveable { mutableStateOf(DayTime.NOT_SPECIFIED) }
    var selectedDays by rememberSaveable { mutableStateOf(emptySet<String>()) }
    var dueDate by rememberSaveable { mutableStateOf("") }
    var endTime by rememberSaveable { mutableStateOf("23:59") }
    var hasWindow by rememberSaveable { mutableStateOf(false) }
    var startTime by rememberSaveable { mutableStateOf("07:00") }
    var isSaving by rememberSaveable { mutableStateOf(false) }
    var alertTitle by rememberSaveable { mutableStateOf<String?>(null) }
    var alertMessage by rememberSaveable { mutableStateOf<String?>(null) }

    val isEdit = activity != null || reminder != null
    val reminderMode = if (isEdit) reminder != null else entityReminderMode

    LaunchedEffect(visible, activity, reminder, prefill) {
        if (!visible) return@LaunchedEffect
        val zone = ZoneId.systemDefault()
        when {
            activity != null -> {
                title = activity.title
                description = activity.description
                completionAmount = activity.completionAmount.toString()
                frequency = activity.frequency
                dayTime = activity.dayTime
                selectedDays = parseDayFrequency(activity.dayFrequency)?.toSet() ?: emptySet()
                dueDate = ""
                endTime = "23:59"
                hasWindow = false
                startTime = "07:00"
            }
            reminder != null -> {
                title = reminder.title
                description = reminder.description
                completionAmount = "1"
                frequency = Frequency.DAILY
                dayTime = DayTime.NOT_SPECIFIED
                selectedDays = emptySet()
                val due = parseJsDate(reminder.dueAt, zone)
                dueDate = due?.let { formatDateInput(it) } ?: ""
                endTime = due?.let { formatTimeInput(it) } ?: "23:59"
                val activeFrom = reminder.activeFrom?.let { parseJsDate(it, zone) }
                hasWindow = activeFrom != null
                startTime = activeFrom?.let { formatTimeInput(it) } ?: "07:00"
            }
            else -> {
                title = prefill?.title ?: ""
                description = ""
                completionAmount = (prefill?.completionAmount ?: 1).toString()
                frequency = prefill?.frequency ?: Frequency.DAILY
                dayTime = prefill?.dayTime ?: DayTime.NOT_SPECIFIED
                selectedDays = prefill?.dayFrequency?.toSet() ?: emptySet()
                dueDate = ""
                endTime = "23:59"
                hasWindow = false
                startTime = "07:00"
            }
        }
    }

    /** JSON-encoded day array, ordered monday…sunday (RN stringifies a plain array). */
    fun encodedDays(): String =
        dayFrequencyJson.encodeToString(FORM_DAYS.filter { it in selectedDays })

    fun submitActivity() {
        val amount = completionAmount.toDoubleOrNull()
        when {
            title.trim().isEmpty() -> {
                alertTitle = I18n.t("createActivity.validationError")
                alertMessage = I18n.t("createActivity.titleLabel")
            }
            amount == null || amount < 1 -> {
                alertTitle = I18n.t("createActivity.validationError")
                alertMessage = I18n.t("createActivity.targetAmount")
            }
            frequency == Frequency.WEEKLY && selectedDays.isEmpty() -> {
                alertTitle = I18n.t("createActivity.validationError")
                alertMessage = I18n.t("createActivity.selectDayError")
            }
            else -> {
                isSaving = true
                val goal = (amount ?: 1).toInt()
                val days = if (frequency == Frequency.WEEKLY) encodedDays() else null
                scope.launch {
                    val result = if (activity != null) {
                        viewModel.updateActivity(
                            activity.id,
                            UpdateActivityRequest(
                                title = title.trim(),
                                description = description.trim(),
                                completionAmount = goal,
                                frequency = frequency,
                                dayFrequency = days,
                                dayTime = dayTime,
                            ),
                        )
                    } else {
                        viewModel.createActivity(
                            CreateActivityRequest(
                                title = title.trim(),
                                description = description.trim(),
                                frequency = frequency,
                                dayFrequency = days,
                                dayTime = dayTime,
                                completionAmount = goal,
                            ),
                        )
                    }
                    isSaving = false
                    result.fold(
                        onSuccess = { onClose() },
                        onFailure = { err ->
                            alertTitle = I18n.t("createActivity.creationFailed")
                            alertMessage = err.message
                        },
                    )
                }
            }
        }
    }

    fun submitReminder() {
        val zone = ZoneId.systemDefault()
        when {
            !DATE_RE.matches(dueDate.trim()) -> toast.show(
                I18n.t("createReminder.validationError") + "\n" + I18n.t("createReminder.pickDateError"),
                isError = true,
            )
            !TIME_RE.matches(endTime) || (hasWindow && !TIME_RE.matches(startTime)) -> toast.show(
                I18n.t("createReminder.validationError") + "\n" + I18n.t("createReminder.windowBeforeDeadlineError"),
                isError = true,
            )
            else -> {
                val dueDateObj = dueDate.trim().let {
                    LocalDate.of(
                        it.substring(0, 4).toInt(),
                        it.substring(5, 7).toInt(),
                        it.substring(8, 10).toInt(),
                    ).atStartOfDay(zone)
                }
                val dueAt = buildDateTime(dueDateObj, endTime) ?: run {
                    toast.show(
                        I18n.t("createReminder.validationError") + "\n" + I18n.t("createReminder.windowBeforeDeadlineError"),
                        isError = true,
                    )
                    return
                }
                // RN: without an active window the reminder becomes completable now.
                val activeFrom = if (hasWindow) {
                    buildDateTime(dueDateObj, startTime) ?: run {
                        toast.show(
                            I18n.t("createReminder.validationError") + "\n" +
                                I18n.t("createReminder.windowBeforeDeadlineError"),
                            isError = true,
                        )
                        return
                    }
                } else {
                    java.time.ZonedDateTime.now()
                }
                if (activeFrom >= dueAt) {
                    toast.show(
                        I18n.t("createReminder.validationError") + "\n" + I18n.t("createReminder.windowBeforeDeadlineError"),
                        isError = true,
                    )
                    return
                }
                isSaving = true
                scope.launch {
                    val result = if (reminder != null) {
                        viewModel.updateReminder(
                            reminder.id,
                            UpdateReminderRequest(
                                title = title.trim(),
                                description = description.trim(),
                                dueAt = toIsoInstant(dueAt),
                                activeFrom = toIsoInstant(activeFrom),
                            ),
                        )
                    } else {
                        viewModel.createReminder(
                            CreateReminderRequest(
                                title = title.trim(),
                                description = description.trim(),
                                dueAt = toIsoInstant(dueAt),
                                activeFrom = toIsoInstant(activeFrom),
                            ),
                        )
                    }
                    isSaving = false
                    result.fold(
                        onSuccess = {
                            toast.show(
                                if (reminder != null) {
                                    I18n.t("createReminder.reminderUpdated") + "\n" +
                                        I18n.t("createReminder.reminderUpdatedDescription")
                                } else {
                                    I18n.t("createReminder.reminderCreated") + "\n" +
                                        I18n.t("createReminder.reminderCreatedDescription")
                                },
                            )
                            onClose()
                        },
                        onFailure = {
                            toast.show(
                                I18n.t(if (reminder != null) "createReminder.updateFailed" else "createReminder.creationFailed"),
                                isError = true,
                            )
                        },
                    )
                }
            }
        }
    }

    val dialogTitle = when {
        activity != null -> I18n.t("activities.editActivity")
        reminder != null -> I18n.t("createReminder.updateReminder")
        reminderMode -> I18n.t("createReminder.title")
        else -> I18n.t("createActivity.createActivity")
    }
    val submitLabel = when {
        isEdit -> I18n.t("common.save")
        reminderMode -> I18n.t("createReminder.createReminder")
        else -> I18n.t("createActivity.createActivity")
    }

    alertTitle?.let { errorTitle ->
        AlertDialog(
            onDismissRequest = {
                alertTitle = null
                alertMessage = null
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        alertTitle = null
                        alertMessage = null
                    },
                ) { Text(I18n.t("common.cancel")) }
            },
            title = { Text(errorTitle, color = colors.foreground, fontWeight = FontWeight.SemiBold) },
            text = { Text(alertMessage.orEmpty(), color = colors.textMuted, fontSize = 14.sp) },
        )
    }

    LbModalSheet(visible = visible, onDismiss = onClose, title = dialogTitle) {
        Column(
            modifier = Modifier
                .heightIn(max = 540.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            LbTextField(
                value = title,
                onValueChange = { title = it },
                label = I18n.t("createActivity.titleLabel"),
                placeholder = if (reminderMode) {
                    I18n.t("createReminder.titlePlaceholder")
                } else {
                    I18n.t("createActivity.titlePlaceholder")
                },
            )
            LbTextField(
                value = description,
                onValueChange = { description = it },
                label = I18n.t("createActivity.descriptionLabel"),
                placeholder = if (reminderMode) {
                    I18n.t("createReminder.descriptionPlaceholder")
                } else {
                    I18n.t("createActivity.descriptionPlaceholder")
                },
            )

            if (!isEdit) {
                LbCheckboxRow(
                    checked = entityReminderMode,
                    onToggle = { entityReminderMode = !entityReminderMode },
                    label = I18n.t("activities.modeReminder"),
                    hint = I18n.t("activities.modeHint"),
                )
            }

            if (!reminderMode) {
                Text(I18n.t("createActivity.frequency"), fontSize = 14.sp, color = colors.foreground)
                ChipRow {
                    FREQUENCIES.forEach { f ->
                        LbSelectableChip(
                            text = activityLabel(f.wire),
                            selected = frequency == f,
                            onClick = { frequency = f },
                        )
                    }
                }

                if (frequency == Frequency.WEEKLY) {
                    Text(I18n.t("createActivity.daysOfWeek"), fontSize = 14.sp, color = colors.foreground)
                    ChipRow {
                        FORM_DAYS.forEach { day ->
                            LbSelectableChip(
                                text = dayLabel(day),
                                selected = day in selectedDays,
                                onClick = {
                                    selectedDays = if (day in selectedDays) selectedDays - day else selectedDays + day
                                },
                            )
                        }
                    }
                }

                Text(I18n.t("createActivity.timeOfDay"), fontSize = 14.sp, color = colors.foreground)
                ChipRow {
                    DAY_TIMES.forEach { dt ->
                        LbSelectableChip(
                            text = activityLabel(dt.wire),
                            selected = dayTime == dt,
                            onClick = { dayTime = dt },
                        )
                    }
                }

                LbTextField(
                    value = completionAmount,
                    onValueChange = { completionAmount = it },
                    label = I18n.t("createActivity.targetAmount"),
                    keyboardType = KeyboardType.Number,
                )
            } else {
                LbTextField(
                    value = dueDate,
                    onValueChange = { dueDate = it },
                    label = I18n.t("createReminder.dueDate"),
                    placeholder = I18n.t("createReminder.dueDatePlaceholder"),
                )
                LbTextField(
                    value = endTime,
                    onValueChange = { endTime = it },
                    label = I18n.t("createReminder.windowEndTime"),
                    placeholder = "HH:MM",
                )
                if (!hasWindow) {
                    Text(
                        I18n.t("createReminder.windowEndHint"),
                        fontSize = 12.sp,
                        color = colors.textMuted,
                        modifier = Modifier.padding(top = (-4).dp),
                    )
                }

                LbCheckboxRow(
                    checked = hasWindow,
                    onToggle = { hasWindow = !hasWindow },
                    label = I18n.t("createReminder.activeWindow"),
                    hint = I18n.t("createReminder.activeWindowHint"),
                )

                if (hasWindow) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        LbTextField(
                            value = startTime,
                            onValueChange = { startTime = it },
                            label = I18n.t("createReminder.windowStartTime"),
                            placeholder = "HH:MM",
                            modifier = Modifier.weight(1f),
                        )
                        LbTextField(
                            value = endTime,
                            onValueChange = { endTime = it },
                            label = I18n.t("createReminder.windowEndTime"),
                            placeholder = "HH:MM",
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.padding(top = 8.dp),
            ) {
                LbButton(
                    text = I18n.t("common.cancel"),
                    onClick = onClose,
                    modifier = Modifier.weight(1f),
                    variant = LbButtonVariant.SECONDARY,
                )
                LbButton(
                    text = submitLabel,
                    onClick = { if (reminderMode) submitReminder() else submitActivity() },
                    modifier = Modifier.weight(1f),
                    loading = isSaving,
                )
            }
        }
    }
}
