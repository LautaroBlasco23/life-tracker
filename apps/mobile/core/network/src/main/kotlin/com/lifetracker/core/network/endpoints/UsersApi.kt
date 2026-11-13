package com.lifetracker.core.network.endpoints

import com.lifetracker.core.network.model.ApiEnvelope
import com.lifetracker.core.network.model.ApiList
import com.lifetracker.core.network.model.AvailabilityResponse
import com.lifetracker.core.network.model.FollowerItem
import com.lifetracker.core.network.model.PagedResponse
import com.lifetracker.core.network.model.PublicProfileResponse
import com.lifetracker.core.network.model.PublicUserCard
import com.lifetracker.core.network.model.UpdateUserRequest
import com.lifetracker.core.network.model.UserResponse
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query
import com.lifetracker.core.network.model.MessageOnly

/**
 * `/users` endpoints (contract §10): profile, avatar, search, public profiles
 * and the paged followers/following routes (which live under `/users/…`
 * server-side even though the follow service backs them).
 *
 * Envelope notes (verified in the Go user/social controllers):
 * - `GET /users/me`, `PUT /users/me`, `POST /users/me/image`: single envelope
 *   with `message`.
 * - `GET /users`: list envelope with `message` + `count`.
 * - `GET /users/search`: bare list envelope (`{ data, count }`, no `message`).
 * - `DELETE /users/me/image`: message-only.
 * - `GET /users/{username}`: bare single envelope with a [PublicUserCard]
 *   (the Go controller always builds a card for this route — even for a
 *   numeric-id path — unlike the "model both" note in the contract doc).
 * - `GET /users/{username}/profile`: bare single envelope
 *   (`{ "data": PublicProfileResponse }`).
 * - followers/following: `{ "data": { items, total, limit, offset, pages } }`
 *   → [ApiEnvelope]`<[PagedResponse]<FollowerItem>>` (the wire items are plain
 *   [FollowerItem] values per the Go code, not public cards).
 */
interface UsersApi {

    /** Fetches the authenticated user's own profile. */
    @GET("users/me")
    suspend fun myProfile(): Response<ApiEnvelope<UserResponse>>

    /** Partially updates the authenticated user's profile. */
    @PUT("users/me")
    suspend fun updateProfile(@Body body: UpdateUserRequest): Response<ApiEnvelope<UserResponse>>

    /** Uploads the avatar (mixed part `image`); returns the updated user. */
    @Multipart
    @POST("users/me/image")
    suspend fun uploadProfileImage(@Part image: MultipartBody.Part): Response<ApiEnvelope<UserResponse>>

    /** Clears the avatar. */
    @DELETE("users/me/image")
    suspend fun deleteProfileImage(): Response<MessageOnly>

    /** Lists all users. */
    @GET("users")
    suspend fun allUsers(): Response<ApiList<UserResponse>>

    /** Searches users (`q` 1–30 chars, `limit` 1–50). */
    @GET("users/search")
    suspend fun searchUsers(
        @Query("q") query: String,
        @Query("limit") limit: Int? = null,
    ): Response<ApiList<PublicUserCard>>

    /** Public availability probe for usernames (rate limited; no auth header). */
    @GET("users/check-username")
    suspend fun checkUsername(@Query("username") username: String): Response<AvailabilityResponse>

    /** Public availability probe for emails (rate limited; no auth header). */
    @GET("users/check-email")
    suspend fun checkEmail(@Query("email") email: String): Response<AvailabilityResponse>

    /** Looks up a user by numeric id or username; always yields a public card. */
    @GET("users/{username}")
    suspend fun getUserOrProfile(@Path("username") username: String): Response<ApiEnvelope<PublicUserCard>>

    /** Public profile of a user (counts, and content when visible). */
    @GET("users/{username}/profile")
    suspend fun getProfile(@Path("username") username: String): Response<ApiEnvelope<PublicProfileResponse>>

    /** Followers of a user, paged; server defaults `limit` = 25, caps at 100. */
    @GET("users/{username}/followers")
    suspend fun followers(
        @Path("username") username: String,
        @Query("limit") limit: Int? = null,
        @Query("offset") offset: Int? = null,
    ): Response<ApiEnvelope<PagedResponse<FollowerItem>>>

    /** Users followed by a user, paged; same paging defaults as [followers]. */
    @GET("users/{username}/following")
    suspend fun following(
        @Path("username") username: String,
        @Query("limit") limit: Int? = null,
        @Query("offset") offset: Int? = null,
    ): Response<ApiEnvelope<PagedResponse<FollowerItem>>>
}
