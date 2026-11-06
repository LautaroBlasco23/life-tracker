package com.lifetracker.core.network.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire enums for the activity / routine / reminder / time / calendar domains.
 * Raw values are sent and received exactly lowercase, so every entry carries
 * `@SerialName` (see `kotlin-refactor/api-contract.md` §12).
 */

/** Activity/routine `frequency` — wire values `daily`, `weekly`, `monthly`. */
@Serializable
enum class Frequency {
    @SerialName("daily") DAILY,
    @SerialName("weekly") WEEKLY,
    @SerialName("monthly") MONTHLY,
}

/** `dayTime` — wire values `notSpecified`, `morning`, `afternoon`, `evening`. */
@Serializable
enum class DayTime {
    @SerialName("notSpecified") NOT_SPECIFIED,
    @SerialName("morning") MORNING,
    @SerialName("afternoon") AFTERNOON,
    @SerialName("evening") EVENING,
}

/** `privacyStatus` — wire values `public`, `private`. */
@Serializable
enum class PrivacyStatus {
    @SerialName("public") PUBLIC,
    @SerialName("private") PRIVATE,
}

/** Routine `status` — wire values `draft`, `active`, `stopped`. */
@Serializable
enum class RoutineStatus {
    @SerialName("draft") DRAFT,
    @SerialName("active") ACTIVE,
    @SerialName("stopped") STOPPED,
}

/** Calendar recurrence `rule` — currently only `weekly` is supported. */
@Serializable
enum class RecurrenceRule {
    @SerialName("weekly") WEEKLY,
}

/** Calendar update/delete `scope` — wire values `occurrence`, `series`. */
@Serializable
enum class EventScope {
    @SerialName("occurrence") OCCURRENCE,
    @SerialName("series") SERIES,
}
