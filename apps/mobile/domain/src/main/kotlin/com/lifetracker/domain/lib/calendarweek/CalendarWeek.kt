package com.lifetracker.domain.lib.calendarweek

import com.lifetracker.domain.lib.time.formatIsoInstant
import com.lifetracker.domain.lib.time.formatTime
import com.lifetracker.domain.lib.time.getDayKey
import com.lifetracker.domain.lib.time.jsInt
import com.lifetracker.domain.lib.time.jsLocalDateTime
import com.lifetracker.domain.lib.time.parseJsDate
import java.time.Clock
import java.time.Duration
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Week helpers for the mobile calendar.
 *
 * Kotlin port of the app's `apps/mobile/lib/calendar-week.ts` (itself a port
 * of web's `frontend/app/time/calendar/lib/week.ts`; the web version leans on
 * date-fns, the app has no date library, so the few calculations are done by
 * hand).
 *
 * The Kotlin port models the JS `Date` argument as a [ZonedDateTime]
 * (instant + local zone) and an unparseable string as `null` (JS
 * `Invalid Date`/`NaN`). All local-wall-clock behavior needs the user's
 * [ZoneId]; default parameters take the system zone so callers from UI code
 * stay terse while tests can pin a zone and a [Clock].
 */

private const val DAYS_IN_WEEK = 7

/** ISO week: the day strip starts on Monday. */
private const val WEEK_STARTS_ON = 1

private const val MAX_EVENT_DURATION_MINUTES = 24 * 60

private val DATE_PATTERN = Regex("""^\d{4}-\d{2}-\d{2}$""")

/** Private JS `date.setDate(date.getDate() + days)`: local calendar-day arithmetic. */
private fun addDays(date: ZonedDateTime, days: Long): ZonedDateTime =
    ZonedDateTime.of(date.toLocalDateTime().plusDays(days), date.zone)

/** Monday 00:00 of the week containing [date]. */
fun getWeekStart(date: ZonedDateTime): ZonedDateTime {
    val localDate = date.toLocalDate()
    // JS `getDay()`: Sunday=0…Saturday=6; java.time: Monday=1…Sunday=7.
    val offset = (localDate.dayOfWeek.value - WEEK_STARTS_ON + DAYS_IN_WEEK) % DAYS_IN_WEEK
    return localDate.minusDays(offset.toLong()).atStartOfDay(date.zone)
}

fun getWeekDays(weekStart: ZonedDateTime): List<ZonedDateTime> =
    (0 until DAYS_IN_WEEK).map { addDays(weekStart, it.toLong()) }

fun shiftWeek(weekStart: ZonedDateTime, weeks: Int): ZonedDateTime =
    addDays(weekStart, weeks * DAYS_IN_WEEK.toLong())

/**
 * The half-open [from, to) range sent to the API. The backend rejects a
 * half-open range, so both bounds always travel together.
 */
data class WeekRange(val from: String, val to: String)

fun getWeekRange(weekStart: ZonedDateTime): WeekRange = WeekRange(
    from = formatIsoInstant(weekStart),
    to = formatIsoInstant(addDays(weekStart, DAYS_IN_WEEK.toLong())),
)

/** Local-time [start, end) bounds of a calendar day. */
data class DayRange(val start: ZonedDateTime, val end: ZonedDateTime)

fun getDayRange(day: ZonedDateTime): DayRange {
    val localDate = day.toLocalDate()
    // JS: `new Date(y, m, d)` / `new Date(y, m, d + 1)` — local midnights.
    return DayRange(
        start = localDate.atStartOfDay(day.zone),
        end = localDate.plusDays(1).atStartOfDay(day.zone),
    )
}

fun isSameDay(a: ZonedDateTime, b: ZonedDateTime): Boolean =
    a.toLocalDate() == b.toLocalDate()

fun isToday(date: ZonedDateTime, clock: Clock = Clock.systemDefaultZone()): Boolean =
    isSameDay(date, ZonedDateTime.now(clock))

/** Short weekday name ("Mon") for the day strip. */
fun formatWeekday(date: ZonedDateTime, locale: String): String =
    DateTimeFormatter.ofPattern("EEE", Locale.forLanguageTag(locale)).format(date)

/** Day heading ("Mon, Oct 21"). */
fun formatDayHeading(date: ZonedDateTime, locale: String): String =
    DateTimeFormatter.ofPattern("EEEE, MMM d", Locale.forLanguageTag(locale)).format(date)

