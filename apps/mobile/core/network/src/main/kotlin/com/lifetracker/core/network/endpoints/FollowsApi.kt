package com.lifetracker.core.network.endpoints

import com.lifetracker.core.network.model.ApiEnvelope
import com.lifetracker.core.network.model.MessageOnly
import com.lifetracker.core.network.model.ApiList
import com.lifetracker.core.network.model.FollowResponse
import com.lifetracker.core.network.model.FollowerItem
import retrofit2.Response
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * `/follows` endpoints (contract §10).
 *
 * Envelope notes (verified in the Go social controller): `POST /follows/{username}`
 * and `GET /follows/pending` render **bare** envelopes — `{ "data": … }` with no
 * `message` — so [ApiEnvelope]/[ApiList]'s nullable `message` is simply left
 * null on the wire. Accept/reject/unfollow return message-only bodies
 * ([MessageOnly]).
 */
interface FollowsApi {

    /** Requests to follow (auto-accepts if the target profile is public). */
    @POST("follows/{username}")
    suspend fun follow(@Path("username") username: String): Response<ApiEnvelope<FollowResponse>>

    /** Unfollows a user. */
    @DELETE("follows/{username}")
    suspend fun unfollow(@Path("username") username: String): Response<MessageOnly>

    /** Incoming pending follow requests. */
    @GET("follows/pending")
    suspend fun pendingRequests(): Response<ApiList<FollowerItem>>

    /** Accepts a pending follow request from `followerId`. */
    @POST("follows/pending/{followerId}/accept")
    suspend fun acceptFollow(@Path("followerId") followerId: Int): Response<MessageOnly>

    /** Rejects a pending follow request from `followerId`. */
    @POST("follows/pending/{followerId}/reject")
    suspend fun rejectFollow(@Path("followerId") followerId: Int): Response<MessageOnly>
}
