package com.lifetracker.domain.social

import com.lifetracker.core.network.endpoints.UsersApi
import com.lifetracker.core.network.model.PublicProfileResponse
import com.lifetracker.core.network.model.PublicUserCard
import com.lifetracker.core.network.model.PagedResponse
import com.lifetracker.core.network.model.FollowerItem
import com.lifetracker.core.network.model.UpdateUserRequest
import com.lifetracker.core.network.model.UserResponse
import com.lifetracker.domain.auth.ApiError
import com.lifetracker.domain.auth.successOrThrow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Port of the RN `packages/shared/src/services/user-service.ts` plus the
 * user-facing read endpoints of social-service.ts (search, public profile,
 * followers/following pages) — everything served by `/users`.
 *
 * Envelope null-tolerance (see [UsersApi] KDoc for the Go corrections):
 * - lists default `data ?: emptyList()`;
 * - single payloads missing `data` surface an [ApiError].
 */
@Singleton
class UsersRepository @Inject constructor(
    private val api: UsersApi,
    /** Cached session read for the RN `authService.getCurrentUser()` parity. */
    private val sessions: com.lifetracker.core.storage.SessionStore,
) {

    // ---- own profile (user-service) ----

    /**
     * Cached session username (RN `authService.getCurrentUser().username`),
     * used by the public-profile screen for the "this is you" comparison.
     * Exposed as a [String] so features never touch the storage types.
     */
    fun cachedUsername(): String? = sessions.currentUser()?.username

    /** GET /users/me — the authenticated user's profile. */
    suspend fun myProfile(): Result<UserResponse> = runCatching {
        api.myProfile().successOrThrow().data
            ?: throw ApiError("Profile payload was missing")
    }

    /** PUT /users/me — partial update (missing fields stay unchanged). */
    suspend fun updateProfile(request: UpdateUserRequest): Result<UserResponse> = runCatching {
        api.updateProfile(request).successOrThrow().data
            ?: throw ApiError("Profile payload was missing")
    }

    /** POST /users/me/image — upload the avatar (mixed part `image`). */
    suspend fun uploadProfileImage(image: okhttp3.MultipartBody.Part): Result<UserResponse> =
        runCatching {
            api.uploadProfileImage(image).successOrThrow().data
                ?: throw ApiError("Profile payload was missing")
        }

    /**
     * DELETE /users/me/image — clears the avatar and returns the refreshed
     * profile (RN `deleteProfilePicture` follows the delete with GET /users/me).
     */
    suspend fun deleteProfileImage(): Result<UserResponse> = runCatching {
        api.deleteProfileImage().successOrThrow()
        myProfile().getOrThrow()
    }

    /** GET /users — all users. */
    suspend fun allUsers(): Result<List<UserResponse>> = runCatching {
        api.allUsers().successOrThrow().data ?: emptyList()
    }

    // ---- other users (social reads) ----

    /**
     * GET /users/{username} — resolves a numeric id or username. The Go
     * controller always renders a public card for this route (bare envelope).
     */
    suspend fun lookup(idOrUsername: String): Result<PublicUserCard> = runCatching {
        api.getUserOrProfile(idOrUsername).successOrThrow().data
            ?: throw ApiError("User payload was missing")
    }

    /** GET /users/search?q=&limit= — public cards by username prefix. */
    suspend fun searchUsers(query: String, limit: Int = 20): Result<List<PublicUserCard>> =
        runCatching {
            api.searchUsers(query = query, limit = limit).successOrThrow().data ?: emptyList()
        }

    /**
     * GET /users/{username}/profile — counts + content when visible
     * (bare `{ "data": PublicProfileResponse }`).
     */
    suspend fun publicProfile(username: String): Result<PublicProfileResponse> = runCatching {
        api.getProfile(username).successOrThrow().data
            ?: throw ApiError("Public profile payload was missing")
    }

    /** GET /users/{username}/followers — paged; server defaults limit 25, max 100. */
    suspend fun followers(
        username: String,
        limit: Int = 25,
        offset: Int = 0,
    ): Result<PagedResponse<FollowerItem>> = runCatching {
        api.followers(username, limit, offset).successOrThrow().data
            ?: throw ApiError("Followers payload was missing")
    }

    /** GET /users/{username}/following — paged; same defaults as [followers]. */
    suspend fun following(
        username: String,
        limit: Int = 25,
        offset: Int = 0,
    ): Result<PagedResponse<FollowerItem>> = runCatching {
        api.following(username, limit, offset).successOrThrow().data
            ?: throw ApiError("Following payload was missing")
    }
}
