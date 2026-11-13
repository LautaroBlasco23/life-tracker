package com.lifetracker.feature.activities

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.Alarm
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Repeat
import androidx.compose.material.icons.outlined.Replay
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.lifetracker.core.designsystem.AppHeader
import com.lifetracker.core.designsystem.LbButton
import com.lifetracker.core.designsystem.LbButtonVariant
import com.lifetracker.core.designsystem.LbCategoryHeader
import com.lifetracker.core.designsystem.LbDeleteConfirm
import com.lifetracker.core.designsystem.LbFilterChipsRow
import com.lifetracker.core.designsystem.LbHeaderAction
import com.lifetracker.core.designsystem.LbMenuDialog
import com.lifetracker.core.designsystem.LbMenuOption
import com.lifetracker.core.designsystem.LbStreakBadge
import com.lifetracker.core.designsystem.LocalAppColors
import com.lifetracker.core.designsystem.LocalToast
import com.lifetracker.domain.activities.ActivityFilter
import com.lifetracker.core.network.model.ActivityResponse
import com.lifetracker.core.network.model.ReminderResponse
import com.lifetracker.core.network.model.StreakInfo
import com.lifetracker.core.i18n.I18n
import com.lifetracker.domain.lib.time.formatShortDate
import java.time.ZoneId
import java.time.ZonedDateTime
import kotlinx.coroutines.launch

/**
 * Port of `app/(app)/activities.tsx`: today's activity groups + reminders
 * section (30 s status re-derivation), global streak banner, filter modal,
 * templates modal, routines manager, activity/reminder form and delete
 * confirms; hamburger navigation via the design-system [AppHeader].
 */

/** RN `CATEGORY_ORDER`: notSpecified → morning → afternoon → evening. */
private val CATEGORY_ORDER = listOf("notSpecified", "morning", "afternoon", "evening")

