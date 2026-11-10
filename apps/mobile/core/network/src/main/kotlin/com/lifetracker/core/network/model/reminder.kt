package com.lifetracker.core.network.model

import kotlinx.serialization.Serializable

/** Request body of `POST /reminders`. */
@Serializable
data class CreateReminderRequest(
    val title: String,
    val description: String,
    /** RFC3339 instant. */
    val dueAt: String,
    /** RFC3339 instant; optional. */
    val activeFrom: String? = null,
    val privacyStatus: PrivacyStatus? = null,
)

/**
 * Request body of `PUT /reminders/:id` — all fields optional; omit unchanged
 * fields (backend binds pointers, absent = unchanged).
 */
@Serializable
data class UpdateReminderRequest(
    val title: String? = null,
    val description: String? = null,
    val dueAt: String? = null,
    val activeFrom: String? = null,
    val privacyStatus: PrivacyStatus? = null,
)

/** Reminder list item / single response. RFC3339 timestamps as strings. */
@Serializable
data class ReminderResponse(
    val id: Long,
    val userId: Long,
    val title: String,
    val description: String,
    val dueAt: String,
    val activeFrom: String? = null,
    /** Present once the reminder was completed. */
    val completedAt: String? = null,
    val privacyStatus: String,
    val createdAt: String,
    val updatedAt: String,
)
