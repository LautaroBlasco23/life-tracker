package com.lifetracker.feature.activities

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import com.lifetracker.core.network.model.ActivityIDPosition
import com.lifetracker.core.network.model.CreateRoutineRequest
import com.lifetracker.core.network.model.PrivacyStatus
import com.lifetracker.core.network.model.RoutineResponse
import com.lifetracker.core.network.model.RoutineStatus
import com.lifetracker.core.network.model.UpdateRoutineRequest
import com.lifetracker.domain.activities.ActivitiesRepository
import com.lifetracker.domain.routines.RoutinesRepository
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/**
 * State of the routines manager modal (`components/activity/routines-modal.tsx`):
 * my routines + the activity pool for the form; optimistic status changes.
 */
data class RoutinesUiState(
    val routineList: List<RoutineResponse> = emptyList(),
    val isLoading: Boolean = true,
    val activityPool: List<RoutineActivityPick> = emptyList(),
    val poolLoading: Boolean = false,
    val updatingStatus: Boolean = false,
)

/** Selected/pool entry of the routine form (id + title snapshot). */
data class RoutineActivityPick(val id: Long, val title: String)

@HiltViewModel
class RoutinesViewModel @Inject constructor(
    private val routines: RoutinesRepository,
    private val activities: ActivitiesRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(RoutinesUiState())
    val uiState: StateFlow<RoutinesUiState> = _uiState.asStateFlow()

    /** GET /routines/me (list view load; RN toasts the failure from the modal). */
    suspend fun loadRoutines(): Result<Unit> {
        _uiState.update { it.copy(isLoading = true) }
        val result = routines.list()
        result.onSuccess { list ->
            _uiState.update { it.copy(routineList = list, isLoading = false) }
        }
        if (result.isFailure) _uiState.update { it.copy(isLoading = false) }
        return result.map { _ -> }
    }

    /** Activity pool for the form modal (`GET /activities`, all of mine). */
    suspend fun loadActivityPool(): Result<Unit> {
        _uiState.update { it.copy(poolLoading = true) }
        val result = activities.list()
        result.onSuccess { list ->
            _uiState.update {
                it.copy(activityPool = list.map { a -> RoutineActivityPick(a.id, a.title) })
            }
        }
        _uiState.update { it.copy(poolLoading = false) }
        return result.map { _ -> }
    }

    suspend fun createRoutine(
        title: String,
        description: String,
        privacy: PrivacyStatus,
        status: RoutineStatus,
        selected: List<RoutineActivityPick>,
    ): Result<RoutineResponse> =
        routines.create(
            CreateRoutineRequest(
                title = title,
                description = description,
                privacyStatus = privacy,
                status = status,
                activityIds = selected.mapIndexed { index, item ->
                    ActivityIDPosition(activityId = item.id, position = index)
                },
            ),
        ).onSuccess { saved ->
            _uiState.update { s -> s.copy(routineList = listOf(saved) + s.routineList) }
        }

    suspend fun updateRoutine(
        id: Long,
        title: String,
        description: String,
        privacy: PrivacyStatus,
        status: RoutineStatus,
        selected: List<RoutineActivityPick>,
    ): Result<RoutineResponse> =
        routines.update(
            id,
            UpdateRoutineRequest(
                title = title,
                description = description,
                privacyStatus = privacy,
                status = status,
                activityIds = selected.mapIndexed { index, item ->
                    ActivityIDPosition(activityId = item.id, position = index)
                },
            ),
        ).onSuccess { saved ->
            _uiState.update { s ->
                s.copy(routineList = s.routineList.map { if (it.id == saved.id) saved else it })
            }
        }

    /** Optimistic status change (modal parity: revert + toast on failure). */
    suspend fun setStatus(routine: RoutineResponse, to: RoutineStatus): Result<Unit> {
        _uiState.update { s ->
            s.copy(
                updatingStatus = true,
                routineList = s.routineList.map { if (it.id == routine.id) it.copy(status = to.wire) else it },
            )
        }
        return runCatching {
            routines.update(routine.id, UpdateRoutineRequest(status = to)).getOrThrow()
        }.recoverCatching {
            _uiState.update { s ->
                s.copy(routineList = s.routineList.map { if (it.id == routine.id) routine else it })
            }
            throw it
        }.also {
            _uiState.update { s -> s.copy(updatingStatus = false) }
        }.map { updated ->
            _uiState.update { s ->
                s.copy(routineList = s.routineList.map { if (it.id == updated.id) updated else it })
            }
        }.map { _ -> }
    }

    /** Deletes on success only — the confirm modal stays open on failure. */
    suspend fun deleteRoutine(id: Long): Result<Unit> {
        val result = routines.delete(id)
        if (result.isSuccess) {
            _uiState.update { s -> s.copy(routineList = s.routineList.filterNot { it.id == id }) }
        }
        return result
    }

    private val RoutineStatus.wire: String
        get() = name.lowercase()
}
