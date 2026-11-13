package com.lifetracker.feature.time

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.lifetracker.core.designsystem.AppHeader
import com.lifetracker.core.designsystem.LbButton
import com.lifetracker.core.designsystem.LbButtonVariant
import com.lifetracker.core.designsystem.LbCard
import com.lifetracker.core.designsystem.LbOptionSelect
import com.lifetracker.core.designsystem.LbSegmentedTabs
import com.lifetracker.core.designsystem.LbSelectOption
import com.lifetracker.core.designsystem.LbTextField
import com.lifetracker.core.designsystem.LocalAppColors
import com.lifetracker.core.designsystem.LocalToast
import com.lifetracker.core.i18n.I18n
import com.lifetracker.core.network.model.TimeRecordResponse
import com.lifetracker.domain.lib.filters.monthLabel
import com.lifetracker.domain.lib.time.formatDuration
import com.lifetracker.domain.lib.time.formatRecordDate
import com.lifetracker.domain.lib.time.formatTimerDisplay
import com.lifetracker.domain.time.parseInstant
import com.lifetracker.domain.time.ActiveTimeSession
import com.lifetracker.domain.time.elapsedSeconds
import java.time.Instant
import java.time.LocalDate
import kotlinx.coroutines.launch

/** Accent tokens for the per-category headers (RN `CATEGORY_ACCENT_KEYS`). */
internal enum class AccentKey { PRIMARY, SECONDARY, SUCCESS, WARNING, DANGER }

private val RECORD_ACCENT_MAP: Map<String, AccentKey> = mapOf(
    "Work" to AccentKey.SECONDARY,
    "Personal" to AccentKey.SUCCESS,
    "Health" to AccentKey.DANGER,
    "Learning" to AccentKey.WARNING,
)

@Composable
private fun accentColor(key: AccentKey): Color {
    val colors = LocalAppColors.current
    return when (key) {
        AccentKey.PRIMARY -> colors.primary
        AccentKey.SECONDARY -> colors.secondary
        AccentKey.SUCCESS -> colors.success
        AccentKey.WARNING -> colors.warning
        AccentKey.DANGER -> colors.danger
    }
}

/** Derived stats block (RN `stats` useMemo). */
data class RecordStats(
    val totalMinutes: Int,
    val recordCount: Int,
    val topCategory: String?,
    val topCategoryMinutes: Int,
)

/**
 * Port of the RN time screen `app/(app)/time.tsx` — records tab (period
 * chips, filters, stats, grouped entries, active sessions, start card) plus
 * the calendar tab. Navigation goes through the shared `AppHeader`
 * (currentKey = "time") wired to the app NavHost by the caller.
 */
