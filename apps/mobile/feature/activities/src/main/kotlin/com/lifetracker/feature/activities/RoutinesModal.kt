package com.lifetracker.feature.activities

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.KeyboardArrowDown
import androidx.compose.material.icons.outlined.KeyboardArrowUp
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.lifetracker.core.designsystem.LbButton
import com.lifetracker.core.designsystem.LbButtonVariant
import com.lifetracker.core.designsystem.LbDeleteConfirm
import com.lifetracker.core.designsystem.LbModalSheet
import com.lifetracker.core.designsystem.LbOptionSelect
import com.lifetracker.core.designsystem.LbSelectOption
import com.lifetracker.core.designsystem.LbTextField
import com.lifetracker.core.designsystem.LocalAppColors
import com.lifetracker.core.designsystem.ToastState
import com.lifetracker.core.i18n.I18n
import com.lifetracker.core.network.model.PrivacyStatus
import com.lifetracker.core.network.model.RoutineResponse
import com.lifetracker.core.network.model.RoutineStatus
import kotlinx.coroutines.launch

/**
 * Port of `components/activity/routines-modal.tsx`: list view (search +
 * status chips + cards), detail view (back, badges, start/stop, edit/delete,
 * activities by position with today's `n/m`) and the routine form modal.
 */

private val ROUTINE_STATUS_OPTIONS = listOf("draft", "active", "stopped")

