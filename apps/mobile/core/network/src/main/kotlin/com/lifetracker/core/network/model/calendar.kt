package com.lifetracker.core.network.model

import kotlinx.serialization.Serializable

/**
 * Recurrence description of a new calendar event. Only `rule = "weekly"` is
 * currently supported; the service validates the rule/interval.
 */
@Serializable
data class CalendarRecurrenceRequest(
    val rule: RecurrenceRule,
    val interval: Int? = null,
    /** RFC3339 instant bounding the last occurrence. */
    val until: String? = null,
)

/**
 * Request body of `POST /calendar-events`. Omitting `recurrence` creates a
 * single event; providing it creates a recurring series.
 */
@Serializable
data class CreateCalendarEventRequest(
    val title: String,
    val description: String,
    /** Free-text category name, ≤ 100 chars. */
    val category: String,
    /** RFC3339 instants. */
    val startAt: String,
    val endAt: String,
    val recurrence: CalendarRecurrenceRequest? = null,
)

/**
 * Request body of `PUT /calendar-events/:id` — all fields optional; omit
 * unchanged fields. `scope` decides whether the change applies to the
 * occurrence alone (`occurrence`, the default when absent) or to every
 * occurrence of the series (`series`) — note the PUT scope is in the BODY,
 * while DELETE scope is a query parameter.
 */
@Serializable
data class UpdateCalendarEventRequest(
    val title: String? = null,
    val description: String? = null,
    val category: String? = null,
    val startAt: String? = null,
    val endAt: String? = null,
    val scope: EventScope? = null,
)

/**
 * Calendar event list item / single response. `seriesId` is a string;
 * `seriesId == null` means a single (non-recurring) event.
 */
@Serializable
data class CalendarEventResponse(
    val id: Long,
    val title: String,
    val description: String,
    val category: String,
    val startAt: String,
    val endAt: String,
    val seriesId: String? = null,
    val occurrenceIndex: Int? = null,
    val recurrenceRule: String? = null,
    val recurrenceUntil: String? = null,
    val recurrenceInterval: Int? = null,
    val createdAt: String,
    val updatedAt: String,
)