@Composable
fun TimeScreen(
    onNavigate: (String) -> Unit = {},
    viewModel: TimeViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val toast = LocalToast.current
    val colors = LocalAppColors.current

    // Screen-level modal state (RN `time.tsx` useState family).
    var showFilterModal by remember { mutableStateOf(false) }
    var showFormModal by remember { mutableStateOf(false) }
    var editingRecord by remember { mutableStateOf<TimeRecordResponse?>(null) }
    var deletingRecord by remember { mutableStateOf<TimeRecordResponse?>(null) }
    var actionsRecord by remember { mutableStateOf<TimeRecordResponse?>(null) }

    // Timer start inputs (RN keeps those at screen level, across tab switches).
    var timerCategory by remember { mutableStateOf<String?>(null) }
    var timerDescription by remember { mutableStateOf("") }

    // One-shot feedback from the async effects (load failures + sessions).
    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                TimeEvent.RecordsLoadFailed -> toast.show(I18n.t("time.failedToLoad"), isError = true)
                is TimeEvent.EventsLoadFailed ->
                    toast.show(toastText(I18n.t("calendar.failedToLoad"), event.error), isError = true)
                TimeEvent.SessionCategoryRequired ->
                    toast.show(toastText(t("categoryRequired"), t("categoryRequiredDescription")), isError = true)
                TimeEvent.SessionDescriptionRequired ->
                    toast.show(toastText(t("descriptionRequired"), t("descriptionRequiredDescription")), isError = true)
                is TimeEvent.SessionSaveFailed ->
                    toast.show(toastText(t("failedToSave"), event.error), isError = true)
                is TimeEvent.SessionSaved ->
                    toast.show(
                        toastText(t("timeRecorded"), t("timeRecordedDescription", "duration" to event.duration, "category" to event.category)),
                    )
            }
        }
    }

    // RN `useFocusEffect` on the records tab: also refires on period/filter.
    LaunchedEffect(state.view, state.period, state.filter) {
        if (state.view == TimeView.RECORDS) {
            viewModel.loadRecords()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Hamburger navigation (RN `components/navigation.tsx` port).
            AppHeader(title = "LifeTracker", onProfile = { onNavigate("profile") })
            Text(
                t("title"),
                fontSize = 24.sp,
                fontWeight = FontWeight.SemiBold,
                color = colors.foreground,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
            Spacer(Modifier.height(16.dp))
            LbSegmentedTabs(
                items = listOf(I18n.t("calendar.recordsTab"), I18n.t("calendar.tab")),
                selectedIndex = if (state.view == TimeView.RECORDS) 0 else 1,
                onSelect = { index ->
                    viewModel.setView(if (index == 0) TimeView.RECORDS else TimeView.CALENDAR)
                },
                modifier = Modifier.padding(horizontal = 16.dp),
            )

            when (state.view) {
                TimeView.RECORDS -> RecordsTab(
                    state = state,
                    viewModel = viewModel,
                    timerCategory = timerCategory,
                    timerDescription = timerDescription,
                    onTimerCategoryChange = { timerCategory = it },
                    onTimerDescriptionChange = { timerDescription = it },
                    onStartTimer = {
                        if (viewModel.startSession(timerCategory ?: "", timerDescription)) {
                            timerCategory = null
                            timerDescription = ""
                        }
                    },
                    onOpenFilters = { showFilterModal = true },
                    onOpenCreateModal = {
                        editingRecord = null
                        showFormModal = true
                    },
                    onPeriodChange = viewModel::setPeriod,
                    onRecordActions = { actionsRecord = it },
                )
                TimeView.CALENDAR -> CalendarTab(
                    viewModel = viewModel,
                    view = state.view,
                    events = state.events,
                    isLoadingEvents = state.isLoadingEvents,
                    eventsReloadKey = state.eventsReloadKey,
                    toast = toast,
                )
            }
        }

        // Toast overlay composes above everything (RN global toast port).
    }

    // ---- screen modals (RN renders these at the screen root) ----

    RecordActionsModal(
        record = actionsRecord,
        onDismiss = { actionsRecord = null },
        onEdit = { record ->
            editingRecord = record
            showFormModal = true
        },
        onDelete = { record -> deletingRecord = record },
    )

    RecordFormModal(
        visible = showFormModal,
        onDismiss = {
            showFormModal = false
            editingRecord = null
        },
        record = editingRecord,
        onCreate = viewModel::createManualRecord,
        onUpdate = viewModel::updateManualRecord,
        toast = toast,
    )

    val deleteTarget = deletingRecord
    DeleteModal(
        visible = deleteTarget != null,
        onDismiss = { deletingRecord = null },
        title = I18n.t("time.deleteTimeEntry"),
        itemName = deleteTarget?.description ?: "",
        confirmLabel = I18n.t("time.deleteEntry"),
        details = if (deleteTarget != null) {
            { RecordDeleteDetails(record = deleteTarget) }
        } else {
            null
        },
        onConfirm = {
            val record = deleteTarget ?: return@DeleteModal ""
            val error = viewModel.deleteRecord(record)
            if (error == null) {
                toast.show(
                    toastText(I18n.t("time.recordDeleted"), I18n.t("time.recordDeletedDescription")),
                )
            } else {
                toast.show(toastText(I18n.t("time.deleteFailed"), error), isError = true)
            }
            error
        },
    )

    FilterModal(
        visible = showFilterModal,
        title = I18n.t("time.filterTimeRecords"),
        currentFilter = state.filter,
        onApply = viewModel::applyFilter,
        onDismiss = { showFilterModal = false },
    )
}

