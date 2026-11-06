package com.lifetracker.domain.activities

import com.lifetracker.core.network.endpoints.ActivitiesApi
import com.lifetracker.core.network.model.ActivityRecordResponse
import com.lifetracker.core.network.model.ActivityResponse
import com.lifetracker.core.network.model.CreateActivityRequest
import com.lifetracker.core.network.model.Frequency
import com.lifetracker.core.network.model.DayTime
import com.lifetracker.core.network.model.RecordActivityRequest
import com.lifetracker.core.network.model.StreakInfo
import com.lifetracker.core.network.model.UpdateActivityRequest
import com.lifetracker.domain.auth.ApiError
import com.lifetracker.domain.auth.successOrThrow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Filter params of `GET /activities` (RN `ActivityFilter`): all optional; a
 * non-null filter switches the screen from `/activities/today` to the filter
 * endpoint. Wire names stay at the API: `day_time`, `scheduled_for`.
 */
data class ActivityFilter(
    val frequency: Frequency? = null,
    val dayTime: DayTime? = null,
    /** `YYYY-MM-DD` scheduled-for date filter. */
    val scheduledFor: String? = null,
)

/**
 * Port of the RN `packages/shared/src/services/activity-service.ts`:
 * today/list/streak/loading and the record/revert completion flows the
 * Activities screen drives optimistically.
 *
 * List payloads are null-tolerant (`data ?: emptyList()`); single payloads
 * missing `data` surface an [ApiError] like the RN `throw new Error(...)`.
 */
@Singleton
class ActivitiesRepository @Inject constructor(
    private val api: ActivitiesApi,
) {

    /** GET /activities — filtered list (`ActivityFilter` params, all optional). */
    suspend fun list(filter: ActivityFilter? = null): Result<List<ActivityResponse>> = runCatching {
        api.getActivities(
            frequency = filter?.frequency,
            dayTime = filter?.dayTime,
            scheduledFor = filter?.scheduledFor,
        ).successOrThrow().data ?: emptyList()
    }

    /** GET /activities/today — today's scheduled activities (timezone-aware). */
    suspend fun today(): Result<List<ActivityResponse>> = runCatching {
        api.getTodayActivities().successOrThrow().data ?: emptyList()
    }

    /** GET /activities/streak — global completion streak. */
    suspend fun streak(): Result<StreakInfo> = runCatching {
        api.getGlobalStreak().successOrThrow().data
            ?: throw ApiError("Global streak payload was missing")
    }

    /** GET /activities/:id — single activity. */
    suspend fun get(id: Long): Result<ActivityResponse> = runCatching {
        api.getActivity(id).successOrThrow().data
            ?: throw ApiError("Activity payload was missing")
    }

    /** POST /activities — create an activity (data is null-tolerant per KDoc). */
    suspend fun create(request: CreateActivityRequest): Result<ActivityResponse> = runCatching {
        api.createActivity(request).successOrThrow().data
            ?: throw ApiError("Created activity payload was missing")
    }

    /** PUT /activities/:id — partial update (pointer fields). */
    suspend fun update(id: Long, request: UpdateActivityRequest): Result<ActivityResponse> =
        runCatching {
            api.updateActivity(id, request).successOrThrow().data
                ?: throw ApiError("Updated activity payload was missing")
        }

    /** DELETE /activities/:id — delete the activity. */
    suspend fun delete(id: Long): Result<Unit> = runCatching {
        api.deleteActivity(id).successOrThrow()
    }

    /** POST /activities/:id/record — record one completion. */
    suspend fun record(
        id: Long,
        request: RecordActivityRequest,
    ): Result<ActivityRecordResponse> = runCatching {
        api.recordActivity(id, request).successOrThrow().data
            ?: throw ApiError("Record payload was missing")
    }

    /** DELETE /activities/:id/revert — revert the last completion. */
    suspend fun revertLast(id: Long): Result<Unit> = runCatching {
        api.revertLastCompletion(id).successOrThrow()
    }
}
