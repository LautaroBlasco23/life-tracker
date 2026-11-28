package com.lifetracker.domain.lib.time

import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.Assert.assertEquals
import org.junit.Test

/** Unit tests for the shared formatting helpers (`format.ts` port). */
class FormatTest {

    private val zone: ZoneId = ZoneId.of("UTC")

    private fun at(month: Int, day: Int, hour: Int, minute: Int) =
        ZonedDateTime.of(2026, month, day, hour, minute, 0, 0, zone)

    @Test
    fun `getDayKey pads month and day but not the year`() {
        assertEquals("2026-09-30", getDayKey(at(9, 30, 3, 45)))
        assertEquals("2026-01-05", getDayKey(at(1, 5, 23, 59)))
    }

    @Test
    fun `getDayKey uses local wall time of the given zone, not the instant`() {
        val instant = ZonedDateTime.of(2026, 9, 30, 23, 30, 0, 0, zone)
            .withZoneSameInstant(ZoneId.of("America/Argentina/Buenos_Aires"))
        // Same instant is 2026-09-30 20:30 in ART — the key must reflect the zone.
        assertEquals("2026-09-30", getDayKey(instant))
    }

    @Test
    fun `formatShortDate renders an en-US short date`() {
        assertEquals("Sep 30, 2026", formatShortDate(at(9, 30, 3, 45)))
        assertEquals("Jan 5, 2026", formatShortDate(at(1, 5, 3, 45)))
    }

    @Test
    fun `formatTime renders a padded en-US 12h clock`() {
        assertEquals("03:45 AM", formatTime(at(9, 30, 3, 45)))
        assertEquals("12:05 AM", formatTime(at(9, 30, 0, 5)))
        assertEquals("02:30 PM", formatTime(at(9, 30, 14, 30)))
    }
}
