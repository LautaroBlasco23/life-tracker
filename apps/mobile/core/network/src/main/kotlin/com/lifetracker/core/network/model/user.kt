package com.lifetracker.core.network.model

import kotlinx.serialization.Serializable

/**
 * Wire models for the `/users` routes (profile, search, public cards).
 *
 * Cross-domain types referenced here — [StreakInfo], [RoutineActivityItem],
 * [PrivacyStatus], [Frequency], [DayTime] — are owned by the activity/routine
 * model files; they live in this same package (`com.lifetracker.core.network.model`).
 */

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/**
 * Body of `PUT /users/me` (single envelope with updated [UserResponse]) —
 * all fields optional; omit unchanged fields rather than sending null
 * (backend binds missing = unchanged).
 */
@Serializable
data class UpdateUserRequest(
    val firstName: String? = null,
    val lastName: String? = null,
    val username: String? = null,
    val profilePicUrl: String? = null,
    /** IANA timezone string. */
    val timezone: String? = null,
    val profilePrivacyStatus: PrivacyStatus? = null,
)

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

// `UserResponse` (own-profile object: id, name, email, availability fields,
// timestamps) is intentionally NOT re-declared here — it already exists in
// `model/auth.kt` (defined alongside the login/register envelopes). The few
// differences vs. a fresh declaration: `id` is `Long` rather than `Int` there,
// and `profilePrivacyStatus` is a plain `String` rather than [PrivacyStatus];
// see the codegen report for the reconciliation note.


/** Public-facing user card (profiles, search results). */
@Serializable
data class PublicUserCard(
    val id: Int,
    val username: String,
    val firstName: String,
    val lastName: String,
    val profilePicUrl: String? = null,
    val profilePrivacyStatus: PrivacyStatus,
    val followStatus: FollowStatus,
    val isFollowing: Boolean,
)

/** A public routine inside a [PublicProfileResponse]. */
@Serializable
data class PublicRoutineCard(
    val id: Int,
    val title: String,
    val description: String,
    /** Go nil slices marshal as JSON `null`. */
    val activities: List<RoutineActivityItem>? = null,
    /** Whether the viewer has already cloned this routine. */
    val subscribed: Boolean,
    val streak: StreakInfo? = null,
)

/** A public activity inside a [PublicProfileResponse]. */
@Serializable
data class PublicActivityCard(
    val id: Int,
    val title: String,
    val description: String,
    val frequency: Frequency,
    val dayTime: DayTime,
    val completionAmount: Int,
    /** Whether the viewer has already cloned this activity. */
    val subscribed: Boolean,
    /** JSON-encoded day-name array as a string (e.g. `[\"monday\",\"friday\"]`). */
    val dayFrequency: String? = null,
    val streak: StreakInfo? = null,
)

/**
 * Data of `GET /users/{username}/profile` (single envelope). Content lists are
 * only populated when the viewer may view content; the shell (counts) is always
 * present. DTO is a flattened superset of [PublicUserCard] (Go embeds the card).
 */
@Serializable
data class PublicProfileResponse(
    val id: Int,
    val username: String,
    val firstName: String,
    val lastName: String,
    val profilePicUrl: String? = null,
    val profilePrivacyStatus: PrivacyStatus,
    val followStatus: FollowStatus,
    val isFollowing: Boolean,
    val followersCount: Long,
    val followingCount: Long,
    val publicRoutinesCount: Long,
    val publicActivitiesCount: Long,
    val canViewContent: Boolean,
    /** Go nil slices marshal as JSON `null`; empty on private profiles. */
    val routines: List<PublicRoutineCard>? = null,
    /** Go nil slices marshal as JSON `null`; empty on private profiles. */
    val activities: List<PublicActivityCard>? = null,
)