/// ---------------------------------------------------------------------
/// Records tab
/// ---------------------------------------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RecordsTab(
    state: TimeUiState,
    viewModel: TimeViewModel,
    timerCategory: String?,
    timerDescription: String,
    onTimerCategoryChange: (String?) -> Unit,
    onTimerDescriptionChange: (String) -> Unit,
    onStartTimer: () -> Unit,
    onOpenFilters: () -> Unit,
    onOpenCreateModal: () -> Unit,
    onPeriodChange: (TimePeriod) -> Unit,
    onRecordActions: (TimeRecordResponse) -> Unit,
) {
    val colors = LocalAppColors.current
    val now = LocalDate.now()

    val periodLabel = when (state.period) {
        TimePeriod.THIS_WEEK -> I18n.t("time.thisWeek")
        TimePeriod.THIS_MONTH -> monthLabel({ key -> I18n.t("months.$key") }, now.monthValue)
        TimePeriod.LAST_MONTH -> {
            val previous = if (now.monthValue == 1) 12 else now.monthValue - 1
            monthLabel({ key -> I18n.t("months.$key") }, previous)
        }
        TimePeriod.ALL_TIME -> I18n.t("time.allTime")
    }

    val grouped = remember(state.records) {
        state.records
            .groupBy { it.category }
            .entries
            // JS comparator: newest record of each section first ("[0]" entry).
            .sortedByDescending { (_, sectionRecords) ->
                sectionRecords.firstOrNull()
                    ?.let { parseInstant(it.createdAt)?.toInstant() }
                    ?: Instant.EPOCH
            }
            .map { (category, sectionRecords) -> category to sectionRecords }
    }
    val stats = remember(state.records) {
        val totals = state.records
            .groupingBy { it.category }
            .fold(0) { sum, record -> sum + record.durationMinutes }
        val top = totals.entries.maxByOrNull { it.value }
        RecordStats(
            totalMinutes = state.records.sumOf { it.durationMinutes },
            recordCount = state.records.size,
            topCategory = top?.key,
            topCategoryMinutes = top?.value ?: 0,
        )
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 96.dp),
    ) {
        // ===================== RN ListHeaderComponent =====================
        item {
            Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                Text(
                    text = if (state.period == TimePeriod.ALL_TIME) {
                        I18n.t("time.allRecords")
                    } else {
                        t("viewing", "period" to periodLabel)
                    },
                    fontSize = 14.sp,
                    color = colors.textMuted,
                    modifier = Modifier.padding(top = 4.dp),
                )
                Spacer(Modifier.height(12.dp))

                // ---- action row: Filters (n) + Log Time ----
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LbButton(
                        text = buildString {
                            append(I18n.t("common.filters"))
                            if (state.filterCount > 0) append(" (${state.filterCount})")
                        },
                        onClick = onOpenFilters,
                        modifier = Modifier.height(36.dp),
                        variant = LbButtonVariant.SECONDARY,
                    )
                    LbButton(
                        text = t("logTime"),
                        onClick = onOpenCreateModal,
                        modifier = Modifier.height(36.dp),
                    )
                }
                Spacer(Modifier.height(12.dp))

                // ---- period chips ----
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(bottom = 16.dp),
                ) {
                    TimePeriod.entries.forEach { period ->
                        val selected = state.period == period
                        Text(
                            text = I18n.t("time.${period.key}"),
                            fontSize = 14.sp,
                            color = if (selected) colors.primaryForeground else colors.textMuted,
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .then(
                                    if (selected) {
                                        Modifier
                                            .background(colors.primary)
                                            .border(1.dp, colors.primary, RoundedCornerShape(8.dp))
                                    } else {
                                        Modifier.border(1.dp, colors.border, RoundedCornerShape(8.dp))
                                    }
                                )
                                .clickable(
                                    interactionSource = remember { MutableInteractionSource() },
                                    indication = null,
                                    onClick = { onPeriodChange(period) },
                                )
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                        )
                    }
                }

                // ---- active sessions (persisted across restarts) ----
                if (state.sessions.isNotEmpty()) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.padding(bottom = 24.dp),
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Icon(
                                imageVector = TimeIcons.Timer,
                                contentDescription = null,
                                tint = colors.primary,
                                modifier = Modifier.size(18.dp),
                            )
                            Text(
                                t("activeRecordings"),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = colors.foreground,
                            )
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(colors.primary.copy(alpha = 0.1f))
                                    .padding(horizontal = 8.dp, vertical = 2.dp),
                            ) {
                                Text(
                                    state.sessions.size.toString(),
                                    fontSize = 12.sp,
                                    color = colors.primary,
                                )
                            }
                        }
                        state.sessions.forEach { session ->
                            ActiveSessionCard(
                                session = session,
                                now = state.now,
                                isSaving = state.savingSessionId == session.id,
                                viewModel = viewModel,
                            )
                        }
                    }
                }

                // ---- start recording card (web parity) ----
                StartRecordingCard(
                    timerCategory = timerCategory,
                    timerDescription = timerDescription,
                    onTimerCategoryChange = onTimerCategoryChange,
                    onTimerDescriptionChange = onTimerDescriptionChange,
                    onStart = onStartTimer,
                    modifier = Modifier.padding(bottom = 24.dp),
                )

                // ---- stats cards ----
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp),
                ) {
                    StatCard(
                        label = t("totalTime"),
                        value = formatDuration(stats.totalMinutes),
                        modifier = Modifier.weight(1f),
                    )
                    StatCard(
                        label = t("entries"),
                        value = stats.recordCount.toString(),
                        modifier = Modifier.weight(1f),
                    )
                    StatCard(
                        label = t("topCategory"),
                        value = stats.topCategory ?: I18n.t("common.na"),
                        subline = if (stats.topCategory == null) null else formatDuration(stats.topCategoryMinutes),
                        singleLineValue = true,
                        modifier = Modifier.weight(1f),
                    )
                }

                // ---- empty state (differentiated: filter vs period) ----
                if (state.records.isEmpty() && !state.isLoadingRecords) {
                    EmptyRecords(
                        filtered = state.filterCount > 0,
                        periodLabel = periodLabel,
                    )
                }
            }
        }

        // ===================== grouped sections =====================
        grouped.forEach { (category, categoryRecords) ->
            item(key = category) {
                Column(modifier = Modifier.padding(bottom = 16.dp)) {
                    val categoryTotal = categoryRecords.sumOf { it.durationMinutes }
                    CategoryHeader(
                        icon = TimeIcons.Clock,
                        label = category,
                        accentColor = accentColor(RECORD_ACCENT_MAP[category] ?: AccentKey.PRIMARY),
                        iconColor = accentColor(RECORD_ACCENT_MAP[category] ?: AccentKey.PRIMARY),
                        summaryValue = formatDuration(categoryTotal),
                        itemCount = categoryRecords.size,
                        itemName = t("entry"),
                    )
                    Column(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(horizontal = 16.dp),
                    ) {
                        categoryRecords.forEach { record ->
                            RecordRow(
                                record = record,
                                onLongPress = { onRecordActions(record) },
                            )
                        }
                    }
                }
            }
        }
    }
}

