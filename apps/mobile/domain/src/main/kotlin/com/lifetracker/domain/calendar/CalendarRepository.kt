package com.lifetracker.domain.calendar

import com.lifetracker.core.network.endpoints.CalendarEventsApi
import com.lifetracker.core.network.model.CalendarEventResponse
import com.lifetracker.core.network.model.CreateCalendarEventRequest
import com.lifetracker.core.network.model.EventScope
import com.lifetracker.core.network.model.UpdateCalendarEventRequest
import com.lifetracker.domain.auth.ApiError
import com.lifetracker.domain.auth.successOrThrow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Port of the RN `packages/shared/src/services/calendar-service.ts`.
 *
 * Scope asymmetry (kept behind this API): update carries `scope` inside the
 * JSON body, delete sends it as a query parameter.
 */
@Singleton
class CalendarRepository @Inject constructor(
    private val api: CalendarEventsApi,
) {
    /**
     * GET /calendar-events — events overlapping [from, to); the backend
     * rejects a range with a single bound, so both always travel together.
     */
    suspend fun getEvents(from: String, to: String): List<CalendarEventResponse> =
        api.getEvents(from = from, to = to).successOrThrow().data.orEmpty()

    /** POST /calendar-events — create a single event or a recurring series (201). */
    suspend fun create(request: CreateCalendarEventRequest): CalendarEventResponse =
        api.createEvent(request).successOrThrow().data
            ?: throw ApiError("Failed to create calendar event")

    /** PUT /calendar-events/:id — update; `scope` rides inside the body. */
    suspend fun update(id: Long, request: UpdateCalendarEventRequest): CalendarEventResponse =
        api.updateEvent(id = id, request = request).successOrThrow().data
            ?: throw ApiError("Failed to update calendar event")

    /** DELETE /calendar-events/:id?scope=… — `scope` is a query parameter. */
    suspend fun delete(id: Long, scope: EventScope? = null) {
        api.deleteEvent(id = id, scope = scope?.name?.lowercase()).successOrThrow()
    }
}
