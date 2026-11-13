package com.lifetracker.core.network.model

import kotlinx.serialization.Serializable

/**
 * Request body of `POST /activities`.
 *
 * `privacyStatus` is deliberately absent: the backend DTO does not accept it
 * on create (unknown fields are ignored) — set it via update.
 */
@Serializable
data class CreateActivityRequest(
    val title: String,
    val description: String,
    val frequency: Frequency,
    /**
     * JSON-encoded array of lowercase day names as a **string**, e.g.
     * `"[\"monday\",\"friday\"]"` (the mobile client does
     * `JSON.stringify(['monday', ...])`). Values: `monday`…`sunday`.
     * Absent (null) for daily activities. Never send a raw JSON array.
     */
    val dayFrequency: String? = null,
    val dayTime: DayTime,
    /** Completions required per period (goes 1..∞). */
    val completionAmount: Int,
)

/**
 * Request body of `PUT /activities/:id` — all fields optional; omit unchanged
 * fields (backend binds pointer fields, null/absent = unchanged).
 */
@Serializable
data class UpdateActivityRequest(
    val title: String? = null,
    val description: String? = null,
    val completionAmount: Int? = null,
    val frequency: Frequency? = null,
    /**
     * JSON-encoded day-name array as a string — same encoding as
     * [CreateActivityRequest.dayFrequency].
     */
    val dayFrequency: String? = null,
    val dayTime: DayTime? = null,
    val isActive: Boolean? = null,
    val privacyStatus: PrivacyStatus? = null,
)

/** Embedded streak summary: `{ "current": int, "longest": int }`. */
@Serializable
data class StreakInfo(
    val current: Int,
    val longest: Int,
)

/**
 * Activity list item / single response, wired exactly per
 * `backend/internal/domain/activity/dto/activity_dto.go`.
 */
@Serializable
data class ActivityResponse(
    val id: Long,
    val userId: Long,
    val title: String,
    val description: String,
    val frequency: Frequency,
    /**
     * JSON-encoded day-name array as a string (see
     * [CreateActivityRequest.dayFrequency]); `omitempty` on the wire — absent
     * for daily activities/no schedule.
     */
    val dayFrequency: String? = null,
    val dayTime: DayTime,
    val completionAmount: Int,
    val todayCompletions: Int,
    val isActive: Boolean,
    val isCompletedToday: Boolean,
    val privacyStatus: String,
    val streak: StreakInfo? = null,
    val routines: List<RoutineRef>? = null,
    val createdAt: String,
    val updatedAt: String,
)

/** Request body of `POST /activities/:id/record`. */
@Serializable
data class RecordActivityRequest(
    /** RFC3339 instant; defaults to now server-side when omitted. */
    val completionDate: String? = null,
    /** ≤500 chars; `omitempty` on the wire. */
    val notes: String? = null,
)

/**
 * One activity completion (Mongo record → hex ObjectId string `id`).
 * `notes` is absent when empty.
 */
@Serializable
data class ActivityRecordResponse(
    val id: String,
    val activityId: Long,
    val userId: Long,
    val completionDate: String,
    val notes: String? = null,
    val createdAt: String,
)

/** Response of `GET /activities/:id/stats`. */
@Serializable
data class ActivityStatsResponse(
    val activityId: Long,
    val title: String,
    val totalCompletions: Long,
    val currentStreak: Int,
    val longestStreak: Int,
    /** 0..1 ratio. */
    val completionRate: Double,
    val recentRecords: List<ActivityRecordResponse>? = null,
)

