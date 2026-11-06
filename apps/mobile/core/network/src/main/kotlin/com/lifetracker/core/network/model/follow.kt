package com.lifetracker.core.network.model

import kotlinx.serialization.Serializable

/**
 * Wire models for the `/follows` routes. Numeric IDs are Go `uint` → `Int`.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Status of a follow relation; raw values lowercase (contract §12). */
@Serializable
enum class FollowStatus {
    @kotlinx.serialization.SerialName("pending") PENDING,
    @kotlinx.serialization.SerialName("accepted") ACCEPTED,
    @kotlinx.serialization.SerialName("none") NONE,
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

/**
 * Data of `POST /follows/{username}` — returned inside a bare envelope
 * (`{ "data": { "status": … } }`, no `message`).
 */
@Serializable
data class FollowResponse(
    val status: FollowStatus,
)

/**
 * Incoming follow-request entry of `GET /follows/pending` (list envelope
 * without `message`), and the item type of the paged
 * followers/following endpoints (see Notes in the report: on the wire those
 * pages carry plain [FollowerItem] values, not public cards).
 */
@Serializable
data class FollowerItem(
    val userId: Int,
    val username: String,
    val firstName: String,
    val lastName: String,
)
