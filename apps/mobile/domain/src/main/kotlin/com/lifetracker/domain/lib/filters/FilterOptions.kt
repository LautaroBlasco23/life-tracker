package com.lifetracker.domain.lib.filters

import java.time.LocalDate

/** Value/label pair for select-like controls (mobile port of the web `Option`). */
data class FilterOption(val value: String, val label: String)

/** i18n translator for the `months` namespace (e.g. `t("january")` → "January"). */
private typealias MonthsTranslations = (key: String) -> String

private val MONTH_KEYS = listOf(
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
)

// Month/year options for the filter modal: these functions replace the React
// hooks `useMonthYearOptions`/`useMonthLabel` with pure logic that a Compose
// caller wires to its translator.

/** i18n'd month/year options for the filter modal (web parity: MONTHS/YEARS). */
data class MonthYearOptions(val monthOptions: List<FilterOption>, val yearOptions: List<FilterOption>)

fun monthYearOptions(tMonths: MonthsTranslations, now: LocalDate): MonthYearOptions {
    val monthOptions = MONTH_KEYS.mapIndexed { index, key ->
        FilterOption(value = (index + 1).toString(), label = tMonths(key))
    }
    // JS: `Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i)`
    // — the last ten years, newest first.
    val yearOptions = (0 until 10).map { i -> now.year - i }
        .map { year -> FilterOption(value = year.toString(), label = year.toString()) }
    return MonthYearOptions(monthOptions = monthOptions, yearOptions = yearOptions)
}

/** Localized month label ("March"), 1-12. */
fun monthLabel(tMonths: MonthsTranslations, month: Int): String =
    tMonths(MONTH_KEYS[month - 1])