/// ---------------------------------------------------------------------
/// Local composables mirroring RN `components/ui/category-header.tsx` etc.
/// ---------------------------------------------------------------------

/** Section header with accent border + summary (RN `CategoryHeader` usage). */
@Composable
private fun CategoryHeader(
    icon: ImageVector,
    label: String,
    accentColor: Color,
    iconColor: Color,
    summaryValue: String,
    itemCount: Int,
    itemName: String,
) {
    val colors = LocalAppColors.current
    Row(modifier = Modifier.height(IntrinsicSize.Min)) {
        Box(
            modifier = Modifier
                .width(4.dp)
                .fillMaxHeight()
                .background(accentColor),
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier
                .weight(1f)
                .padding(start = 12.dp, end = 16.dp, top = 16.dp, bottom = 16.dp),
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = iconColor,
                modifier = Modifier.size(24.dp),
            )
            Text(
                label,
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = colors.foreground,
                modifier = Modifier.weight(1f),
            )
            Column(horizontalAlignment = Alignment.End) {
                Text(summaryValue, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = iconColor)
                Text(
                    "${itemCount} ${pluralizedName(itemName, itemCount)}",
                    fontSize = 14.sp,
                    color = colors.textMuted,
                )
            }
        }
    }
}

/** One record card, long-press → Edit/Delete/Cancel alert (RN behavior). */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun RecordRow(record: TimeRecordResponse, onLongPress: () -> Unit) {
    val colors = LocalAppColors.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .border(1.dp, colors.border, RoundedCornerShape(12.dp))
            .background(colors.surface)
            .combinedClickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = {},
                onLongClick = onLongPress,
            )
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                Text(
                    record.description,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    color = colors.foreground,
                )
                Text(
                    formatRecordDate(record.createdAt),
                    fontSize = 12.sp,
                    color = colors.textMuted,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Text(
                formatDuration(record.durationMinutes),
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = colors.foreground,
            )
        }
    }
}

