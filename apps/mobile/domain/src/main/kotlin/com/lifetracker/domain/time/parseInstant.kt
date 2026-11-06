package com.lifetracker.domain.time

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.ZonedDateTime

/**
 * Public parse of the ISO instants the backend exchanges (`RFC3339`,
 * `kotlin-refactor/api-contract.md` §1.3) — semantics of JS `new Date(string)`
 * for the strings mobile sees:
 *
 * - `"2026-09-30T03:00:00.000Z"` — a full instant.
 * - `"2026-09-30T03:00:00-03:00"` — an explicit offset.
 * - `"2026-09-30T03:00:00"` — a datetime without timezone: local wall time.
 * - `"2026-09-30"` — a plain date: UTC midnight in JS, not local midnight.
 *
 * `null` plays the role of JS `Invalid Date`. Mirrors (and exists in
 * parallel with) the internal `domain/lib/time.parseJsDate`, which cannot be
 * exposed across modules under the current visibility rules.
 */
private val OFFSET_SUFFIX: Regex = Regex("[+\\-]\\d\\d:\\d\\d$")

fun parseInstant(value: String, zone: ZoneId = ZoneId.systemDefault()): ZonedDateTime? {
    // A full instant: ends with `Z` or an explicit offset.
    if (value.endsWith("Z") || OFFSET_SUFFIX.containsMatchIn(value)) {
        runCatching { Instant.parse(value) }
            .getOrNull()
            ?.let { return it.atZone(zone) }
    }
    runCatching { LocalDateTime.parse(value) }
        .getOrNull()
        ?.let { return it.atZone(zone) }
    // A plain date without a timezone means UTC midnight in JS.
    return runCatching { LocalDate.parse(value) }
        .getOrNull()
        ?.let { it.atStartOfDay(ZoneOffset.UTC).withZoneSameInstant(zone) }
}
