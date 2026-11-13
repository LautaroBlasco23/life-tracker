package com.lifetracker.domain.lib.time

import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * Kotlin port of the app's `apps/mobile/lib/format-time.ts`.
 *
 * The Kotlin port models the JS `Date` argument as a [ZonedDateTime]
 * (instant + local zone) and an unparseable string as `null` (JS
 * `Invalid Date`).
 */

fun formatDuration(minutes: Int): String {
    if (minutes < 60) {
        return "$minutes min"
    }
    // Only reached for minutes >= 60, so `Math.floor` is plain integer division.
    val hours = minutes / 60
    val remainingMinutes = minutes % 60
    if (remainingMinutes == 0) {
        return "${hours}h"
    }
    return "${hours}h ${remainingMinutes}m"
}

fun formatTimerDisplay(seconds: Int): String {
    val hrs = seconds.floorDiv(3600)
    val mins = (seconds % 3600).floorDiv(60)
    val secs = seconds % 60
    return listOf(hrs, mins, secs)
        .joinToString(":") { it.toString().padStart(2, '0') }
}

/** Compact "Sep 30, 3:45 PM" style record date. */
fun formatRecordDate(dateString: String, zone: ZoneId = ZoneId.systemDefault()): String {
    // JS: `new Date(garbage)` is an Invalid Date, which renders as the
    // literal "Invalid Date" in both helpers.
    val d = parseJsDate(dateString, zone) ?: return "Invalid Date Invalid Date"
    return "${formatShortDate(d)} ${formatTime(d)}"
}
