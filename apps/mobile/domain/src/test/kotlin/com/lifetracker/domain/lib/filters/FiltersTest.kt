package com.lifetracker.domain.lib.filters

import java.time.LocalDate
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Unit tests for the pure i18n filter helpers (the Compose-free replacements
 * of the web `useCategoryLabel`/`useMonthYearOptions` hooks).
 */
class FiltersTest {

    /** Identity translator: labels equal the message key they looked up. */
    private val t: (String) -> String = { it }

    @Test
    fun `categoryLabel translates a known category`() {
        assertEquals("reading", categoryLabel(t, "reading"))
        assertEquals("work", categoryLabel(t, "work"))
    }

    @Test
    fun `categoryLabel is case-insensitive`() {
        assertEquals("gaming", categoryLabel(t, "GAMING"))
        assertEquals("meditation", categoryLabel(t, "Meditation"))
    }

    @Test
    fun `categoryLabel falls back to other for unknown categories`() {
        assertEquals("other", categoryLabel(t, "surfing"))
        assertEquals("other", categoryLabel(t, ""))
    }

    @Test
    fun `monthYearOptions yields 12 month options with 1-12 values`() {
        val options = monthYearOptions(t, LocalDate.of(2026, 9, 30))
        assertEquals(12, options.monthOptions.size)
        assertEquals(listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"),
            options.monthOptions.map { it.value })
        assertEquals("january", options.monthOptions.first().label)
        assertEquals("december", options.monthOptions.last().label)
    }

    @Test
    fun `monthYearOptions yields the last ten years, newest first`() {
        val options = monthYearOptions(t, LocalDate.of(2026, 9, 30))
        assertEquals(10, options.yearOptions.size)
        assertEquals((2026 downTo 2017).map { it.toString() }, options.yearOptions.map { it.value })
        // Label and value are the same year string (web MONTHS/YEARS parity).
        assertEquals(options.yearOptions.map { it.value }, options.yearOptions.map { it.label })
    }

    @Test
    fun `monthLabel translates the 1-based month`() {
        assertEquals("march", monthLabel(t, 3))
        assertEquals("january", monthLabel(t, 1))
        assertEquals("december", monthLabel(t, 12))
    }

    @Test
    fun `smoke - helpers build with a real zone without touching i18n assets`() {
        // Guards the pure signature against accidental Android dependencies.
        monthYearOptions(t, LocalDate.now(ZoneId.of("UTC")))
    }
}
