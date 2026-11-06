package com.lifetracker.feature.finance

import com.lifetracker.core.designsystem.NavEntry
import com.lifetracker.core.i18n.I18n
import com.lifetracker.domain.lib.time.getDayKey
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.text.NumberFormat
import java.util.Locale

/** Shared helpers for the finance screens (port of `@shared/utils/format` + glue). */

/**
 * `t(key, param = value)`: dot-path string lookup with `{name}` interpolation
 * (same pattern as the other feature ports).
 */
internal fun t(key: String, vararg params: Pair<String, Any?>): String =
    params.fold(I18n.t(key)) { acc, (name, value) ->
        acc.replace("{$name}", value?.toString() ?: "")
    }

/** Joiner for toast titles + optional descriptions (`showToast({title, description})`). */
internal fun toastText(title: String, description: String? = null): String =
    if (description.isNullOrAbsent()) title else "$title — $description"

private fun String?.isNullOrAbsent(): Boolean = this == null || this.isEmpty()

/** `amount.toLocaleString('en-US', { min 0, max 2 })` — plain "$" gets prefixed at call sites. */
internal fun formatCurrency(amount: Double): String =
    (NumberFormat.getInstance(Locale.US) as java.text.DecimalFormat).apply {
        minimumFractionDigits = 0
        maximumFractionDigits = 2
    }.format(amount)

/** Keeps only digits, then formats with thousands separators (`formatInputValue`). */
internal fun formatInputValue(value: String): String {
    val numericValue = value.filter { it.isDigit() }
    if (numericValue.isEmpty()) return ""
    return NumberFormat.getInstance(Locale.US).format(numericValue.toLong())
}

/** Strips the grouping separators an amount field received (`parseInputValue`). */
internal fun parseInputValue(formattedValue: String): String = formattedValue.replace(",", "")

/**
 * `new Date("YYYY-MM-DDT00:00:00").toISOString()` — local midnight, rendered as
 * a UTC instant (the app sends its IANA timezone; the backend filters in it).
 */
internal fun dateInputToISO(dateStr: String, zone: ZoneId = ZoneId.systemDefault()): String =
    runCatching { java.time.LocalDate.parse(dateStr.trim()) }
        .getOrNull()?.atStartOfDay(zone)?.toInstant()?.toString()
        ?: ZonedDateTime.now(zone).toInstant().toString()

/** User's local calendar date (YYYY-MM-DD) for "today" (`todayInput`). */
internal fun todayInput(): String {
    val now = ZonedDateTime.now()
    return "${now.year}-${now.monthValue.toString().padStart(2, '0')}-${now.dayOfMonth.toString().padStart(2, '0')}"
}

/**
 * Day-header label: "Today" / "Yesterday" (localized) or a readable date
 * (`getDayLabel`); the trailing date itself stays en-US like the RN helper.
 */
internal fun formatDayLabel(date: ZonedDateTime, now: ZonedDateTime): String {
    if (getDayKey(date) == getDayKey(now)) return I18n.t("finance.today")
    if (getDayKey(date) == getDayKey(now.minusDays(1))) return I18n.t("finance.yesterday")
    val sameYear = date.year == now.year
    return DateTimeFormatter.ofPattern(if (sameYear) "MMMM d" else "MMMM d, yyyy", Locale.US).format(date)
}

/** `t('financeCategories.<name>')` — the RN screens translate raw category names. */
internal fun categoryLabel(name: String): String = I18n.t("financeCategories.$name")

/**
 * Hamburger drawer entries, per RN `components/navigation.tsx` NAV_ITEMS
 * (same list + call-site wiring as the other ported screens).
 */
internal fun financeNavItems(): List<NavEntry> = listOf(
    NavEntry("activities", I18n.t("nav.activities"), FinanceIcons.Activity),
    NavEntry("time", I18n.t("nav.timeTracker"), FinanceIcons.Timer),
    NavEntry("notes", I18n.t("nav.notes"), FinanceIcons.StickyNote),
    NavEntry("finance/transactions", I18n.t("nav.financeTransactions"), FinanceIcons.Wallet),
    NavEntry("finance/dashboard", I18n.t("nav.financeDashboard"), FinanceIcons.ChartPie),
    NavEntry("social", I18n.t("nav.social"), FinanceIcons.Users),
)
