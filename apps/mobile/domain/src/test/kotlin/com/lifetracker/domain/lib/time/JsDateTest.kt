package com.lifetracker.domain.lib.time

import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Unit tests for the JS `Date`-semantics bridge (`JsDate.kt`). These pin the
 * quirks the ported logic depends on: `Number('') == 0`, field rollover,
 * years 0–99 → 1900–1999, and the three accepted ISO input shapes.
 */
class JsDateTest {

    private val utc: ZoneId = ZoneId.of("UTC")

    // ---- jsNumber / jsInt ----

    @Test
    fun `jsNumber maps an empty string to 0 like JS Number('')`() {
        assertEquals(0.0, jsNumber("")!!, 0.0)
        assertEquals(2.5, jsNumber("2.5")!!, 0.0)
        assertEquals(-7.0, jsNumber("-7")!!, 0.0)
        assertNull(jsNumber("garbage"))
    }

    @Test
    fun `jsInt truncates toward zero and rejects non-finite values`() {
        assertEquals(2, jsInt("2.9"))
        assertEquals(-2, jsInt("-2.9"))
        assertEquals(0, jsInt(""))
        assertNull(jsInt("Infinity"))
        assertNull(jsInt("NaN"))
        assertNull(jsInt("abc"))
    }

    // ---- jsLocalDateTime (field rollover) ----

    @Test
    fun `jsLocalDateTime rolls an out-of-range month into the next year`() {
        // Month 13 of 2026 -> January 2027 (JS `new Date(2026, 12, 1)`).
        assertEquals(
            ZonedDateTime.of(2027, 1, 1, 0, 0, 0, 0, utc),
            jsLocalDateTime(year = 2026, month = 13, day = 1, zone = utc),
        )
    }

    @Test
    fun `jsLocalDateTime rolls an out-of-range day into the next month`() {
        // Feb 30 -> Mar 2 (JS parity, non-leap year).
        assertEquals(
            ZonedDateTime.of(2026, 3, 2, 0, 0, 0, 0, utc),
            jsLocalDateTime(year = 2026, month = 2, day = 30, zone = utc),
        )
    }

    @Test
    fun `jsLocalDateTime treats years 0-99 as 1900-1999 (ECMA-262)`() {
        assertEquals(1950, jsLocalDateTime(year = 50, month = 1, day = 1, zone = utc).year)
        assertEquals(1999, jsLocalDateTime(year = 99, month = 1, day = 1, zone = utc).year)
        assertEquals(2026, jsLocalDateTime(year = 2026, month = 1, day = 1, zone = utc).year)
    }

    // ---- parseJsDate ----

    @Test
    fun `parseJsDate parses a full RFC3339 instant into the target zone`() {
        val parsed = parseJsDate("2026-09-30T03:00:00.000Z", utc)
        assertEquals(ZonedDateTime.of(2026, 9, 30, 3, 0, 0, 0, utc), parsed)
    }

    @Test
    fun `parseJsDate parses an explicit-offset instant`() {
        val parsed = parseJsDate("2026-09-30T03:00:00-03:00", ZoneId.of("America/Argentina/Buenos_Aires"))
        assertEquals(ZonedDateTime.of(2026, 9, 30, 3, 0, 0, 0, parsed!!.zone), parsed)
    }

    @Test
    fun `parseJsDate treats a dateless datetime as local wall time`() {
        val parsed = parseJsDate("2026-09-30T05:30:00", utc)
        assertEquals(ZonedDateTime.of(2026, 9, 30, 5, 30, 0, 0, utc), parsed)
    }

    @Test
    fun `parseJsDate treats a plain date as UTC midnight (not local midnight)`() {
        val art = ZoneId.of("America/Argentina/Buenos_Aires")
        val parsed = parseJsDate("2026-09-30", art)
        // UTC midnight == 2026-09-29 21:00 in ART.
        assertEquals(ZonedDateTime.of(2026, 9, 29, 21, 0, 0, 0, art), parsed)
    }

    @Test
    fun `parseJsDate is null for unparseable strings (JS Invalid Date)`() {
        assertNull(parseJsDate("garbage", utc))
        assertNull(parseJsDate("2026-13-40", utc))
    }

    // ---- formatIsoInstant ----

    @Test
    fun `formatIsoInstant emits UTC with exactly three millisecond digits`() {
        val date = ZonedDateTime.of(2026, 9, 30, 3, 0, 0, 0, utc)
        assertEquals("2026-09-30T03:00:00.000Z", formatIsoInstant(date))

        val millis = ZonedDateTime.of(2026, 9, 30, 3, 0, 0, 123_000_000, utc)
        assertEquals("2026-09-30T03:00:00.123Z", formatIsoInstant(millis))
    }

    @Test
    fun `formatIsoInstant normalizes the zone to UTC`() {
        val art = ZonedDateTime.of(2026, 9, 30, 0, 0, 0, 0, ZoneId.of("America/Argentina/Buenos_Aires"))
        assertEquals("2026-09-30T03:00:00.000Z", formatIsoInstant(art))
    }
}
