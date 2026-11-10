package com.lifetracker.core.network.endpoints

import com.lifetracker.core.network.model.ApiEnvelope
import com.lifetracker.core.network.model.ApiList
import com.lifetracker.core.network.model.CreateTimeRecordRequest
import com.lifetracker.core.network.model.MessageOnly
import com.lifetracker.core.network.model.TimeRecordResponse
import com.lifetracker.core.network.model.TimeStatsResponse
import com.lifetracker.core.network.model.UpdateTimeRecordRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.POST

/** Time records surface (`/time-records/＊`, all authed). */
interface TimeRecordsApi {

    /** POST /time-records — create a time record (201). */
    @POST("time-records")
    suspend fun createTimeRecord(@Body request: CreateTimeRecordRequest): Response<ApiEnvelope<TimeRecordResponse>>

    /** GET /time-records — list with filters. */
    @GET("time-records")
    suspend fun getTimeRecords(
        @Query("category") category: String? = null,
        @Query("month") month: Int? = null,
        @Query("year") year: Int? = null,
        @Query("start_date") startDate: String? = null,
        @Query("end_date") endDate: String? = null,
    ): Response<ApiList<TimeRecordResponse>>

    /** GET /time-records/stats — aggregate stats. */
    @GET("time-records/stats")
    suspend fun getTimeStats(): Response<ApiEnvelope<TimeStatsResponse>>

    /** GET /time-records/:id — single time record. */
    @GET("time-records/{id}")
    suspend fun getTimeRecord(@Path("id") id: Long): Response<ApiEnvelope<TimeRecordResponse>>

    /** PUT /time-records/:id — partial update. */
    @PUT("time-records/{id}")
    suspend fun updateTimeRecord(
        @Path("id") id: Long,
        @Body request: UpdateTimeRecordRequest,
    ): Response<ApiEnvelope<TimeRecordResponse>>

    /** DELETE /time-records/:id — delete the time record. */
    @DELETE("time-records/{id}")
    suspend fun deleteTimeRecord(@Path("id") id: Long): Response<MessageOnly>
}
