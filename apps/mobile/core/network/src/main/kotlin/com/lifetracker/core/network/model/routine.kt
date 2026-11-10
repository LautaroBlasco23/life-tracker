package com.lifetracker.core.network.model

import kotlinx.serialization.Serializable

/** Ordering entry of an activity inside a routine. */
@Serializable
data class ActivityIDPosition(
    val activityId: Long,
    val position: Int,
)

/**
 * Request body of `POST /routines` — `activityIds` is required with ≥ 1 item.
 * `status` defaults server-side when omitted.
 */
@Serializable
data class CreateRoutineRequest(
    val title: String,
    val description: String,
    val privacyStatus: PrivacyStatus,
    val status: RoutineStatus? = null,
    val dayTime: DayTime? = null,
    /**
     * JSON-encoded day-name array as a **string** — same encoding as
     * `CreateActivityRequest.dayFrequency`.
     */
    val dayFrequency: String? = null,
    val activityIds: List<ActivityIDPosition>,
)

/**
 * Request body of `PATCH /routines/:id` — all fields optional; omit unchanged
 * fields (backend binds pointers, absent = unchanged).
 */
@Serializable
data class UpdateRoutineRequest(
    val title: String? = null,
    val description: String? = null,
    val privacyStatus: PrivacyStatus? = null,
    val status: RoutineStatus? = null,
    val dayTime: DayTime? = null,
    /** JSON-encoded day-name array as a string (see above). */
    val dayFrequency: String? = null,
    val activityIds: List<ActivityIDPosition>? = null,
)

/** Compact routine reference embedded in `ActivityResponse.routines`. */
@Serializable
data class RoutineRef(
    val id: Long,
    val title: String,
)

/**
 * Activity snapshot of one routine entry.
 * `dayFrequency` uses the JSON-encoded-string encoding, absent (null) when
 * empty.
 */
@Serializable
data class RoutineActivityItem(
    val activityId: Long,
    val activityTitle: String,
    val description: String,
    val frequency: Frequency,
    val dayFrequency: String? = null,
    val dayTime: DayTime,
    val privacyStatus: String,
    val completionAmount: Int,
    val position: Int,
    val todayCompletions: Int,
    val scheduledToday: Boolean,
)

/** Routine list item / single response. */
@Serializable
data class RoutineResponse(
    val id: Long,
    val userId: Long,
    val title: String,
    val description: String,
    val privacyStatus: String,
    val status: String,
    val dayTime: String,
    /** JSON-encoded day-name array as a string; `omitempty` — absent when empty. */
    val dayFrequency: String? = null,
    val activities: List<RoutineActivityItem>? = null,
    val isCompletedToday: Boolean,
    val createdAt: String,
    val updatedAt: String,
)
