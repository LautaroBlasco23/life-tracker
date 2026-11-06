package com.lifetracker.domain.lib.filters

/** i18n translator for the `timeCategories` namespace. */
private typealias TimeCategoriesTranslations = (key: String) -> String

/** Time categories (shared TIME_CATEGORIES) mapped to the i18n message keys. */
private val CATEGORY_KEYS: Map<String, String> = mapOf(
    "reading" to "reading",
    "gaming" to "gaming",
    "exercise" to "exercise",
    "work" to "work",
    "study" to "study",
    "meditation" to "meditation",
    "hobbies" to "hobbies",
    "social" to "social",
    "entertainment" to "entertainment",
    "other" to "other",
)

/**
 * Localized label for a time/calendar category. Unknown categories fall back
 * to "Other" so a value added upstream never renders as a raw key.
 *
 * Kotlin port of the React hook `useCategoryLabel`; a Compose caller wires
 * its translator into this pure function.
 */
fun categoryLabel(tTimeCategories: TimeCategoriesTranslations, category: String): String =
    tTimeCategories(CATEGORY_KEYS[category.lowercase()] ?: "other")
