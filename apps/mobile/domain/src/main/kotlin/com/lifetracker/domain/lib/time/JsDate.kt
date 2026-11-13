package com.lifetracker.domain.lib.time

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeFormatterBuilder
import java.time.temporal.ChronoField

/**
 * Bridges the JS `Date` semantics the original TypeScript relied on:
 *
 * - `Number(string)` for the numeric strings this module parses (`'' → 0`,
 *   decimals truncated later by the JS date arithmetic).
 * - `new Date(year, month, day, ...)` field-based construction, which rolls
 *   over out-of-range fields (2026-13-01 → 2027-01-01, Feb 30 → Mar 2) and
 *   treats years 0–99 as 1900–1999 (ECMA-262 `MakeDay`/`MakeTime`).
 * - `Date.prototype.toISOString()`: UTC instant with exactly 3-digit
 *   milliseconds (e.g. `2026-09-30T03:00:00.000Z`).
 * - `new Date(string)` parsing, where the app feeds it ISO strings from the
 *   API (dateless strings mean UTC midnight, timezone-less datetimes are
 *   local). Invalid strings parse to null (JS `Invalid Date`).
 *
 * `ZonedDateTime` plays the role of JS `Date`: it carries both the instant
 * (what `toISOString()` serializes) and local wall-clock fields
 * (`getHours()`/`getDate()` read the same zone). All local-field arithmetic
 * needs an explicit [ZoneId] — pass the user's timezone, the same information
 * the app already sends on every API request.
 */

/** JS `Number(string)` for the numeric strings these modules parse. */
internal fun jsNumber(value: String): Double? {
    // JS: `Number('') === 0`.
    if (value.isEmpty()) return 0.0
    val parsed = value.toDoubleOrNull() ?: return null
    if (parsed.isNaN()) return null
    return parsed
}

/** JS numeric string truncated to an integer, or null when not finite (`NaN`/±Infinity). */
internal fun jsInt(value: String): Int? {
    val number = jsNumber(value) ?: return null
    if (number.isInfinite()) return null
    // `Double.toInt()` truncates toward zero, like JS date arithmetic.
    return number.toInt()
}

/**
 * Field-based local date-time construction with JS `Date` rollover rules.
 * `month` is 1-based, matching the parsed `MM` string segment.
 */
internal fun jsLocalDateTime(
    year: Int,
    month: Int,
    day: Int,
    hours: Int = 0,
    minutes: Int = 0,
    seconds: Int = 0,
    millis: Int = 0,
    zone: ZoneId,
): ZonedDateTime {
    // ECMA-262: years 0..99 are treated as 1900..1999 by `new Date(y, m, d)`.
    val adjustedYear = if (year in 0..99) year + 1900 else year
    // Roll month (from January) and day (from the 1st) separately, so an
    // out-of-range value spills into the following month/day like JS does
    // (Feb 30 → Mar 2, month 13 → January next year).
    val withMonths = LocalDate.of(adjustedYear, 1, 1).plusMonths((month - 1).toLong())
    val withDays = withMonths.plusDays((day - 1).toLong())
    val local = withDays.atTime(hours, minutes, seconds, millis * 1_000_000)
    // `atZone` resolves a DST gap forward, like JS field-based construction.
    return local.atZone(zone)
}

/**
 * JS `new Date(string)` for the ISO strings the app/API exchange:
 *
 * - `"2026-09-30T03:00:00.000Z"` — a full instant.
 * - `"2026-09-30"` — a plain date: UTC midnight in JS, not local midnight.
 * - `"2026-09-30T03:00:00"` — a datetime without timezone: local wall time.
 *
 * Null plays the role of JS `Invalid Date`.
 */
private val OFFSET_SUFFIX: Regex = Regex("[+\\-]\\d\\d:\\d\\d$")

internal fun parseJsDate(value: String, zone: ZoneId): ZonedDateTime? {
    // A full instant: ends with Z or an explicit offset.
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

/** `Date.prototype.toISOString()`: UTC with exactly three millisecond digits. */
internal fun formatIsoInstant(date: ZonedDateTime): String {
    val formatter = DateTimeFormatterBuilder()
        .appendPattern("yyyy-MM-dd'T'HH:mm:ss")
        .appendFraction(ChronoField.MILLI_OF_SECOND, 3, 3, true)
        .appendLiteral('Z')
        .toFormatter()
        .withZone(ZoneOffset.UTC)
    return formatter.format(date.toInstant())
}
