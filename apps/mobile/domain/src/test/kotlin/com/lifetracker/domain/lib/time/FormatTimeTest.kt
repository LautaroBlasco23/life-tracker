package com.lifetracker.domain.lib.time

import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.Assert.assertEquals
import org.junit.Test

/** Unit tests for the record/timer display helpers (`format-time.ts` port). */
class FormatTimeTest {

    @Test
    fun `formatDuration keeps minutes below an hour`() {
        assertEquals("0 min", formatDuration(0))
        assertEquals("45 min", formatDuration(45))
        assertEquals("59 min", formatDuration(59))
    }

    @Test
    fun `formatDuration uses whole hours without a minutes part`() {
        assertEquals("1h", formatDuration(60))
        assertEquals("2h", formatDuration(120))
    }

    @Test
    fun `formatDuration splits hours and leftover minutes`() {
        assertEquals("1h 5m", formatDuration(65))
        assertEquals("2h 5m", formatDuration(125))
    }

    @Test
    fun `formatTimerDisplay pads every segment to two digits`() {
        assertEquals("00:00:00", formatTimerDisplay(0))
        assertEquals("00:00:59", formatTimerDisplay(59))
        assertEquals("00:01:01", formatTimerDisplay(61))
        assertEquals("01:01:01", formatTimerDisplay(3661))
        assertEquals("02:02:05", formatTimerDisplay(7325))
    }

    @Test
    fun `formatRecordDate renders short date + padded 12h time in the given zone`() {
        val utc = ZoneId.of("UTC")
        assertEquals(
            "Sep 30, 2026 03:00 AM",
            formatRecordDate("2026-09-30T03:00:00.000Z", utc),
        )
    }

    @Test
    fun `formatRecordDate falls back to the JS Invalid Date literal for garbage input`() {
        assertEquals(
            "Invalid Date Invalid Date",
            formatRecordDate("not-a-date", ZoneId.of("UTC")),
        )
    }
}
