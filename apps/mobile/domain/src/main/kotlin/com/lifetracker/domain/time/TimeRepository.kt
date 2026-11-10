package com.lifetracker.domain.time

import com.lifetracker.core.network.endpoints.TimeRecordsApi
import com.lifetracker.core.network.model.CreateTimeRecordRequest
import com.lifetracker.core.network.model.TimeRecordResponse
import com.lifetracker.core.network.model.UpdateTimeRecordRequest
import com.lifetracker.domain.auth.ApiError
import com.lifetracker.domain.auth.successOrThrow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Port of the RN `packages/shared/src/services/time-service.ts`: list/create/
 * update/delete time records. No `getStats` call here: stats are computed
 * client-side from the visible record list (same as the RN screen).
 */
@Singleton
class TimeRepository @Inject constructor(
    private val api: TimeRecordsApi,
) {
    /** GET /time-records — list with optional category/month/year filters. */
    suspend fun getRecords(
        category: String? = null,
        month: Int? = null,
        year: Int? = null,
    ): List<TimeRecordResponse> =
        api.getTimeRecords(category = category, month = month, year = year)
            .successOrThrow().data.orEmpty()

    /** POST /time-records — create (201). `description` is required by the backend. */
    suspend fun create(
        category: String,
        description: String,
        durationMinutes: Int,
    ): TimeRecordResponse =
        api.createTimeRecord(
            CreateTimeRecordRequest(category = category, description = description, durationMinutes = durationMinutes)
        ).successOrThrow().data ?: throw ApiError("Failed to create time record")

    /** PUT /time-records/:id — partial update (all fields, RN always sends the three). */
    suspend fun update(
        id: Long,
        category: String,
        description: String,
        durationMinutes: Int,
    ): TimeRecordResponse =
        api.updateTimeRecord(
            id = id,
            request = UpdateTimeRecordRequest(
                category = category,
                description = description,
                durationMinutes = durationMinutes,
            ),
        ).successOrThrow().data ?: throw ApiError("Failed to update time record")

    /** DELETE /time-records/:id. */
    suspend fun delete(id: Long) {
        api.deleteTimeRecord(id).successOrThrow()
    }
}
