package com.lifetracker.feature.activities

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import com.lifetracker.core.network.model.ActivityResponse
import com.lifetracker.core.network.model.CreateActivityRequest
import com.lifetracker.core.network.model.CreateReminderRequest
import com.lifetracker.core.network.model.RecordActivityRequest
import com.lifetracker.core.network.model.ReminderResponse
import com.lifetracker.core.network.model.StreakInfo
import com.lifetracker.core.network.model.UpdateActivityRequest
import com.lifetracker.core.network.model.UpdateReminderRequest
import com.lifetracker.domain.activities.ActivityFilter
import com.lifetracker.domain.activities.ActivitiesRepository
import com.lifetracker.domain.reminders.RemindersRepository
import javax.inject.Inject
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** All render state of the Activities screen. */
data class ActivitiesUiState(
    val activities: List<ActivityResponse> = emptyList(),
    val globalStreak: StreakInfo? = null,
    val reminders: List<ReminderResponse> = emptyList(),
    /** Full-screen spinner on first load only (RN parity). */
    val isLoading: Boolean = true,
    /** Inline "failed to load" text (RN parity; reminders never block this). */
    val loadFailed: Boolean = false,
    val processingIds: Set<Long> = emptySet(),
    val reminderProcessingIds: Set<Long> = emptySet(),
    /** Shared clock snapshot re-derived every 30 s for reminder statuses. */
    val nowMillis: Long = System.currentTimeMillis(),
    val filter: ActivityFilter? = null,
)

/**
 * Port of the state of `app/(app)/activities.tsx`: today/filtered activity
 * list + global streak, reminders with a 30 s status re-derivation tick, and
 * the optimistic record/revert/delete/complete flows from the QA checklist.
 */
