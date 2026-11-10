package com.lifetracker.core.network.endpoints

import com.lifetracker.core.network.model.ApiEnvelope
import com.lifetracker.core.network.model.ApiList
import com.lifetracker.core.network.model.CalendarEventResponse
import com.lifetracker.core.network.model.CreateCalendarEventRequest
import com.lifetracker.core.network.model.MessageOnly
import com.lifetracker.core.network.model.UpdateCalendarEventRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.POST

/**
 * Calendar events surface (`/calendar-events/＊`, all authed). Note the
 * scope asymmetry: PUT carries `scope` inside the JSON body, DELETE takes it
 * as a query parameter.
 */
interface CalendarEventsApi {

    /** POST /calendar-events — create an event or a recurring series (201). */
    @POST("calendar-events")
    suspend fun createEvent(@Body request: CreateCalendarEventRequest): Response<ApiEnvelope<CalendarEventResponse>>

    /** GET /calendar-events — list events; `from`/`to` (RFC3339) are required together. */
    @GET("calendar-events")
    suspend fun getEvents(
        @Query("from") from: String,
        @Query("to") to: String,
    ): Response<ApiList<CalendarEventResponse>>

    /** GET /calendar-events/:id — single event. */
    @GET("calendar-events/{id}")
    suspend fun getEvent(@Path("id") id: Long): Response<ApiEnvelope<CalendarEventResponse>>

    /** PUT /calendar-events/:id — partial update; `scope` in the body. */
    @PUT("calendar-events/{id}")
    suspend fun updateEvent(
        @Path("id") id: Long,
        @Body request: UpdateCalendarEventRequest,
    ): Response<ApiEnvelope<CalendarEventResponse>>

    /** DELETE /calendar-events/:id?scope=… — delete; `scope` in the query. */
    @DELETE("calendar-events/{id}")
    suspend fun deleteEvent(
        @Path("id") id: Long,
        @Query("scope") scope: String? = null,
    ): Response<MessageOnly>
}
