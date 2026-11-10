package com.lifetracker.feature.activities

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import com.lifetracker.core.i18n.I18n

/**
 * Screen-level helpers for the Activities port: i18n interpolation (the RN
 * screens call `t(key, { param })`; `I18n.t` has no params), RFC3339 parsing
 * that mirrors the JS `new Date(string)` semantics ported in
 * `domain/lib/time` (internal there, so re-stated locally), and the
 * `formatDateTime` / `formatRemaining` outputs of `reminder-card.tsx`.
 */

/** `I18n.t(key)` with `{name}` interpolation, e.g. `tf("x.y", "date" to now)`. */
internal fun tf(key: String, vararg params: Pair<String, Any>): String {
    var text = I18n.t(key)
    params.forEach { (name, value) -> text = text.replace("{$name}", value.toString()) }
    return text
}

/**
 * JS `new Date(string)` semantics: full instants end with `Z`/offset and parse
 * absolute; datetimes without a zone are local wall time; plain `YYYY-MM-DD`
 * dates are UTC midnight (not local). Unparseable input → null (Invalid Date).
 */
internal fun parseJsDate(value: String, zone: ZoneId = ZoneId.systemDefault()): ZonedDateTime? {
    val offsetSuffix = Regex("[+\\-]\\d\\d:\\d\\d$")
    if (value.endsWith("Z") || offsetSuffix.containsMatchIn(value)) {
        runCatching { Instant.parse(value) }.getOrNull()?.let { return it.atZone(zone) }
    }
    runCatching { LocalDateTime.parse(value) }.getOrNull()?.let { return it.atZone(zone) }
    return runCatching { LocalDate.parse(value) }
        .getOrNull()
        ?.let { it.atStartOfDay(java.time.ZoneOffset.UTC).withZoneSameInstant(zone) }
}

/** `Date.prototype.toISOString()`: UTC instant with `Z` suffix. */
internal fun toIsoInstant(date: ZonedDateTime): String =
    DateTimeFormatter.ISO_INSTANT.format(date.toInstant())

/**
 * `date.toLocaleString(undefined, { month: 'short', day: 'numeric',
 * hour: 'numeric', minute: '2-digit' })` — "Nov 6, 3:45 PM".
 */
internal fun formatDateTime(date: ZonedDateTime): String =
    DateTimeFormatter.ofPattern("MMM d, h:mm a", Locale.US).format(date)

/** Faithful port of `formatRemaining` from `reminder-card.tsx` (minute precision). */
internal fun formatRemaining(ms: Long): String {
    if (ms <= 0) return ""
    val totalMinutes = ms / 60_000
    val days = totalMinutes / (24 * 60)
    val hours = (totalMinutes % (24 * 60)) / 60
    val minutes = totalMinutes % 60
    if (days > 0) return "${days}d ${hours}h"
    if (hours > 0) return "${hours}h ${minutes}m"
    return "${minutes}m"
}