/** RN `components/time/active-session-card.tsx` port. */
@Composable
private fun ActiveSessionCard(
    session: ActiveTimeSession,
    now: Long,
    isSaving: Boolean,
    viewModel: TimeViewModel,
) {
    val colors = LocalAppColors.current
    val scope = rememberCoroutineScope()
    val isRunning = session.startedAt != null
    val elapsed = elapsedSeconds(session, now)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(colors.surface)
            .border(
                1.dp,
                if (isRunning) colors.primary.copy(alpha = 0.6f) else colors.border,
                RoundedCornerShape(12.dp),
            )
            .padding(16.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
        ) {
            Icon(
                imageVector = TimeIcons.Timer,
                contentDescription = null,
                tint = colors.primary,
                modifier = Modifier.size(18.dp),
            )
            Text(
                session.description.ifEmpty { session.category },
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = colors.foreground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(colors.primary.copy(alpha = 0.1f))
                    .padding(horizontal = 8.dp, vertical = 2.dp),
            ) {
                Text(session.category, fontSize = 12.sp, color = colors.primary)
            }
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                text = formatTimerDisplay(elapsed),
                style = androidx.compose.ui.text.TextStyle(
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    fontFeatureSettings = "tnum",
                    color = if (isRunning) colors.primary else colors.textMuted,
                ),
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (isRunning) {
                    LbButton(
                        text = t("stop"),
                        onClick = { viewModel.pauseSession(session.id) },
                        modifier = Modifier,
                        variant = LbButtonVariant.DANGER,
                    )
                } else {
                    LbButton(
                        text = t("resume"),
                        onClick = { viewModel.resumeSession(session.id) },
                        variant = LbButtonVariant.SECONDARY,
                    )
                    LbButton(
                        text = if (isSaving) I18n.t("common.saving") else t("save"),
                        onClick = { scope.launch { viewModel.saveActiveSession(session) } },
                        loading = isSaving,
                    )
                }
                // Discard: trash icon button, immediate (no confirmation).
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = { viewModel.discardSession(session.id) },
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = TimeIcons.Trash,
                        contentDescription = t("discard"),
                        tint = colors.textMuted,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
        }
    }
}

/** Start-recording card (web parity): category + description + Start. */
@Composable
private fun StartRecordingCard(
    timerCategory: String?,
    timerDescription: String,
    onTimerCategoryChange: (String?) -> Unit,
    onTimerDescriptionChange: (String) -> Unit,
    onStart: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = LocalAppColors.current
    Column(modifier = modifier) {
        LbCard {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(bottom = 16.dp),
            ) {
                Icon(
                    imageVector = TimeIcons.Timer,
                    contentDescription = null,
                    tint = colors.textMuted,
                    modifier = Modifier.size(18.dp),
                )
                Text(
                    t("startRecording"),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = colors.foreground,
                )
            }
            // Same raw-name labels as the RN start card (+ filter options).
            LbOptionSelect(
                label = t("category"),
                options = TIME_CATEGORIES.map { LbSelectOption(it, it) },
                selected = timerCategory,
                onSelect = onTimerCategoryChange,
                placeholder = t("selectCategory"),
            )
            Spacer(Modifier.height(16.dp))
            LbTextField(
                value = timerDescription,
                onValueChange = onTimerDescriptionChange,
                label = t("description"),
                placeholder = t("whatAreYouWorkingOn"),
            )
            Spacer(Modifier.height(16.dp))
            LbButton(text = t("start"), onClick = onStart, modifier = Modifier.fillMaxWidth())
        }
    }
}

/** One "total time / entries / top category" stat card. */
@Composable
private fun StatCard(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    subline: String? = null,
    singleLineValue: Boolean = false,
) {
    val colors = LocalAppColors.current
    LbCard(modifier = modifier) {
        Text(label, fontSize = 14.sp, color = colors.textMuted)
        Text(
            value,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = colors.foreground,
            maxLines = if (singleLineValue) 1 else Int.MAX_VALUE,
            overflow = if (singleLineValue) TextOverflow.Ellipsis else TextOverflow.Clip,
            modifier = Modifier.padding(top = 4.dp),
        )
        if (subline != null) {
            Text(
                subline,
                fontSize = 12.sp,
                color = colors.textMuted,
            )
        }
    }
}

/** Empty-list state, RN filter vs period variants. */
@Composable
private fun EmptyRecords(filtered: Boolean, periodLabel: String) {
    val colors = LocalAppColors.current
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxWidth().padding(bottom = 32.dp, top = 8.dp),
    ) {
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(CircleShape)
                .background(colors.surface),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = TimeIcons.Clock,
                contentDescription = null,
                tint = colors.textMuted,
                modifier = Modifier.size(28.dp),
            )
        }
        Text(
            if (filtered) I18n.t("time.noEntriesMatch")
            else t("noEntriesFor", "period" to periodLabel.lowercase()),
            fontSize = 18.sp,
            fontWeight = FontWeight.Medium,
            color = colors.foreground,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            if (filtered) I18n.t("time.tryAdjusting")
            else I18n.t("time.startRecordingOrLog"),
            fontSize = 14.sp,
            color = colors.textMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}

/** Delete-modal details box: "category · duration". */
@Composable
private fun RecordDeleteDetails(record: TimeRecordResponse) {
    val colors = LocalAppColors.current
    Text(
        text = "${record.category} · ${formatDuration(record.durationMinutes)}",
        fontSize = 14.sp,
        color = colors.foreground,
    )
}