@Composable
internal fun RoutinesModal(
    visible: Boolean,
    onClose: () -> Unit,
    toast: ToastState,
) {
    val colors = LocalAppColors.current
    val scope = rememberCoroutineScope()
    val viewModel: RoutinesViewModel = hiltViewModel()
    val state by viewModel.uiState.collectAsState()

    var selectedRoutineId by rememberSaveable { mutableStateOf<Long?>(null) }
    var search by rememberSaveable { mutableStateOf("") }
    var statusFilter by rememberSaveable { mutableStateOf("all") }
    var showForm by rememberSaveable { mutableStateOf(false) }
    var editing by rememberSaveable { mutableStateOf<RoutineResponse?>(null) }
    var deleting by rememberSaveable { mutableStateOf<RoutineResponse?>(null) }

    LaunchedEffect(visible) {
        if (visible) {
            selectedRoutineId = null
            search = ""
            statusFilter = "all"
            viewModel.loadRoutines().fold(
                onSuccess = { },
                onFailure = { toast.show(I18n.t("routines.failedToLoad"), isError = true) },
            )
        }
    }

    val routineList = state.routineList
    val selectedRoutine = routineList.firstOrNull { it.id == selectedRoutineId }

    val filtered = routineList.filter { routine ->
        if (statusFilter != "all" && routine.status != statusFilter) return@filter false
        val query = search.trim().lowercase()
        if (query.isNotEmpty()) {
            val haystack = "${routine.title} ${routine.description}".lowercase()
            if (!haystack.contains(query)) return@filter false
        }
        true
    }

    LbModalSheet(visible = visible, onDismiss = onClose, title = if (selectedRoutine == null) I18n.t("routines.title") else editingTitle(selectedRoutine)) {
        if (selectedRoutine != null) {
            RoutineDetailView(
                routine = selectedRoutine,
                updatingStatus = state.updatingStatus,
                onBack = { selectedRoutineId = null },
                onToggleStatus = { to ->
                    scope.launch {
                        viewModel.setStatus(selectedRoutine, to).fold(
                            onSuccess = { },
                            onFailure = { toast.show(I18n.t("routines.updateFailed"), isError = true) },
                        )
                    }
                },
                onEdit = { editing = selectedRoutine; showForm = true },
                onDelete = { deleting = selectedRoutine },
            )
        } else {
            Box {
                Column(Modifier.heightIn(max = 520.dp)) {
                    Text(
                        text = I18n.t("routines.description"),
                        fontSize = 14.sp,
                        color = colors.textMuted,
                        modifier = Modifier.padding(bottom = 12.dp),
                    )
                    // Search row
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(colors.background)
                            .border(1.dp, colors.border, RoundedCornerShape(8.dp))
                            .padding(horizontal = 12.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Search,
                            contentDescription = null,
                            tint = colors.textMuted,
                            modifier = Modifier.size(16.dp),
                        )
                        androidx.compose.foundation.text.BasicTextField(
                            value = search,
                            onValueChange = { search = it },
                            singleLine = true,
                            textStyle = androidx.compose.ui.text.TextStyle(
                                fontSize = 15.sp,
                                color = colors.foreground,
                            ),
                            modifier = Modifier
                                .weight(1f)
                                .height(40.dp)
                                .padding(start = 8.dp),
                        )
                    }

                    // Status chips
                    ChipRow(modifier = Modifier.padding(top = 10.dp, bottom = 10.dp)) {
                        (listOf("all") + ROUTINE_STATUS_OPTIONS).forEach { value ->
                            LbSmallChip(
                                text = if (value == "all") {
                                    I18n.t("routines.allStatuses")
                                } else {
                                    I18n.t("routines.status_$value")
                                },
                                selected = statusFilter == value,
                                onClick = { statusFilter = value },
                            )
                        }
                    }

                    if (state.isLoading) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(160.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            CircularProgressIndicator(color = colors.primary)
                        }
                    } else if (filtered.isEmpty()) {
                        Text(
                            text = if (routineList.isEmpty()) {
                                I18n.t("routines.noRoutines")
                            } else {
                                I18n.t("routines.noMatchingRoutines")
                            },
                            fontSize = 14.sp,
                            color = colors.textMuted,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 24.dp),
                        )
                    } else {
                        Column(
                            modifier = Modifier
                                .heightIn(max = 320.dp)
                                .verticalScroll(rememberScrollState()),
                        ) {
                            filtered.forEach { routine ->
                                RoutineListCard(
                                    routine = routine,
                                    onClick = { selectedRoutineId = routine.id },
                                )
                            }
                        }
                    }
                }

                // FAB (+) — bottom-right of the dialog sheet
                CreateFab(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(top = 12.dp),
                    onClick = {
                        editing = null
                        showForm = true
                    },
                )
            }
        }
    }

    RoutineFormModal(
        visible = showForm,
        routine = editing,
        onClose = {
            showForm = false
            editing = null
        },
        viewModel = viewModel,
        toast = toast,
    )

    deleting?.let { target ->
        LbDeleteConfirm(
            visible = true,
            name = target.title,
            onDismiss = { deleting = null },
            onConfirm = {
                scope.launch {
                    viewModel.deleteRoutine(target.id).fold(
                        onSuccess = {
                            if (selectedRoutineId == target.id) selectedRoutineId = null
                            deleting = null
                            toast.show(
                                I18n.t("routines.routineDeleted") + "\n" +
                                    I18n.t("routines.routineDeletedDescription"),
                            )
                        },
                        onFailure = {
                            toast.show(I18n.t("routines.deleteFailed"), isError = true)
                            // RN parity: modal stays open on failure.
                        },
                    )
                }
            },
            title = I18n.t("routines.deleteRoutine"),
            message = I18n.t("deleteModal.areYouSure", "name" to target.title) + "\n" +
                I18n.t("routines.activityCount", "count" to (target.activities?.size ?: 0)) + "\n" +
                I18n.t("routines.deleteRoutineKeepsActivities"),
            deleteLabel = I18n.t("routines.deleteRoutine"),
        )
    }
}

private fun editingTitle(routine: RoutineResponse?): String =
    routine?.title ?: I18n.t("routines.title")

@Composable
private fun RoutineListCard(routine: RoutineResponse, onClick: () -> Unit) {
    val colors = LocalAppColors.current
    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier = Modifier
            .padding(bottom = 8.dp)
            .clip(shape)
            .background(colors.surface)
            .border(1.dp, colors.border, shape)
            .clickable(onClick = onClick)
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = routine.title,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                color = colors.foreground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            if (routine.isCompletedToday) {
                Icon(
                    imageVector = Icons.Filled.Check,
                    contentDescription = null,
                    tint = colors.success,
                    modifier = Modifier
                        .padding(start = 6.dp)
                        .size(16.dp),
                )
            }
            RoutineStatusBadge(status = routine.status, modifier = Modifier.padding(start = 6.dp))
        }
        Text(
            text = I18n.t("routines.activityCount", "count" to (routine.activities?.size ?: 0)),
            fontSize = 12.sp,
            color = colors.textMuted,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}