@Composable
fun ActivitiesScreen(onNavigate: (String) -> Unit = {}) {
    val viewModel: ActivitiesViewModel = hiltViewModel()
    val state by viewModel.uiState.collectAsState()
    val scope = rememberCoroutineScope()
    val toast = LocalToast.current
    val colors = LocalAppColors.current

    // Screen-local modal/selection state (RN component state).
    var showForm by rememberSaveable { mutableStateOf(false) }
    var editingActivity by rememberSaveable { mutableStateOf<ActivityResponse?>(null) }
    var editingReminder by rememberSaveable { mutableStateOf<ReminderResponse?>(null) }
    var deletingActivity by rememberSaveable { mutableStateOf<ActivityResponse?>(null) }
    var deletingReminder by rememberSaveable { mutableStateOf<ReminderResponse?>(null) }
    var longPressActivity by rememberSaveable { mutableStateOf<ActivityResponse?>(null) }
    var longPressReminder by rememberSaveable { mutableStateOf<ReminderResponse?>(null) }
    var showRoutines by rememberSaveable { mutableStateOf(false) }
    var showTemplates by rememberSaveable { mutableStateOf(false) }
    var showFilter by rememberSaveable { mutableStateOf(false) }
    var prefill by rememberSaveable { mutableStateOf<ActivityPrefill?>(null) }
    // Collapsed day-time/reminder sections (Bundle-saveable: a String set).
    var collapsedSections by rememberSaveable { mutableStateOf(emptySet<String>()) }

    // Focus-refetch (RN useFocusEffect): re-entering this destination refreshes.
    LaunchedEffect(viewModel) {
        viewModel.refresh()
    }
    // Subscribe the whole screen to runtime language switches (I18n.t is a
    // plain lookup; reading I18n.current makes this composition re-resolve).
    I18n.current

    val zone = ZoneId.systemDefault()
    // Shared `now` clock snapshot re-derived by the ViewModel's 30 s tick.
    val now = remember(state.nowMillis, zone) { ZonedDateTime.now(zone) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background),
    ) {
        Column(Modifier.fillMaxSize()) {
            AppHeader(title = "LifeTracker", onProfile = { onNavigate("profile") })

            if (state.isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = colors.primary)
                }
                return@Column
            }

            val filterCount = activeFilterCount(state.filter)
            val grouped = CATEGORY_ORDER.mapNotNull { cat ->
                val items = state.activities.filter { it.dayTime.wire == cat }
                if (items.isEmpty()) null else cat to items
            }

            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
            ) {
                item {
                    Column(Modifier.padding(horizontal = 16.dp).padding(top = 16.dp)) {
                        Text(
                            text = I18n.t("activities.title"),
                            fontSize = 24.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = colors.foreground,
                        )
                        Text(
                            text = I18n.t("activities.description"),
                            fontSize = 14.sp,
                            color = colors.textMuted,
                            modifier = Modifier.padding(top = 4.dp),
                        )

                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 12.dp),
                        ) {
                            LbHeaderAction(
                                text = I18n.t("routines.title"),
                                icon = Icons.Outlined.Repeat,
                                onClick = { showRoutines = true },
                                modifier = Modifier.weight(1f),
                            )
                            LbHeaderAction(
                                text = I18n.t("activityTemplates.button"),
                                icon = Icons.Outlined.Dashboard,
                                onClick = {
                                    prefill = null
                                    showTemplates = true
                                },
                                modifier = Modifier.weight(1f),
                            )
                            LbHeaderAction(
                                text = I18n.t("common.filters"),
                                icon = Icons.Outlined.Tune,
                                badgeCount = filterCount.takeIf { it > 0 },
                                highlighted = filterCount > 0,
                                onClick = { showFilter = true },
                                modifier = Modifier.weight(1f),
                            )
                        }

                        val activeFilter = state.filter
                        if (activeFilter != null && filterCount > 0) {
                            ActiveFilterChipsRow(
                                filter = activeFilter,
                                onClear = { viewModel.applyFilter(null) },
                                modifier = Modifier.padding(top = 8.dp),
                            )
                        }

                        if (state.loadFailed) {
                            Text(
                                text = I18n.t("activities.failedToLoad"),
                                fontSize = 14.sp,
                                color = colors.danger,
                                modifier = Modifier.padding(top = 12.dp),
                            )
                        }

                        val streak = state.globalStreak
                        if (streak != null && streak.current > 0) {
                            StreakBanner(current = streak.current, longest = streak.longest)
                        }

                        if (state.activities.isEmpty() && !state.loadFailed) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 32.dp, bottom = 16.dp),
                            ) {
                                Text(
                                    text = I18n.t("activities.noActivitiesForToday"),
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = colors.foreground,
                                )
                                Text(
                                    text = I18n.t("activities.createToSeeHere"),
                                    fontSize = 14.sp,
                                    color = colors.textMuted,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.padding(top = 8.dp),
                                )
                                LbButton(
                                    text = I18n.t("activities.createFirstActivity"),
                                    onClick = {
                                        editingActivity = null
                                        showForm = true
                                    },
                                    modifier = Modifier.padding(top = 16.dp),
                                )
                            }
                        }
                    }
                }

                if (state.reminders.isNotEmpty()) {
                    item(key = "reminders") {
                        Column(Modifier.padding(horizontal = 16.dp)) {
                            val sortedReminders = sortReminders(state.reminders, now)
                            val remindersDone = sortedReminders.count {
                                reminderStatus(it, now) == ReminderStatus.COMPLETED
                            }
                            LbCategoryHeader(
                                label = I18n.t("reminders.title"),
                                icon = Icons.Outlined.Notifications,
                                accent = LocalAppColors.current.sectionEvening,
                                description = I18n.t("reminders.description"),
                                summary = "$remindersDone/${sortedReminders.size}",
                                summaryHint = reminderCountHint(sortedReminders.size),
                                collapsed = "reminders" in collapsedSections,
                                onToggle = {
                                    collapsedSections =
                                        if ("reminders" in collapsedSections) {
                                            collapsedSections - "reminders"
                                        } else {
                                            collapsedSections + "reminders"
                                        }
                                },
                                modifier = Modifier.padding(top = 16.dp),
                            )
                            if ("reminders" !in collapsedSections) {
                                sortedReminders.forEach { reminder ->
                                    ReminderCard(
                                        reminder = reminder,
                                        now = now,
                                        processing = reminder.id in state.reminderProcessingIds,
                                        onComplete = {
                                            scope.launch {
                                                viewModel.completeReminder(reminder).fold(
                                                    onSuccess = {
                                                        toast.show(
                                                            I18n.t("reminders.reminderComplete") + "\n" +
                                                                I18n.t(
                                                                    "reminders.reminderCompletedDescription",
                                                                    "title" to reminder.title,
                                                                ),
                                                        )
                                                    },
                                                    onFailure = {
                                                        toast.show(I18n.t("common.error"), isError = true)
                                                    },
                                                )
                                            }
                                        },
                                        onRevert = {
                                            scope.launch {
                                                viewModel.revertReminderCompletion(reminder).fold(
                                                    onSuccess = {
                                                        toast.show(
                                                            I18n.t("reminders.completionReverted") + "\n" +
                                                                I18n.t(
                                                                    "reminders.revertDescription",
                                                                    "title" to reminder.title,
                                                                ),
                                                        )
                                                    },
                                                    onFailure = {
                                                        toast.show(I18n.t("common.error"), isError = true)
                                                    },
                                                )
                                            }
                                        },
                                        onLongPress = { longPressReminder = reminder },
                                        modifier = Modifier.padding(bottom = 8.dp),
                                    )
                                }
                            }
                        }
                    }
                }

                grouped.forEach { (cat, items) ->
                    item(key = cat) {
                        Column(Modifier.padding(horizontal = 16.dp)) {
                            val spec = sectionSpec(cat)
                            val done = items.count { it.isCompletedToday }
                            LbCategoryHeader(
                                label = spec.label,
                                icon = spec.icon,
                                accent = spec.accent,
                                description = spec.tagline,
                                summary = "$done/${items.size}",
                                summaryHint = activityCountHint(items.size),
                                collapsed = cat in collapsedSections,
                                onToggle = {
                                    collapsedSections =
                                        if (cat in collapsedSections) {
                                            collapsedSections - cat
                                        } else {
                                            collapsedSections + cat
                                        }
                                },
                                modifier = Modifier.padding(top = 16.dp),
                            )
                            if (cat !in collapsedSections) {
                                items.forEach { activity ->
                                    ActivityCard(
                                        activity = activity,
                                        isProcessing = activity.id in state.processingIds,
                                        onPress = {
                                            scope.launch {
                                                if (activity.isCompletedToday) {
                                                    toast.show(
                                                        I18n.t("activities.activityComplete") + "\n" +
                                                            I18n.t(
                                                                "activities.activityAlreadyCompleted",
                                                                "date" to formatShortDate(now),
                                                            ),
                                                    )
                                                    return@launch
                                                }
                                                viewModel.recordCompletion(activity).fold(
                                                    onSuccess = { },
                                                    onFailure = {
                                                        toast.show(
                                                            I18n.t("common.error") + "\n" +
                                                                I18n.t(
                                                                    "activities.activityAlreadyCompleted",
                                                                    "date" to formatShortDate(now),
                                                                ),
                                                            isError = true,
                                                        )
                                                    },
                                                )
                                            }
                                        },
                                        onLongPress = { longPressActivity = activity },
                                        modifier = Modifier.padding(top = 12.dp),
                                    )
                                }
                            }
                        }
                    }
                }

                item(key = "bottom-space") {
                    Box(Modifier.height(88.dp))
                }
            }
        }

        // FAB (+) bottom-right → create modal
        CreateFab(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(bottom = 24.dp, end = 20.dp),
            onClick = {
                editingActivity = null
                editingReminder = null
                prefill = null
                showForm = true
            },
        )

        // -- modals --

        ActivityFormModal(
            visible = showForm,
            activity = editingActivity,
            reminder = editingReminder,
            prefill = prefill,
            onClose = {
                showForm = false
                editingActivity = null
                editingReminder = null
                prefill = null
            },
            viewModel = viewModel,
            toast = toast,
        )

        RoutinesModal(visible = showRoutines, onClose = { showRoutines = false }, toast = toast)

        TemplatesModal(
            visible = showTemplates,
            onClose = { showTemplates = false },
            viewModel = viewModel,
            onCustomize = { templatePrefill ->
                prefill = templatePrefill
                showForm = true
            },
            toast = toast,
        )

        ActivitiesFilterModal(
            visible = showFilter,
            currentFilter = state.filter,
            onApply = { viewModel.applyFilter(it) },
            onClose = { showFilter = false },
        )

        deletingActivity?.let { target ->
            LbDeleteConfirm(
                visible = true,
                name = target.title,
                onDismiss = { deletingActivity = null },
                onConfirm = {
                    scope.launch {
                        viewModel.deleteActivity(target.id).fold(
                            onSuccess = { deletingActivity = null },
                            onFailure = {
                                toast.show(I18n.t("activities.deleteFailed"), isError = true)
                                // Modal stays open on failure (RN parity).
                            },
                        )
                    }
                },
                title = I18n.t("activities.deleteActivity"),
                message = I18n.t("deleteModal.areYouSure", "name" to target.title),
                deleteLabel = I18n.t("common.delete"),
            )
        }

        deletingReminder?.let { target ->
            LbDeleteConfirm(
                visible = true,
                name = target.title,
                onDismiss = { deletingReminder = null },
                onConfirm = {
                    scope.launch {
                        viewModel.deleteReminder(target.id).fold(
                            onSuccess = {
                                deletingReminder = null
                                toast.show(
                                    I18n.t("reminders.reminderDeleted") + "\n" +
                                        I18n.t("reminders.reminderDeletedDescription"),
                                )
                            },
                            onFailure = {
                                toast.show(I18n.t("reminders.deleteFailed"), isError = true)
                            },
                        )
                    }
                },
                title = I18n.t("reminders.deleteReminder"),
                message = I18n.t("deleteModal.areYouSure", "name" to target.title) + "\n" +
                    (if (target.description.isNotEmpty()) target.description + "\n" else "") +
                    I18n.t(
                        "reminders.dueBy",
                        "date" to (parseJsDate(target.dueAt)?.let { formatDateTime(it) } ?: target.dueAt),
                    ),
                deleteLabel = I18n.t("common.delete"),
            )
        }

        // Long-press menus
        longPressActivity?.let { activity ->
            LbMenuDialog(
                visible = true,
                title = activity.title,
                cancelLabel = I18n.t("common.cancel"),
                onDismiss = { longPressActivity = null },
                options = buildList {
                    add(
                        LbMenuOption(
                            text = I18n.t("activities.editActivity"),
                            icon = Icons.Outlined.Edit,
                            onClick = {
                                editingReminder = null
                                editingActivity = activity
                                showForm = true
                            },
                        ),
                    )
                    if (activity.todayCompletions > 0) {
                        add(
                            LbMenuOption(
                                text = I18n.t("activities.revertLast"),
                                icon = Icons.Outlined.Replay,
                                onClick = {
                                    scope.launch {
                                        viewModel.revertLastCompletion(activity).fold(
                                            onSuccess = {
                                                toast.show(
                                                    I18n.t("activities.completionReverted") + "\n" +
                                                        I18n.t(
                                                            "activities.revertedDescription",
                                                            "title" to activity.title,
                                                            "date" to formatShortDate(now),
                                                        ),
                                                )
                                            },
                                            onFailure = {
                                                toast.show(
                                                    I18n.t("common.error") + "\n" +
                                                        I18n.t("activities.failedToRevert"),
                                                    isError = true,
                                                )
                                            },
                                        )
                                    }
                                },
                            ),
                        )
                    }
                    add(
                        LbMenuOption(
                            text = I18n.t("activities.deleteActivity"),
                            icon = Icons.Outlined.Delete,
                            destructive = true,
                            onClick = { deletingActivity = activity },
                        ),
                    )
                },
            )
        }

        longPressReminder?.let { reminder ->
            val status = reminderStatus(reminder, now)
            LbMenuDialog(
                visible = true,
                title = reminder.title,
                cancelLabel = I18n.t("common.cancel"),
                onDismiss = { longPressReminder = null },
                options = buildList {
                    when (status) {
                        ReminderStatus.COMPLETED -> add(
                            LbMenuOption(
                                text = I18n.t("reminders.revertCompletion"),
                                icon = Icons.Outlined.Replay,
                                onClick = {
                                    scope.launch {
                                        viewModel.revertReminderCompletion(reminder).fold(
                                            onSuccess = {
                                                toast.show(
                                                    I18n.t("reminders.completionReverted") + "\n" +
                                                        I18n.t(
                                                            "reminders.revertDescription",
                                                            "title" to reminder.title,
                                                        ),
                                                )
                                            },
                                            onFailure = {
                                                toast.show(I18n.t("common.error"), isError = true)
                                            },
                                        )
                                    }
                                },
                            ),
                        )
                        ReminderStatus.ACTIVE, ReminderStatus.MISSED -> add(
                            LbMenuOption(
                                text = I18n.t("reminders.completeNow"),
                                icon = Icons.Outlined.Alarm,
                                onClick = {
                                    scope.launch {
                                        viewModel.completeReminder(reminder).fold(
                                            onSuccess = {
                                                toast.show(
                                                    I18n.t("reminders.reminderComplete") + "\n" +
                                                        I18n.t(
                                                            "reminders.reminderCompletedDescription",
                                                            "title" to reminder.title,
                                                        ),
                                                )
                                            },
                                            onFailure = {
                                                toast.show(I18n.t("common.error"), isError = true)
                                            },
                                        )
                                    }
                                },
                            ),
                        )
                        ReminderStatus.LOCKED -> { /* no completion options (RN parity) */ }
                    }
                    add(
                        LbMenuOption(
                            text = I18n.t("common.edit"),
                            icon = Icons.Outlined.Edit,
                            onClick = {
                                editingActivity = null
                                editingReminder = reminder
                                showForm = true
                            },
                        ),
                    )
                    add(
                        LbMenuOption(
                            text = I18n.t("reminders.deleteReminder"),
                            icon = Icons.Outlined.Delete,
                            destructive = true,
                            onClick = { deletingReminder = reminder },
                        ),
                    )
                },
            )
        }

        // Toast overlay lives in AppHost (one host per app root).
    }
}

