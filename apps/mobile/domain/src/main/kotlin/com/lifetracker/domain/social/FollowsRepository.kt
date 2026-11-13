package com.lifetracker.domain.social

import com.lifetracker.core.network.endpoints.FollowsApi
import com.lifetracker.core.network.model.FollowStatus
import com.lifetracker.core.network.model.FollowerItem
import com.lifetracker.domain.auth.ApiError
import com.lifetracker.domain.auth.successOrThrow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Port of the follow half of the RN
 * `packages/shared/src/services/social-service.ts`:
 * follow/unfollow by username (pending vs accepted flow), incoming pending
 * requests and their accept/reject.
 *
 * List payloads are null-tolerant (`data ?: emptyList()`); single payloads
 * missing `data` surface an [ApiError] like the RN `throw new Error(...)`.
 */
@Singleton
class FollowsRepository @Inject constructor(
    private val api: FollowsApi,
) {

    /**
     * POST /follows/{username} — request to follow; auto-accepts when the
     * target profile is public. Returns the resulting [FollowStatus].
     */
    suspend fun follow(username: String): Result<FollowStatus> = runCatching {
        api.follow(username).successOrThrow().data
            ?.status ?: throw ApiError("Follow status payload was missing")
    }

    /** DELETE /follows/{username} — unfollow (also cancels a pending request). */
    suspend fun unfollow(username: String): Result<Unit> = runCatching {
        api.unfollow(username).successOrThrow()
    }

    /** GET /follows/pending — incoming follow requests. */
    suspend fun pendingRequests(): Result<List<FollowerItem>> = runCatching {
        api.pendingRequests().successOrThrow().data ?: emptyList()
    }

    /** POST /follows/pending/{followerId}/accept. */
    suspend fun acceptFollow(followerId: Int): Result<Unit> = runCatching {
        api.acceptFollow(followerId).successOrThrow()
    }

    /** POST /follows/pending/{followerId}/reject. */
    suspend fun rejectFollow(followerId: Int): Result<Unit> = runCatching {
        api.rejectFollow(followerId).successOrThrow()
    }
}
