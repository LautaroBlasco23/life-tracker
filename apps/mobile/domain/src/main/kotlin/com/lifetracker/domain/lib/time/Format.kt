package com.lifetracker.domain.lib.time

import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Platform-agnostic formatting/date helpers shared by web and mobile
 * (`packages/shared/src/utils/format.ts`). Only the helpers consumed by the
 * ported calendar/format modules are included.
 *
 * The Kotlin port models the JS `Date` argument as a [ZonedDateTime]:
 * instant + local zone (the app sends its IANA timezone on every request and
 * the backend filters in that zone).
 */

/**
 * Local-timezone day key (YYYY-MM-DD) used to group movements by day.
 * JS builds it as `${year}` without zero-padding the year, month and day
 * padded to two digits — hence manual composition instead of a `yyyy-MM-dd`
 * formatter, which zero-pads the year.
 */
fun getDayKey(date: ZonedDateTime): String =
    "${date.year}-${pad2(date.monthValue)}-${pad2(date.dayOfMonth)}"

/** Short date, e.g. "Aug 8, 2026" (`en-US`). */
fun formatShortDate(date: ZonedDateTime): String =
    DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US).format(date)

/** Time of day as "3:45 PM" style output — en-US with a padded 2-digit hour: "03:45 PM". */
fun formatTime(date: ZonedDateTime): String =
    DateTimeFormatter.ofPattern("hh:mm a", Locale.US).format(date)
