package com.lifetracker.core.network.endpoints

import com.lifetracker.core.network.model.ApiEnvelope
import com.lifetracker.core.network.model.ApiList
import com.lifetracker.core.network.model.CreateRoutineRequest
import com.lifetracker.core.network.model.MessageOnly
import com.lifetracker.core.network.model.RoutineResponse
import com.lifetracker.core.network.model.UpdateRoutineRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

/** Routines surface (`/routines/＊`, all authed). Update is PATCH, not PUT. */
interface RoutinesApi {

    /** POST /routines — create a routine (201). */
    @POST("routines")
    suspend fun createRoutine(@Body request: CreateRoutineRequest): Response<ApiEnvelope<RoutineResponse>>

    /** GET /routines/me — list the current user's routines. */
    @GET("routines/me")
    suspend fun getMyRoutines(): Response<ApiList<RoutineResponse>>

    /** GET /routines/:id — single routine. */
    @GET("routines/{id}")
    suspend fun getRoutine(@Path("id") id: Long): Response<ApiEnvelope<RoutineResponse>>

    /** PATCH /routines/:id — partial update. */
    @PATCH("routines/{id}")
    suspend fun updateRoutine(
        @Path("id") id: Long,
        @Body request: UpdateRoutineRequest,
    ): Response<ApiEnvelope<RoutineResponse>>

    /** DELETE /routines/:id — delete the routine. */
    @DELETE("routines/{id}")
    suspend fun deleteRoutine(@Path("id") id: Long): Response<MessageOnly>
}
