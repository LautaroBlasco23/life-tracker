package com.lifetracker.core.network.endpoints

import com.lifetracker.core.network.model.ApiEnvelope
import com.lifetracker.core.network.model.MessageOnly
import com.lifetracker.core.network.model.ApiList
import com.lifetracker.core.network.model.SubscribeRequest
import com.lifetracker.core.network.model.SubscriptionResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * `/subscriptions` endpoints — cloning public activities/routines (contract
 * §10). Envelope notes (verified in the Go social controller): `POST` returns
 * HTTP 201 with a bare `{ "data": … }` body and `GET` a bare
 * `{ "data": …, "count": … }`; only `DELETE` has a `message`.
 */
interface SubscriptionsApi {

    /** Clones a public activity or routine; responds HTTP 201. */
    @POST("subscriptions")
    suspend fun subscribe(@Body body: SubscribeRequest): Response<ApiEnvelope<SubscriptionResponse>>

    /** Lists the user's clones. */
    @GET("subscriptions")
    suspend fun mySubscriptions(): Response<ApiList<SubscriptionResponse>>

    /** Unsubscribes, deleting the local clone. */
    @DELETE("subscriptions/{id}")
    suspend fun unsubscribe(@Path("id") id: Int): Response<MessageOnly>
}
