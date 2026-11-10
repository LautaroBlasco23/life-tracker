package com.lifetracker.feature.time

import com.lifetracker.core.i18n.I18n

/** Shared TIME_CATEGORIES (port of `packages/shared/src/types/time.ts`). */
internal val TIME_CATEGORIES: List<String> = listOf(
    "Reading", "Gaming", "Exercise", "Work", "Study",
    "Meditation", "Hobbies", "Social", "Entertainment", "Other",
)

/**
 * `t(key, param = value)`: dot-path string lookup with `{name}` interpolation
 * (the shared messages JSON uses react-intl style placeholders that the
 * flattened-string `I18n.t` does not interpolate).
 */
internal fun t(key: String, vararg params: Pair<String, Any?>): String =
    params.fold(I18n.t(key)) { acc, (name, value) ->
        acc.replace("{$name}", value?.toString() ?: "")
    }

/** Joiner for toast titles + optional descriptions (`showToast({title, description})`). */
internal fun toastText(title: String, description: String? = null): String =
    if (description.isNullOrAbsent()) title else "$title — $description"

private fun String?.isNullOrAbsent(): Boolean = this == null || this.isEmpty()

/** RN `CategoryHeader` pluralization: "1 entry" / "3 entries" (endsWith "y" → "ies"). */
internal fun pluralizedName(itemName: String, count: Int): String =
    if (count == 1) {
        itemName
    } else if (itemName.endsWith('y')) {
        itemName.dropLast(1) + "ies"
    } else {
        itemName + "s"
    }

/** Localized short weekday/day-heading locale tag for the domain formatters. */
internal val currentIntlLocale: String get() =
    when (I18n.current) {
        I18n.Language.SPANISH -> "es-ES"
        else -> "en-US"
    }

/** JS string `"09"` for padded hour/minute prefill in the event form. */
internal fun twoDigits(value: Int): String = value.toString().padStart(2, '0')

/** Manual-create toast duration text (record-form-modal rule: "2h 5m" / "45 min"). */
internal fun manualDurationText(totalMinutes: Int): String =
    if (totalMinutes >= 60) "${totalMinutes / 60}h ${totalMinutes % 60}m" else "$totalMinutes min"