@Composable
internal fun RoutineStatusBadge(status: String, modifier: Modifier = Modifier) {
    val colors = LocalAppColors.current
    val shape = RoundedCornerShape(6.dp)
    Text(
        text = I18n.t("routines.status_$status"),
        fontSize = 12.sp,
        color = colors.textMuted,
        modifier = modifier
            .alpha(if (status == "stopped") 0.8f else 1f)
            .clip(shape)
            .border(1.dp, colors.border, shape)
            .padding(horizontal = 6.dp, vertical = 2.dp),
    )
}

@Composable
private fun RoutineDetailView(
    routine: RoutineResponse,
    updatingStatus: Boolean,
    onBack: () -> Unit,
    onToggleStatus: (RoutineStatus) -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    val colors = LocalAppColors.current
    val status = routine.status.ifEmpty { "active" }

    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(
            imageVector = Icons.Outlined.ChevronLeft,
            contentDescription = I18n.t("routines.backToList"),
            tint = colors.primary,
            modifier = Modifier
                .size(20.dp)
                .clickable(onClick = onBack),
        )
        Text(
            text = I18n.t("routines.backToList"),
            fontSize = 14.sp,
            color = colors.textMuted,
            modifier = Modifier.clickable(onClick = onBack),
        )
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 12.dp, bottom = 4.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = routine.title,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = colors.foreground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f, fill = false),
            )
            if (routine.isCompletedToday) {
                Icon(
                    imageVector = Icons.Filled.Check,
                    contentDescription = null,
                    tint = colors.success,
                    modifier = Modifier.size(16.dp),
                )
            }
            RoutineStatusBadge(status = status)
            Text(
                text = I18n.t("privacy.${routine.privacyStatus}"),
                fontSize = 12.sp,
                color = colors.textMuted,
            )
        }
        if (routine.description.isNotEmpty()) {
            Text(
                text = routine.description,
                fontSize = 14.sp,
                color = colors.textMuted,
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(top = 6.dp),
        ) {
            if (status == "active") {
                LbButton(
                    text = I18n.t("routines.stop"),
                    onClick = { onToggleStatus(RoutineStatus.STOPPED) },
                    variant = LbButtonVariant.SECONDARY,
                    enabled = !updatingStatus,
                )
            } else {
                LbButton(
                    text = I18n.t("routines.start"),
                    onClick = { onToggleStatus(RoutineStatus.ACTIVE) },
                    enabled = !updatingStatus,
                )
            }
            Icon(
                imageVector = Icons.Outlined.Edit,
                contentDescription = I18n.t("common.edit"),
                tint = colors.primary,
                modifier = Modifier
                    .size(16.dp)
                    .clickable(onClick = onEdit),
            )
            Icon(
                imageVector = Icons.Outlined.Delete,
                contentDescription = I18n.t("common.delete"),
                tint = colors.danger,
                modifier = Modifier
                    .size(16.dp)
                    .clickable(onClick = onDelete),
            )
        }
    }

    Text(
        text = I18n.t("routines.activityCount", "count" to (routine.activities?.size ?: 0)),
        fontSize = 14.sp,
        color = colors.textMuted,
        modifier = Modifier.padding(top = 10.dp, bottom = 10.dp),
    )

    Column(
        modifier = Modifier
            .heightIn(max = 340.dp)
            .verticalScroll(rememberScrollState()),
    ) {
        (routine.activities ?: emptyList())
            .sortedBy { it.position }
            .forEach { item ->
                val isCompletedToday =
                    item.scheduledToday && item.todayCompletions >= item.completionAmount
                val shape = RoundedCornerShape(12.dp)
                Column(
                    modifier = Modifier
                        .padding(bottom = 8.dp)
                        .fillMaxWidth()
                        .clip(shape)
                        .background(colors.surface)
                        .border(
                            1.dp,
                            if (isCompletedToday) colors.success.copy(alpha = 0.5f) else colors.border,
                            shape,
                        )
                        .padding(16.dp),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text = "${item.position + 1}",
                            fontSize = 12.sp,
                            color = colors.textMuted,
                        )
                        Text(
                            text = item.activityTitle,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Medium,
                            color = if (isCompletedToday) colors.success else colors.foreground,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            text = "${item.todayCompletions}/${item.completionAmount}",
                            fontSize = 12.sp,
                            color = colors.textMuted,
                        )
                    }
                    if (item.description.isNotEmpty()) {
                        Text(
                            text = item.description,
                            fontSize = 14.sp,
                            color = colors.textMuted,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(top = 8.dp),
                    ) {
                        LbChip(text = activityLabel(item.frequency.wire))
                        if (item.dayTime.wire != "notSpecified") {
                            LbChip(text = activityLabel(item.dayTime.wire))
                        }
                        LbChip(text = I18n.t("privacy.${item.privacyStatus}"))
                    }
                }
            }
        if (routine.activities.isNullOrEmpty()) {
            Text(
                text = I18n.t("routines.noActivitiesInRoutine"),
                fontSize = 14.sp,
                color = colors.textMuted,
            )
        }
    }
}

