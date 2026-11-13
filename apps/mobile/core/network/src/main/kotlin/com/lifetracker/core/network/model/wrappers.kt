package com.lifetracker.core.network.model

import kotlinx.serialization.Serializable

/**
 * Single-item envelope: `{ "message": string, "data": T }` (some handlers omit
 * `message`). `data` is null-tolerant: a few handlers return:
 * `data: T | null` (see `kotlin-refactor/api-contract.md` §1.5).
 */
@Serializable
data class ApiEnvelope<T>(
    val message: String? = null,
    val data: T? = null,
)

/**
 * List envelope: `{ "message": string, "data": T[], "count": int }`. Handlers
 * may return `data: null` instead of `[]` when the collection is empty —
 * callers must default `data ?: emptyList()`.
 */
@Serializable
data class ApiList<T>(
    val message: String? = null,
    val data: List<T>? = null,
    val count: Int? = null,
)

/** Standard 4xx/5xx error body: `{ "error": string, "details"?: string }`. */
@Serializable
data class ApiErrorBody(
    val error: String,
    val details: String? = null,
)

/** Message-only body used by DELETEs and similar: `{ "message": string }`. */
@Serializable
data class MessageOnly(
    val message: String? = null,
)

/** Paged list: `{ items, total, limit, offset, pages }` (followers/following). */
@Serializable
data class PagedResponse<T>(
    val items: List<T>? = null,
    val total: Long = 0,
    val limit: Int = 0,
    val offset: Int = 0,
    val pages: Int = 0,
)

/** Finance movements list: `{ message, data: T[], count, total }`. */
@Serializable
data class MovementsResponse<T>(
    val message: String? = null,
    val data: List<T>? = null,
    val count: Int? = null,
    val total: Int? = null,
)

/** Monthly-stats list: `{ message, data: MonthlyStats[], year }`. */
@Serializable
data class MonthlyStatsResponse(
    val message: String? = null,
    val data: List<MonthlyStats>? = null,
    val year: Int? = null,
)

/** Availability checks: `{ available, username?, email? }`. */
@Serializable
data class AvailabilityResponse(
    val available: Boolean,
    val username: String? = null,
    val email: String? = null,
)
