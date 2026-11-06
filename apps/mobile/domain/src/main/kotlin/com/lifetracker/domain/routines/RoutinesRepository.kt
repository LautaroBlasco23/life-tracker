package com.lifetracker.domain.routines

import com.lifetracker.core.network.endpoints.RoutinesApi
import com.lifetracker.core.network.model.CreateRoutineRequest
import com.lifetracker.core.network.model.RoutineResponse
import com.lifetracker.core.network.model.UpdateRoutineRequest
import com.lifetracker.domain.auth.ApiError
import com.lifetracker.domain.auth.successOrThrow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Port of the RN `packages/shared/src/services/routine-service.ts`:
 * list/create/update(PATCH)/delete for the routines manager modal.
 *
 * List payloads are null-tolerant (`data ?: emptyList()`).
 */
@Singleton
class RoutinesRepository @Inject constructor(
    private val api: RoutinesApi,
) {

    /** GET /routines/me — the current user's routines. */
    suspend fun list(): Result<List<RoutineResponse>> = runCatching {
        api.getMyRoutines().successOrThrow().data ?: emptyList()
    }

    /** GET /routines/:id — single routine. */
    suspend fun get(id: Long): Result<RoutineResponse> = runCatching {
        api.getRoutine(id).successOrThrow().data
            ?: throw ApiError("Routine payload was missing")
    }

    /** POST /routines — create (create payloads are null-tolerant per KDoc). */
    suspend fun create(request: CreateRoutineRequest): Result<RoutineResponse> = runCatching {
        api.createRoutine(request).successOrThrow().data
            ?: throw ApiError("Created routine payload was missing")
    }

    /** PATCH /routines/:id — partial update (update is PATCH, not PUT). */
    suspend fun update(id: Long, request: UpdateRoutineRequest): Result<RoutineResponse> =
        runCatching {
            api.updateRoutine(id, request).successOrThrow().data
                ?: throw ApiError("Updated routine payload was missing")
        }

    /** DELETE /routines/:id — delete the routine (its activities are kept). */
    suspend fun delete(id: Long): Result<Unit> = runCatching {
        api.deleteRoutine(id).successOrThrow()
    }
}