/** Week range label ("Sep 30 – Oct 6, 2026"). */
fun formatWeekLabel(weekStart: ZonedDateTime, locale: String): String {
    val weekEnd = addDays(weekStart, (DAYS_IN_WEEK - 1).toLong())
    val monthFormatter = DateTimeFormatter.ofPattern("MMM", Locale.forLanguageTag(locale))
    val startMonth = monthFormatter.format(weekStart.toLocalDate())
    val endMonth = monthFormatter.format(weekEnd.toLocalDate())
    val year = weekEnd.year

    if (weekStart.month == weekEnd.month) {
        return "$startMonth ${weekStart.dayOfMonth} – ${weekEnd.dayOfMonth}, $year"
    }

    return "$startMonth ${weekStart.dayOfMonth} – $endMonth ${weekEnd.dayOfMonth}, $year"
}

/** Time range of an event ("3:45 PM – 4:45 PM"). */
fun formatTimeRange(startAt: String, endAt: String, zone: ZoneId = ZoneId.systemDefault()): String {
    val start = parseJsDate(startAt, zone)
    val end = parseJsDate(endAt, zone)
    // JS renders an invalid date string as "Invalid Date"; keep that visible.
    return "${start?.let(::formatTime) ?: "Invalid Date"} – ${end?.let(::formatTime) ?: "Invalid Date"}"
}

/** `yyyy-MM-dd` in local time. */
fun toDateInputValue(date: ZonedDateTime): String = getDayKey(date)

/**
 * Adds days to a `yyyy-MM-dd` date input value, keeping the same format.
 * (Port of web's `frontend/app/time/calendar/lib/week.ts`. Returns "" for
 * unparseable input, as the TS does.)
 */
fun addDaysToDateValue(dateValue: String, days: Int, zone: ZoneId = ZoneId.systemDefault()): String {
    val (year, month, day) = parseDateParts(dateValue) ?: return ""
    val date = jsLocalDateTime(year = year, month = month, day = day + days, zone = zone)
    return toDateInputValue(date)
}

private fun parseDateParts(dateValue: String): Triple<Int, Int, Int>? {
    val parts = dateValue.split('-')
    if (parts.size != 3 || parts.any { it.isEmpty() }) return null
    val year = jsInt(parts[0]) ?: return null
    val month = jsInt(parts[1]) ?: return null
    val day = jsInt(parts[2]) ?: return null
    return Triple(year, month, day)
}

/**
 * End of the local day of a `yyyy-MM-dd` value, as an ISO instant. A
 * recurring event repeats on that day, so the bound is the last instant of
 * the day the user picked. "" for unparseable input, as the TS does.
 */
fun toEndOfDayInstant(dateValue: String, zone: ZoneId = ZoneId.systemDefault()): String {
    val (year, month, day) = parseDateParts(dateValue) ?: return ""
    val end = jsLocalDateTime(year = year, month = month, day = day, hours = 23, minutes = 59, seconds = 59, millis = 999, zone = zone)
    return formatIsoInstant(end)
}

/** True when the event ends on the calendar day after it starts. */
fun isNextDayEnd(startAt: String, endAt: String, zone: ZoneId = ZoneId.systemDefault()): Boolean {
    val start = parseJsDate(startAt, zone) ?: return false
    val end = parseJsDate(endAt, zone) ?: return false
    return toDateInputValue(end) == addDaysToDateValue(toDateInputValue(start), 1)
}

/**
 * Builds a local date-time from a date value and a time of day. Construction
 * is local-time on purpose: the user edits their own wall clock, and
 * `toISOString()` converts to the instant the API needs. Null plays the role
 * of the TS `Invalid Date` return.
 */
fun combineDateAndTime(
    dateValue: String,
    hours: Int,
    minutes: Int,
    zone: ZoneId = ZoneId.systemDefault(),
): ZonedDateTime? = parseDateParts(dateValue)?.let { (year, month, day) ->
    jsLocalDateTime(year = year, month = month, day = day, hours = hours, minutes = minutes, zone = zone)
}

/**
 * True for a real `yyyy-MM-dd` calendar date (rejects 2026-02-31, which JS
 * field construction would roll over into March).
 */
fun isValidDateValue(value: String, zone: ZoneId = ZoneId.systemDefault()): Boolean {
    if (!DATE_PATTERN.matches(value)) return false
    val date = combineDateAndTime(value, 0, 0, zone) ?: return false
    val (year, month, day) = parseDateParts(value) ?: return false
    return date.year == year && date.monthValue == month && date.dayOfMonth == day
}

/** True for a 24-hour clock time (hours 0-23, minutes 0-59). */
fun isValidTimeOfDay(hours: Int, minutes: Int): Boolean =
    hours in 0..23 && minutes in 0..59

/** Longest event the API accepts (24 hours). */
fun isWithinMaxDuration(start: ZonedDateTime, end: ZonedDateTime): Boolean =
    Duration.between(start.toInstant(), end.toInstant()).toMillis() <=
        MAX_EVENT_DURATION_MINUTES * 60 * 1000L
