package com.lifetracker.domain.lib.time

import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * Date/time helpers shared by the activity/reminder forms on web and mobile.
 * All functions work in the user's local timezone.
 *
 * The Kotlin port models the JS `Date` argument as a [ZonedDateTime] (instant
 * + local zone) and an invalid parse as `null` (JS `Invalid Date`).
 */

/**
 * Combines a calendar date with an "HH:MM" time input value into a local
 * date-time. Null (JS `Invalid Date`) when `time` is not "H…[:M…]" with
 * numeric parts — JS `Number('')` is 0 for empty segments, but a missing
 * segment is `NaN`.
 */
fun buildDateTime(date: ZonedDateTime, time: String): ZonedDateTime? {
    val parts = time.split(':')
    val hours = parts.getOrNull(0)?.let(::jsInt) ?: return null
    val minutes = parts.getOrNull(1)?.let(::jsInt) ?: return null
    // JS: `setHours(hours, minutes, 0, 0)` keeps the same calendar date and
    // zero-fills seconds and milliseconds. Out-of-range hour/minute values
    // spill into the previous/next calendar day, like JS `MakeTime`.
    return date.toLocalDate().atStartOfDay()
        .plusHours(hours.toLong())
        .plusMinutes(minutes.toLong())
        .atZone(date.zone)
}

/** Formats a Date as a "YYYY-MM-DD" date input value. */
fun formatDateInput(date: ZonedDateTime): String =
    "${date.year}-${pad2(date.monthValue)}-${pad2(date.dayOfMonth)}"

/** Formats a Date as an "HH:MM" time input value. */
fun formatTimeInput(date: ZonedDateTime): String =
    "${pad2(date.hour)}:${pad2(date.minute)}"

internal fun pad2(value: Int): String = value.toString().padStart(2, '0')
