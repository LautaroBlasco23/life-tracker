package com.lifetracker.domain.reminders

import com.lifetracker.core.network.endpoints.RemindersApi
import com.lifetracker.core.network.model.CreateReminderRequest
import com.lifetracker.core.network.model.ReminderResponse
import com.lifetracker.core.network.model.UpdateReminderRequest
import com.lifetracker.domain.auth.ApiError
import com.lifetracker.domain.auth.successOrThrow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Port of the RN `packages/shared/src/services/reminder-service.ts`:
 * list/create/update/delete plus the complete/revert-completion pair the
 * Activities screen drives optimistically.
 *
 * List payloads are null-tolerant (`data ?: emptyList()`).
 */
@Singleton
class RemindersRepository @Inject constructor(
    private val api: RemindersApi,
) {

    /** GET /reminders — the current user's reminders. */
    suspend fun list(): Result<List<ReminderResponse>> = runCatching {
        api.getReminders().successOrThrow().data ?: emptyList()
    }

    /** GET /reminders/:id — single reminder. */
    suspend fun get(id: Long): Result<ReminderResponse> = runCatching {
        api.getReminder(id).successOrThrow().data
            ?: throw ApiError("Reminder payload was missing")
    }

    /** POST /reminders — create (create payloads are null-tolerant per KDoc). */
    suspend fun create(request: CreateReminderRequest): Result<ReminderResponse> = runCatching {
        api.createReminder(request).successOrThrow().data
            ?: throw ApiError("Created reminder payload was missing")
    }

    /** PUT /reminders/:id — partial update. */
    suspend fun update(id: Long, request: UpdateReminderRequest): Result<ReminderResponse> =
        runCatching {
            api.updateReminder(id, request).successOrThrow().data
                ?: throw ApiError("Updated reminder payload was missing")
        }

    /** DELETE /reminders/:id — delete the reminder. */
    suspend fun delete(id: Long): Result<Unit> = runCatching {
        api.deleteReminder(id).successOrThrow()
    }

    /** POST /reminders/:id/complete — mark complete (returns the fresh payload). */
    suspend fun complete(id: Long): Result<ReminderResponse> = runCatching {
        api.completeReminder(id).successOrThrow().data
            ?: throw ApiError("Completed reminder payload was missing")
    }

    /** DELETE /reminders/:id/complete — revert completion. */
    suspend fun revertCompletion(id: Long): Result<Unit> = runCatching {
        api.revertCompletion(id).successOrThrow()
    }
}
