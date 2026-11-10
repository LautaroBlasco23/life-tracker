package com.lifetracker.core.network.endpoints

import com.lifetracker.core.network.model.ApiEnvelope
import com.lifetracker.core.network.model.ApiList
import com.lifetracker.core.network.model.CreateReminderRequest
import com.lifetracker.core.network.model.MessageOnly
import com.lifetracker.core.network.model.ReminderResponse
import com.lifetracker.core.network.model.UpdateReminderRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

/** Reminders surface (`/reminders/＊`, all authed). */
interface RemindersApi {

    /** POST /reminders — create a reminder (201). */
    @POST("reminders")
    suspend fun createReminder(@Body request: CreateReminderRequest): Response<ApiEnvelope<ReminderResponse>>

    /** GET /reminders — list the current user's reminders. */
    @GET("reminders")
    suspend fun getReminders(): Response<ApiList<ReminderResponse>>

    /** GET /reminders/:id — single reminder. */
    @GET("reminders/{id}")
    suspend fun getReminder(@Path("id") id: Long): Response<ApiEnvelope<ReminderResponse>>

    /** PUT /reminders/:id — partial update. */
    @PUT("reminders/{id}")
    suspend fun updateReminder(
        @Path("id") id: Long,
        @Body request: UpdateReminderRequest,
    ): Response<ApiEnvelope<ReminderResponse>>

    /** DELETE /reminders/:id — delete the reminder. */
    @DELETE("reminders/{id}")
    suspend fun deleteReminder(@Path("id") id: Long): Response<MessageOnly>

    /** POST /reminders/:id/complete — mark the reminder complete. */
    @POST("reminders/{id}/complete")
    suspend fun completeReminder(@Path("id") id: Long): Response<ApiEnvelope<ReminderResponse>>

    /** DELETE /reminders/:id/complete — revert completion. */
    @DELETE("reminders/{id}/complete")
    suspend fun revertCompletion(@Path("id") id: Long): Response<MessageOnly>
}
