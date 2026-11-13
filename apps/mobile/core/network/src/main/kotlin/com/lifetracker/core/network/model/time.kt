package com.lifetracker.core.network.model

import kotlinx.serialization.Serializable

/** Request body of `POST /time-records`. */
@Serializable
data class CreateTimeRecordRequest(
    /** Free-text category name, ≤ 100 chars. */
    val category: String,
    /** Required by the backend binding (`required,max=1000`). */
    val description: String,
    /** ≥ 1 minute. */
    val durationMinutes: Int,
)

/**
 * Request body of `PUT /time-records/:id` — all fields optional; omit
 * unchanged fields (backend binds pointers, absent = unchanged).
 */
@Serializable
data class UpdateTimeRecordRequest(
    val category: String? = null,
    val description: String? = null,
    val durationMinutes: Int? = null,
)

/** Time record list item / single response. */
@Serializable
data class TimeRecordResponse(
    val id: Long,
    val category: String,
    val description: String,
    val durationMinutes: Int,
    val createdAt: String,
    val updatedAt: String,
)

/** Response of `GET /time-records/stats`. */
@Serializable
data class TimeStatsResponse(
    /** Category → total minutes. */
    val categoryTotals: Map<String, Int>? = null,
    val topCategory: String,
    /** Wire key is `topCategoryMinutes` (Go field is `TopCategoryMins`). */
    val topCategoryMinutes: Int,
    val totalMinutes: Int,
    val recordCount: Int,
)
