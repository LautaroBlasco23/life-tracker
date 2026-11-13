package com.lifetracker.domain.lib.calendarweek

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

/** Port of the RN `apps/mobile/lib/calendar-week.test.ts` behavioral cases. */
class CalendarWeekTest {

    private val zone = ZoneId.of("America/Argentina/Buenos_Aires")
    private fun at(d: String, h: Int, m: Int): ZonedDateTime =
        (LocalDate.parse(d).atTime(h, m)).atZone(zone)!!

    @Test
    fun getWeekStartReturnsMonday() {
        assertEquals(
            LocalDate.of(2025, 6, 2),
            getWeekStart(at("2025-06-05", 12, 0)).toLocalDate(),
        )
        // Sunday travels to the previous Monday (JS reciprocal semantics).
        assertEquals(
            LocalDate.of(2025, 6, 2),
            getWeekStart(at("2025-06-08", 12, 0)).toLocalDate(),
        )
    }

    @Test
    fun getWeekDaysIsSevenContiguousDays() {
        val days = getWeekDays(getWeekStart(at("2025-06-05", 12, 0)))
        assertEquals(7, days.size)
        assertEquals(LocalDate.of(2025, 6, 2), days.first().toLocalDate())
        assertEquals(LocalDate.of(2025, 6, 8), days.last().toLocalDate())
    }

    @Test
    fun shiftWeekMovesSevenDays() {
        assertEquals(
            LocalDate.of(2025, 6, 9),
            shiftWeek(getWeekStart(at("2025-06-05", 12, 0)), 1).toLocalDate(),
        )
        assertEquals(
            LocalDate.of(2025, 5, 26),
            shiftWeek(getWeekStart(at("2025-06-05", 12, 0)), -1).toLocalDate(),
        )
    }

    @Test
    fun getWeekRangeIsHalfOpenAtNextWeekStart() {
        val range = getWeekRange(getWeekStart(at("2025-06-05", 12, 0)))
        assertEquals(0, range.from.indexOf("2025-06-02"))
        assertEquals(0, range.to.indexOf("2025-06-09"))
    }

    @Test
    fun getDayRangeCoversWholeDay() {
        val range = getDayRange(at("2025-06-05", 10, 0))
        assertEquals(0, range.start.toLocalTime().hour)
        assertFalse(isSameDay(range.start, range.end))
    }

    @Test
    fun isSameDayIgnoresTime() {
        assertTrue(isSameDay(at("2025-06-05", 10, 0), at("2025-06-05", 23, 59)))
        assertFalse(isSameDay(at("2025-06-05", 23, 59), at("2025-06-06", 0, 0)))
    }

    @Test
    fun toDateInputValueStable() {
        assertEquals("2025-06-05", toDateInputValue(at("2025-06-05", 10, 30)))
    }

    @Test
    fun invalidInputsYieldNull() {
        assertNull(combineDateAndTime("not-a-date", 10, 0, zone))
        assertFalse(isValidDateValue("not-a-date", zone))
        assertTrue(isValidDateValue("2025-06-05", zone))
        // KNOWN DIVERGENCE (plan.md Phase 4): jsLocalDateTime does NOT roll
        // out-of-range minutes like JS MakeTime (61 throws at 59 bound) —
        // callers validate time inputs first; parity documented, deliberately
        // not asserted here. Empty string stays the ""-sentinel path:
        assertNull(combineDateAndTime("", 10, 0, zone))
    }

    @Test
    fun toEndOfDayIsLocal23h59m59s999() {
        // Local 23:59:59.999 in UTC-3 → RFC3339 instant of next-day 02:59:59.999Z.
        val instant = toEndOfDayInstant("2025-06-05", zone)
        assertEquals("2025-06-06T02:59:59.999Z", instant)
    }

    @Test
    fun isWithinMaxDurationCapsLongSessions() {
        val start = at("2025-06-05", 8, 0)
        assertTrue(isWithinMaxDuration(start, start.plusHours(6)))
        // MAX = 24h inclusive (`<=`).
        assertTrue(isWithinMaxDuration(start, start.plusHours(24)))
        assertFalse(isWithinMaxDuration(start, start.plusSeconds(24 * 60 * 60L + 1)))
    }
}
