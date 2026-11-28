package com.lifetracker.domain.time

import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Unit tests for the public ISO-instant parser used by the repositories and
 * screens (semantics of JS `new Date(string)` for the strings the backend
 * exchanges). Mirrors `JsDateTest` at the module boundary.
 */
class ParseInstantTest {

    private val utc = ZoneId.of("UTC")

    @Test
    fun `parses a full RFC3339 instant`() {
        val parsed = parseInstant("2026-09-30T03:00:00.000Z", utc)
        assertEquals("2026-09-30T03:00", parsed!!.format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm")))
        assertEquals(utc, parsed.zone)
    }

    @Test
    fun `parses an explicit-offset instant into the target zone`() {
        val art = ZoneId.of("America/Argentina/Buenos_Aires")
        val parsed = parseInstant("2026-09-30T03:00:00-03:00", art)
        assertEquals(art, parsed!!.zone)
        assertEquals(3, parsed.hour)
    }

    @Test
    fun `parses a timezone-less datetime as local wall time`() {
        val parsed = parseInstant("2026-09-30T05:30:00", utc)
        assertEquals(5, parsed!!.hour)
        assertEquals(30, parsed.minute)
    }

    @Test
    fun `parses a plain date as UTC midnight, not local midnight`() {
        val art = ZoneId.of("America/Argentina/Buenos_Aires")
        val parsed = parseInstant("2026-09-30", art)
        assertEquals(21, parsed!!.hour) // 2026-09-30 21:00 ART == UTC midnight
        assertEquals(29, parsed.dayOfMonth)
    }

    @Test
    fun `is null for unparseable strings`() {
        assertNull(parseInstant("garbage", utc))
        assertNull(parseInstant("2026-99-99T03:00:00Z", utc))
    }

    @Test
    fun `accepts the optional-zone strings the repositories feed it`() {
        // The backend sends millisecond-less instants too ("...T03:00:00Z").
        assertEquals(3, parseInstant("2026-09-30T03:00:00Z", utc)!!.hour)
    }
}
