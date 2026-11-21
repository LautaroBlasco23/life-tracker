package com.lifetracker.domain.lib.time

import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Unit tests for the date/time form helpers shared by the activity/reminder
 * forms (`buildDateTime` + input-format round-trips). All expectations are
 * pinned to a fixed zone so the tests stay deterministic.
 */
class DatetimeTest {

    private val zone: ZoneId = ZoneId.of("UTC")
    private val date: ZonedDateTime = ZonedDateTime.of(2026, 9, 30, 8, 45, 12, 0, zone)

    @Test
    fun `buildDateTime combines date and HH-MM into a local date-time`() {
        val result = buildDateTime(date, "14:30")
        assertEquals(ZonedDateTime.of(2026, 9, 30, 14, 30, 0, 0, zone), result)
    }

    @Test
    fun `buildDateTime keeps only the calendar date (drops the input's wall time)`() {
        // JS `setHours(h, m, 0, 0)` zero-fills seconds and milliseconds, and
        // the 08:45 of the base date must not leak into the result.
        assertEquals(ZonedDateTime.of(2026, 9, 30, 0, 5, 0, 0, zone), buildDateTime(date, "00:05"))
    }

    @Test
    fun `buildDateTime accepts an empty segment as 0 (JS Number('') == 0)`() {
        // "12:" has a trailing empty segment — JS parses it as minutes 0.
        assertEquals(ZonedDateTime.of(2026, 9, 30, 12, 0, 0, 0, zone), buildDateTime(date, "12:"))
    }

    @Test
    fun `buildDateTime is null for a missing segment (JS NaN)`() {
        // No colon at all: the minute segment is missing, not empty.
        assertNull(buildDateTime(date, "12"))
        assertNull(buildDateTime(date, ""))
    }

    @Test
    fun `buildDateTime is null for non-numeric segments`() {
        assertNull(buildDateTime(date, "aa:bb"))
        assertNull(buildDateTime(date, "12:x"))
    }

    @Test
    fun `buildDateTime rolls out-of-range values into the next day (JS MakeTime)`() {
        // 25:90 -> +25h +90m from midnight: next day 02:30.
        assertEquals(
            ZonedDateTime.of(2026, 10, 1, 2, 30, 0, 0, zone),
            buildDateTime(date, "25:90"),
        )
    }

    @Test
    fun `formatDateInput yields a zero-padded YYYY-MM-DD value`() {
        assertEquals("2026-09-30", formatDateInput(date))
        assertEquals("2026-01-05", formatDateInput(ZonedDateTime.of(2026, 1, 5, 3, 0, 0, 0, zone)))
    }

    @Test
    fun `formatTimeInput yields a zero-padded HH-MM value`() {
        assertEquals("08:45", formatTimeInput(date))
        assertEquals("14:30", formatTimeInput(ZonedDateTime.of(2026, 9, 30, 14, 30, 0, 0, zone)))
    }

    @Test
    fun `format + build round-trip`() {
        val source = ZonedDateTime.of(2026, 2, 14, 9, 7, 33, 0, zone)
        val rebuilt = buildDateTime(source, formatTimeInput(source))
        assertEquals(source.truncatedTo(java.time.temporal.ChronoUnit.MINUTES), rebuilt)
    }
}