@Composable
internal fun CreateFab(onClick: () -> Unit, modifier: Modifier = Modifier) {
    val colors = LocalAppColors.current
    Box(
        modifier = modifier
            .size(56.dp)
            .clip(RoundedCornerShape(28.dp))
            .background(colors.primary)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.material3.Text(
            text = "+",
            fontSize = 26.sp,
            color = colors.primaryForeground,
        )
    }
}

// ---- routine form ----

@Composable
private fun RoutineFormModal(
    visible: Boolean,
    routine: RoutineResponse?,
    onClose: () -> Unit,
    viewModel: RoutinesViewModel,
    toast: ToastState,
) {
    val colors = LocalAppColors.current
    val scope = rememberCoroutineScope()
    val formState by viewModel.uiState.collectAsState()

    var title by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("") }
    var privacy by rememberSaveable { mutableStateOf("private") }
    var status by rememberSaveable { mutableStateOf("active") }
    var selected by rememberSaveable { mutableStateOf(emptyList<RoutineActivityPick>()) }
    var isSaving by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(visible, routine) {
        if (!visible) return@LaunchedEffect
        title = routine?.title ?: ""
        description = routine?.description ?: ""
        privacy = routine?.privacyStatus?.ifEmpty { "private" } ?: "private"
        status = routine?.status?.ifEmpty { "active" } ?: "active"
        selected = (routine?.activities ?: emptyList())
            .sortedBy { it.position }
            .map { RoutineActivityPick(it.activityId, it.activityTitle) }
        viewModel.loadActivityPool().fold(
            onSuccess = { },
            onFailure = { toast.show(I18n.t("routines.failedToLoadActivities"), isError = true) },
        )
    }

    val pool = formState.activityPool
        .filterNot { pick -> selected.any { it.id == pick.id } }

    fun move(index: Int, delta: Int) {
        val target = index + delta
        if (target < 0 || target >= selected.size) return
        val next = selected.toMutableList()
        val lifted = next[target]
        next[target] = next[index]
        next[index] = lifted
        selected = next
    }

    fun submit() {
        if (title.trim().isEmpty()) {
            toast.show(
                I18n.t("routines.validationError") + "\n" + I18n.t("routines.titleLabel"),
                isError = true,
            )
            return
        }
        if (selected.isEmpty()) {
            toast.show(
                I18n.t("routines.validationError") + "\n" + I18n.t("routines.selectAtLeastOne"),
                isError = true,
            )
            return
        }
        isSaving = true
        scope.launch {
            val result = routine?.id?.let { id ->
                viewModel.updateRoutine(
                    id = id,
                    title = title.trim(),
                    description = description.trim(),
                    privacy = PrivacyStatus.valueOf(privacy.uppercase()),
                    status = RoutineStatus.valueOf(status.uppercase()),
                    selected = selected,
                )
            } ?: viewModel.createRoutine(
                title = title.trim(),
                description = description.trim(),
                privacy = PrivacyStatus.valueOf(privacy.uppercase()),
                status = RoutineStatus.valueOf(status.uppercase()),
                selected = selected,
            )
            isSaving = false
            result.fold(
                onSuccess = {
                    onClose()
                    toast.show(
                        if (routine != null) {
                            I18n.t("routines.routineUpdated") + "\n" +
                                I18n.t("routines.routineUpdatedDescription")
                        } else {
                            I18n.t("routines.routineCreated") + "\n" +
                                I18n.t("routines.routineCreatedDescription")
                        },
                    )
                },
                onFailure = {
                    toast.show(
                        I18n.t(if (routine != null) "routines.updateFailed" else "routines.createFailed"),
                        isError = true,
                    )
                },
            )
        }
    }

    LbModalSheet(
        visible = visible,
        onDismiss = onClose,
        title = if (routine != null) I18n.t("routines.editTitle") else I18n.t("routines.createTitle"),
    ) {
        Column(
            modifier = Modifier
                .heightIn(max = 540.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            LbTextField(
                value = title,
                onValueChange = { title = it },
                label = I18n.t("routines.titleLabel"),
                placeholder = I18n.t("routines.titlePlaceholder"),
            )
            LbTextField(
                value = description,
                onValueChange = { description = it },
                label = I18n.t("routines.descriptionLabel"),
                placeholder = I18n.t("routines.descriptionPlaceholder"),
            )
            LbOptionSelect(
                label = I18n.t("routines.statusLabel"),
                options = ROUTINE_STATUS_OPTIONS.map { s ->
                    LbSelectOption(value = s, label = I18n.t("routines.status_$s"))
                },
                selected = status,
                onSelect = { status = it },
            )
            LbOptionSelect(
                label = I18n.t("privacy.privacyStatus"),
                options = listOf(
                    LbSelectOption(value = "private", label = I18n.t("privacy.private")),
                    LbSelectOption(value = "public", label = I18n.t("privacy.public")),
                ),
                selected = privacy,
                onSelect = { privacy = it },
            )

            Text(I18n.t("routines.selectedActivities"), fontSize = 14.sp, color = colors.foreground)
            Text(
                I18n.t("routines.orderHint"),
                fontSize = 12.sp,
                color = colors.textMuted,
                modifier = Modifier.padding(top = (-4).dp),
            )
            if (selected.isEmpty()) {
                Text(
                    I18n.t("routines.noActivitiesSelectedYet"),
                    fontSize = 14.sp,
                    color = colors.textMuted,
                )
            } else {
                selected.forEachIndexed { index, pick ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .border(1.dp, colors.border, RoundedCornerShape(8.dp))
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                    ) {
                        Text(
                            text = pick.title,
                            fontSize = 15.sp,
                            color = colors.foreground,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f),
                        )
                        Icon(
                            imageVector = Icons.Outlined.KeyboardArrowUp,
                            contentDescription = null,
                            tint = if (index == 0) colors.textMuted else colors.primary,
                            modifier = Modifier
                                .padding(start = 4.dp)
                                .size(18.dp)
                                .clickable(enabled = index > 0) { move(index, -1) },
                        )
                        Icon(
                            imageVector = Icons.Outlined.KeyboardArrowDown,
                            contentDescription = null,
                            tint = if (index == selected.size - 1) colors.textMuted else colors.primary,
                            modifier = Modifier
                                .size(18.dp)
                                .clickable(enabled = index < selected.size - 1) { move(index, +1) },
                        )
                        Icon(
                            imageVector = Icons.Outlined.Close,
                            contentDescription = null,
                            tint = colors.textMuted,
                            modifier = Modifier
                                .padding(start = 4.dp)
                                .size(16.dp)
                                .clickable { selected = selected.filterNot { it.id == pick.id } },
                        )
                    }
                }
            }

            Text(
                I18n.t("routines.useExistingActivities"),
                fontSize = 14.sp,
                color = colors.foreground,
                modifier = Modifier.padding(top = 8.dp),
            )
            pool.forEach { pick ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .border(1.dp, colors.border, RoundedCornerShape(8.dp))
                        .clickable { selected = selected + pick }
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                ) {
                    Text(text = pick.title, fontSize = 15.sp, color = colors.foreground)
                }
            }
            if (pool.isEmpty() && formState.activityPool.isEmpty()) {
                Text(
                    I18n.t("routines.noActivitiesToPick"),
                    fontSize = 14.sp,
                    color = colors.textMuted,
                )
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
                    text = if (routine != null) I18n.t("routines.updateRoutine") else I18n.t("routines.createRoutine"),
                    onClick = { submit() },
                    modifier = Modifier.weight(1f),
                    loading = isSaving,
                )
            }
        }
    }
}