@HiltViewModel
class ActivitiesViewModel @Inject constructor(
    private val activities: ActivitiesRepository,
    private val reminders: RemindersRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ActivitiesUiState())
    val uiState: StateFlow<ActivitiesUiState> = _uiState.asStateFlow()

    init {
        refresh()
        // 30 s tick: re-derives reminder statuses (locked → active, missed…) when
        // the inflight clock snapshot changes. Minute precision is enough.
        viewModelScope.launch {
            while (true) {
                delay(30_000)
                _uiState.update { it.copy(nowMillis = System.currentTimeMillis()) }
            }
        }
    }

    /** Focus-refetch (RN `useFocusEffect`): list+streak in parallel, then reminders. */
    fun refresh() {
        viewModelScope.launch {
            loadActivities()
            loadReminders()
        }
    }

    private suspend fun loadReminders() {
        reminders.list()
            .onSuccess { list -> _uiState.update { it.copy(reminders = list) } }
            // Reminder load failures shouldn't block the activities list (RN parity).
            .onFailure { }
    }

    // ---- filter ----

    /** Applies a filter (or clears it) and refetches the list. */
    fun applyFilter(filter: ActivityFilter?) {
        _uiState.update { it.copy(filter = filter) }
        viewModelScope.launch { loadActivities() }
    }

    private suspend fun loadActivities() {
        val filter = _uiState.value.filter
        runCatching {
            val items = filter?.let { activities.list(it).getOrThrow() }
                ?: activities.today().getOrThrow()
            val streak = activities.streak().getOrThrow()
            items to streak
        }.onSuccess { (items, streak) ->
            _uiState.update {
                it.copy(activities = items, globalStreak = streak, loadFailed = false, isLoading = false)
            }
        }.onFailure {
            _uiState.update { it.copy(loadFailed = true, isLoading = false) }
        }
    }

    // ---- activity completions (optimistic + revert) ----

    /**
     * `handleRecordCompletion`: +1 optimistic; reaching the target turns the
     * card completed and bumps the streak badge; reverted from server error.
     */
    suspend fun recordCompletion(activity: ActivityResponse): Result<Unit> {
        setProcessing(activity.id, true)
        val newCompletions = activity.todayCompletions + 1
        val isNowCompleted = newCompletions >= activity.completionAmount
        val optimistic = activity.copy(
            todayCompletions = newCompletions,
            isCompletedToday = isNowCompleted,
            streak = if (isNowCompleted) {
                activity.streak?.let { s ->
                    s.copy(current = s.current + 1, longest = maxOf(s.longest, s.current + 1))
                }
            } else {
                activity.streak
            },
        )
        upsertActivity(optimistic)
        return runCatching {
            activities.record(activity.id, RecordActivityRequest()).getOrThrow()
        }.recoverCatching {
            upsertActivity(activity)
            throw it
        }.also {
            setProcessing(activity.id, false)
        }.map { _ -> }
    }

    /**
     * `handleRevertCompletion`: −1 optimistic; dropping below the target
     * un-greens the card and lowers the streak badge; reverted from server error.
     */
    suspend fun revertLastCompletion(activity: ActivityResponse): Result<Unit> {
        setProcessing(activity.id, true)
        val oldCompletions = activity.todayCompletions
        val newCompletions = if (oldCompletions > 0) oldCompletions - 1 else 0
        val wasCompleted = activity.isCompletedToday
        val isStillCompleted = newCompletions >= activity.completionAmount
        val optimistic = activity.copy(
            todayCompletions = newCompletions,
            isCompletedToday = isStillCompleted,
            streak = if (wasCompleted && !isStillCompleted) {
                activity.streak?.let { s -> s.copy(current = maxOf(0, s.current - 1)) }
            } else {
                activity.streak
            },
        )
        upsertActivity(optimistic)
        return runCatching {
            activities.revertLast(activity.id).getOrThrow()
        }.recoverCatching {
            upsertActivity(activity)
            throw it
        }.also {
            setProcessing(activity.id, false)
        }.map { _ -> }
    }

    /** Deletes on success only — the confirm modal stays open on failure. */
    suspend fun deleteActivity(id: Long): Result<Unit> {
        val result = activities.delete(id)
        if (result.isSuccess) {
            _uiState.update { s -> s.copy(activities = s.activities.filterNot { a -> a.id == id }) }
        }
        return result
    }

    // ---- activity create / update (form modal + templates) ----

    suspend fun createActivity(request: CreateActivityRequest): Result<ActivityResponse> =
        activities.create(request).onSuccess { saved ->
            upsertActivity(saved)
        }

    suspend fun updateActivity(id: Long, request: UpdateActivityRequest): Result<ActivityResponse> =
        activities.update(id, request).onSuccess { saved ->
            upsertActivity(saved)
        }

    private fun upsertActivity(saved: ActivityResponse) {
        _uiState.update { s ->
            val exists = s.activities.any { it.id == saved.id }
            val nextActivities = if (exists) {
                s.activities.map { if (it.id == saved.id) saved else it }
            } else {
                listOf(saved) + s.activities
            }
            s.copy(activities = nextActivities)
        }
    }

    private fun setProcessing(id: Long, processing: Boolean) {
        _uiState.update { s ->
            val next = if (processing) s.processingIds + id else s.processingIds - id
            s.copy(processingIds = next)
        }
    }

    private fun setReminderProcessing(id: Long, processing: Boolean) {
        _uiState.update { s ->
            val next = if (processing) s.reminderProcessingIds + id else s.reminderProcessingIds - id
            s.copy(reminderProcessingIds = next)
        }
    }

    // ---- reminders ----

    /** Optimistic completedAt, then replaced by the server payload; reverted on error. */
    suspend fun completeReminder(reminder: ReminderResponse): Result<ReminderResponse> {
        setReminderProcessing(reminder.id, true)
        val optimistic = reminder.copy(completedAt = toIsoInstant(java.time.ZonedDateTime.now()))
        updateReminderState(optimistic)
        return runCatching {
            reminders.complete(reminder.id).getOrThrow().also { saved ->
                updateReminderState(saved)
            }
        }.recoverCatching {
            updateReminderState(reminder)
            throw it
        }.also {
            setReminderProcessing(reminder.id, false)
        }
    }

    /** Optimistic completedAt=null; reverted on error. */
    suspend fun revertReminderCompletion(reminder: ReminderResponse): Result<Unit> {
        setReminderProcessing(reminder.id, true)
        updateReminderState(reminder.copy(completedAt = null))
        return runCatching {
            reminders.revertCompletion(reminder.id).getOrThrow()
        }.recoverCatching {
            updateReminderState(reminder)
            throw it
        }.also {
            setReminderProcessing(reminder.id, false)
        }
    }

    /** Deletes on success only — the confirm modal stays open on failure. */
    suspend fun deleteReminder(id: Long): Result<Unit> {
        val result = reminders.delete(id)
        if (result.isSuccess) {
            _uiState.update { s -> s.copy(reminders = s.reminders.filterNot { r -> r.id == id }) }
        }
        return result
    }

    // ---- reminders create / update (form modal) ----

    suspend fun createReminder(request: CreateReminderRequest): Result<ReminderResponse> =
        reminders.create(request).onSuccess { saved ->
            upsertReminder(saved)
        }

    suspend fun updateReminder(id: Long, request: UpdateReminderRequest): Result<ReminderResponse> =
        reminders.update(id, request).onSuccess { saved ->
            upsertReminder(saved)
        }

    private fun upsertReminder(saved: ReminderResponse) {
        _uiState.update { s ->
            val exists = s.reminders.any { it.id == saved.id }
            val next = if (exists) {
                s.reminders.map { if (it.id == saved.id) saved else it }
            } else {
                listOf(saved) + s.reminders
            }
            s.copy(reminders = next)
        }
    }

    private fun updateReminderState(updated: ReminderResponse) {
        _uiState.update { s ->
            s.copy(reminders = s.reminders.map { if (it.id == updated.id) updated else it })
        }
    }
}