/** Global streak banner (badge + "current (+ longest)" copy) above the list. */
@Composable
private fun StreakBanner(current: Int, longest: Int) {
    val colors = LocalAppColors.current
    val shape = RoundedCornerShape(12.dp)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier
            .padding(top = 16.dp)
            .fillMaxWidth()
            .clip(shape)
            .border(1.dp, colors.warning.copy(alpha = 0.4f), shape)
            .padding(16.dp),
    ) {
        LbStreakBadge(streak = StreakInfo(current = current, longest = longest))
        Column {
            Text(
                text = I18n.t("activities.globalStreakTitle"),
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = colors.foreground,
            )
            Text(
                text = I18n.t("activities.globalStreak", "count" to current) +
                    (if (longest > current) {
                        " " + I18n.t("activities.globalStreakLongest", "count" to longest)
                    } else {
                        ""
                    }),
                fontSize = 12.sp,
                color = colors.textMuted,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

/** Chips row of the active filter values + "Clear all" (web filter-chips parity). */
@Composable
private fun ActiveFilterChipsRow(
    filter: ActivityFilter,
    onClear: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val labels = buildList {
        filter.frequency?.let { add(activityLabel(it.wire)) }
        filter.dayTime?.let { add(activityLabel(it.wire)) }
        filter.scheduledFor?.let { date ->
            add(parseJsDate(date)?.let { formatShortDate(it) } ?: date)
        }
    }
    LbFilterChipsRow(
        labels = labels,
        clearLabel = I18n.t("common.clearAll"),
        onClear = onClear,
        modifier = modifier,
    )
}

/**
 * Placeholder composable kept for the phase-3 AppHost wiring; delegates to
 * the real [ActivitiesScreen] (AppHeader's `onNavigate` (not yet routed)
 * becomes a no-op there).
 */
@Deprecated(
    "Wiring placeholder — call ActivitiesScreen directly once AppHost routes are ported.",
    ReplaceWith("ActivitiesScreen { }"),
)
@Composable
fun ActivitiesPlaceholder() = ActivitiesScreen(onNavigate = { })
