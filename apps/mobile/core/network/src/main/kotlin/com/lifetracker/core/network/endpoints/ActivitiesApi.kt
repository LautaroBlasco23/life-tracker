package com.lifetracker.core.network.endpoints

import com.lifetracker.core.network.model.ActivityRecordResponse
import com.lifetracker.core.network.model.ActivityResponse
import com.lifetracker.core.network.model.ActivityStatsResponse
import com.lifetracker.core.network.model.ApiEnvelope
import com.lifetracker.core.network.model.ApiList
import com.lifetracker.core.network.model.CreateActivityRequest
import com.lifetracker.core.network.model.DayTime
import com.lifetracker.core.network.model.Frequency
import com.lifetracker.core.network.model.MessageOnly
import com.lifetracker.core.network.model.RecordActivityRequest
import com.lifetracker.core.network.model.RevertCompletionRequest
import com.lifetracker.core.network.model.StreakInfo
import com.lifetracker.core.network.model.UpdateActivityRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/** Activities surface (`/activities/＊`, all authed). */
interface ActivitiesApi {

    /** POST /activities — create an activity (201). */
    @POST("activities")
    suspend fun createActivity(@Body request: CreateActivityRequest): Response<ApiEnvelope<ActivityResponse>>

    /** GET /activities — list / filter activities. */
    @GET("activities")
    suspend fun getActivities(
        @Query("frequency") frequency: Frequency? = null,
        @Query("day_time") dayTime: DayTime? = null,
        @Query("scheduled_for") scheduledFor: String? = null,
    ): Response<ApiList<ActivityResponse>>

    /** GET /activities/today — today's scheduled activities (timezone-aware). */
    @GET("activities/today")
    suspend fun getTodayActivities(): Response<ApiList<ActivityResponse>>

    /** GET /activities/streak — global completion streak. */
    @GET("activities/streak")
    suspend fun getGlobalStreak(): Response<ApiEnvelope<StreakInfo>>

    /** GET /activities/:id — single activity. */
    @GET("activities/{id}")
    suspend fun getActivity(@Path("id") id: Long): Response<ApiEnvelope<ActivityResponse>>

    /** PUT /activities/:id — partial update (pointer fields). */
    @PUT("activities/{id}")
    suspend fun updateActivity(
        @Path("id") id: Long,
        @Body request: UpdateActivityRequest,
    ): Response<ApiEnvelope<ActivityResponse>>

    /** DELETE /activities/:id — delete the activity. */
    @DELETE("activities/{id}")
    suspend fun deleteActivity(@Path("id") id: Long): Response<MessageOnly>

    /** POST /activities/:id/record — record one completion (201). */
    @POST("activities/{id}/record")
    suspend fun recordActivity(
        @Path("id") id: Long,
        @Body request: RecordActivityRequest,
    ): Response<ApiEnvelope<ActivityRecordResponse>>

    /** GET /activities/:id/records — completion history. */
    @GET("activities/{id}/records")
    suspend fun getActivityRecords(
        @Path("id") id: Long,
        @Query("limit") limit: Int? = null,
    ): Response<ApiList<ActivityRecordResponse>>

    /** GET /activities/:id/stats — stats for one activity. */
    @GET("activities/{id}/stats")
    suspend fun getActivityStats(@Path("id") id: Long): Response<ApiEnvelope<ActivityStatsResponse>>

    /** DELETE /activities/:id/revert — revert last completion (optional body). */
    @DELETE("activities/{id}/revert")
    suspend fun revertLastCompletion(
        @Path("id") id: Long,
        @Body request: RevertCompletionRequest? = null,
    ): Response<MessageOnly>
}
