package com.lifetracker.domain.lib.activities

/**
 * Curated catalog of predefined activities users can clone.
 * Titles/descriptions are translated via the `activityTemplates` i18n
 * namespace using the template [ActivityTemplate.key]
 * (e.g. `template_drinkWater`, `category_health`).
 *
 * Kotlin port of `packages/shared/src/lib/activity-templates.ts`. The enum
 * names/fields mirror `packages/shared/src/types/activity.ts`, and the raw
 * values match the wire contract (api-contract.md §12) exactly — keep them
 * so serialization layers can emit them verbatim.
 */

/** Wire values are sent/received exactly lowercase (api-contract.md §12). */
enum class Frequency(val raw: String) {
    DAILY("daily"),
    WEEKLY("weekly"),
    MONTHLY("monthly"),
}

/**
 * Day names inside `dayFrequency` (sent as a JSON string of raw values,
 * e.g. `["monday","friday"]`). Wire values are exactly lowercase.
 */
enum class DayOfWeek(val raw: String) {
    MONDAY("monday"),
    TUESDAY("tuesday"),
    WEDNESDAY("wednesday"),
    THURSDAY("thursday"),
    FRIDAY("friday"),
    SATURDAY("saturday"),
    SUNDAY("sunday"),
}

/** Wire values are sent/received exactly lowercase (`notSpecified` first). */
enum class DayTime(val raw: String) {
    NOT_SPECIFIED("notSpecified"),
    MORNING("morning"),
    AFTERNOON("afternoon"),
    EVENING("evening"),
}

enum class ActivityTemplateCategory(val raw: String) {
    HEALTH("health"),
    STUDY("study"),
    GOOD_HABITS("goodHabits"),
    HOME_TRAINING("homeTraining"),
    HOME("home"),
    PRODUCTIVITY("productivity"),
    MIND_SOCIAL("mindSocial"),
}

data class ActivityTemplate(
    /** i18n key suffix for the title: `template_{key}`. */
    val key: String,
    val category: ActivityTemplateCategory,
    val frequency: Frequency,
    /** Absent (null) when [Frequency.DAILY] — the TS optional `dayFrequency?`. */
    val dayFrequency: List<DayOfWeek>? = null,
    val dayTime: DayTime,
    val completionAmount: Int,
)

val ACTIVITY_TEMPLATE_CATEGORIES: List<ActivityTemplateCategory> = listOf(
    ActivityTemplateCategory.HEALTH,
    ActivityTemplateCategory.STUDY,
    ActivityTemplateCategory.GOOD_HABITS,
    ActivityTemplateCategory.HOME_TRAINING,
    ActivityTemplateCategory.HOME,
    ActivityTemplateCategory.PRODUCTIVITY,
    ActivityTemplateCategory.MIND_SOCIAL,
)

/** Top-level template type shown in the first dropdown of the templates modal. */
enum class TemplateKind { ACTIVITY, ROUTINE }

/**
 * Categories of routine templates. Raw values reuse existing activity
 * categories so the i18n keys (`category_home`, `category_homeTraining`)
 * are shared.
 */
enum class RoutineTemplateCategory(val raw: String) {
    HOME("home"),
    HOME_TRAINING("homeTraining"),
}

data class RoutineTemplate(
    /** i18n key suffix for the title: `template_{key}`. */
    val key: String,
    val category: RoutineTemplateCategory,
    /** Keys of the activity templates the routine bundles, in order. */
    val activities: List<String>,
)

val ROUTINE_TEMPLATES: List<RoutineTemplate> = listOf(
    RoutineTemplate(
        key = "morningReset",
        category = RoutineTemplateCategory.HOME,
        activities = listOf("drinkWater", "vitamins", "stretch5", "makeBed"),
    ),
    RoutineTemplate(
        key = "cleaningDay",
        category = RoutineTemplateCategory.HOME,
        activities = listOf("dishes", "laundry", "vacuum", "trash"),
    ),
    RoutineTemplate(
        key = "eveningWindDown",
        category = RoutineTemplateCategory.HOME,
        activities = listOf("floss", "journal5", "planTomorrow", "sleep7to8"),
    ),
    RoutineTemplate(
        key = "homeWorkout",
        category = RoutineTemplateCategory.HOME_TRAINING,
        activities = listOf("pushups20", "squats30", "plank1"),
    ),
)

/** Second-dropdown options per template kind. */
val TEMPLATE_CATEGORIES_BY_KIND: Map<TemplateKind, List<String>> = mapOf(
    TemplateKind.ACTIVITY to ACTIVITY_TEMPLATE_CATEGORIES.map { it.raw },
    TemplateKind.ROUTINE to RoutineTemplateCategory.entries.map { it.raw },
)
val ACTIVITY_TEMPLATES: List<ActivityTemplate> = listOf(
    // Health
    ActivityTemplate(key = "drinkWater", category = ActivityTemplateCategory.HEALTH, frequency = Frequency.DAILY, dayTime = DayTime.MORNING, completionAmount = 8),
    ActivityTemplate(key = "sleep7to8", category = ActivityTemplateCategory.HEALTH, frequency = Frequency.DAILY, dayTime = DayTime.EVENING, completionAmount = 1),
    ActivityTemplate(key = "vitamins", category = ActivityTemplateCategory.HEALTH, frequency = Frequency.DAILY, dayTime = DayTime.MORNING, completionAmount = 1),
    ActivityTemplate(key = "walk10k", category = ActivityTemplateCategory.HEALTH, frequency = Frequency.DAILY, dayTime = DayTime.NOT_SPECIFIED, completionAmount = 1),
    ActivityTemplate(key = "floss", category = ActivityTemplateCategory.HEALTH, frequency = Frequency.DAILY, dayTime = DayTime.EVENING, completionAmount = 1),
    ActivityTemplate(key = "stretch5", category = ActivityTemplateCategory.HEALTH, frequency = Frequency.DAILY, dayTime = DayTime.EVENING, completionAmount = 1),
    ActivityTemplate(key = "mealPrep", category = ActivityTemplateCategory.HEALTH, frequency = Frequency.WEEKLY, dayFrequency = listOf(DayOfWeek.SUNDAY), dayTime = DayTime.MORNING, completionAmount = 1),

    // Study / Learning
    ActivityTemplate(key = "read30", category = ActivityTemplateCategory.STUDY, frequency = Frequency.DAILY, dayTime = DayTime.EVENING, completionAmount = 1),
    ActivityTemplate(key = "study45", category = ActivityTemplateCategory.STUDY, frequency = Frequency.DAILY, dayTime = DayTime.AFTERNOON, completionAmount = 2),
    ActivityTemplate(key = "vocabulary", category = ActivityTemplateCategory.STUDY, frequency = Frequency.DAILY, dayTime = DayTime.MORNING, completionAmount = 1),
    ActivityTemplate(key = "courseLesson", category = ActivityTemplateCategory.STUDY, frequency = Frequency.DAILY, dayTime = DayTime.NOT_SPECIFIED, completionAmount = 1),
    ActivityTemplate(key = "reviewNotes", category = ActivityTemplateCategory.STUDY, frequency = Frequency.DAILY, dayTime = DayTime.EVENING, completionAmount = 1),
    ActivityTemplate(key = "exercises5", category = ActivityTemplateCategory.STUDY, frequency = Frequency.DAILY, dayTime = DayTime.AFTERNOON, completionAmount = 1),

    // Good Habits
    ActivityTemplate(key = "makeBed", category = ActivityTemplateCategory.GOOD_HABITS, frequency = Frequency.DAILY, dayTime = DayTime.MORNING, completionAmount = 1),
    ActivityTemplate(key = "noPhoneMorning", category = ActivityTemplateCategory.GOOD_HABITS, frequency = Frequency.DAILY, dayTime = DayTime.MORNING, completionAmount = 1),
    ActivityTemplate(key = "journal5", category = ActivityTemplateCategory.GOOD_HABITS, frequency = Frequency.DAILY, dayTime = DayTime.EVENING, completionAmount = 1),
    ActivityTemplate(key = "meditate10", category = ActivityTemplateCategory.GOOD_HABITS, frequency = Frequency.DAILY, dayTime = DayTime.MORNING, completionAmount = 1),
    ActivityTemplate(key = "planTomorrow", category = ActivityTemplateCategory.GOOD_HABITS, frequency = Frequency.DAILY, dayTime = DayTime.EVENING, completionAmount = 1),
    ActivityTemplate(key = "tidyWorkspace", category = ActivityTemplateCategory.GOOD_HABITS, frequency = Frequency.DAILY, dayTime = DayTime.EVENING, completionAmount = 1),
    ActivityTemplate(key = "noSugar", category = ActivityTemplateCategory.GOOD_HABITS, frequency = Frequency.DAILY, dayTime = DayTime.NOT_SPECIFIED, completionAmount = 1),

    // Home Training
    ActivityTemplate(key = "pushups20", category = ActivityTemplateCategory.HOME_TRAINING, frequency = Frequency.DAILY, dayTime = DayTime.MORNING, completionAmount = 1),
    ActivityTemplate(key = "squats30", category = ActivityTemplateCategory.HOME_TRAINING, frequency = Frequency.DAILY, dayTime = DayTime.NOT_SPECIFIED, completionAmount = 1),
    ActivityTemplate(key = "plank1", category = ActivityTemplateCategory.HOME_TRAINING, frequency = Frequency.DAILY, dayTime = DayTime.NOT_SPECIFIED, completionAmount = 1),
    ActivityTemplate(key = "fullBody20", category = ActivityTemplateCategory.HOME_TRAINING, frequency = Frequency.WEEKLY, dayFrequency = listOf(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY), dayTime = DayTime.AFTERNOON, completionAmount = 1),
    ActivityTemplate(key = "run3k", category = ActivityTemplateCategory.HOME_TRAINING, frequency = Frequency.WEEKLY, dayFrequency = listOf(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY), dayTime = DayTime.MORNING, completionAmount = 1),
    ActivityTemplate(key = "abs10", category = ActivityTemplateCategory.HOME_TRAINING, frequency = Frequency.DAILY, dayTime = DayTime.EVENING, completionAmount = 1),

    // Home & Chores
    ActivityTemplate(key = "dishes", category = ActivityTemplateCategory.HOME, frequency = Frequency.DAILY, dayTime = DayTime.EVENING, completionAmount = 1),
    ActivityTemplate(key = "laundry", category = ActivityTemplateCategory.HOME, frequency = Frequency.WEEKLY, dayFrequency = listOf(DayOfWeek.SATURDAY), dayTime = DayTime.MORNING, completionAmount = 1),
    ActivityTemplate(key = "vacuum", category = ActivityTemplateCategory.HOME, frequency = Frequency.WEEKLY, dayFrequency = listOf(DayOfWeek.WEDNESDAY), dayTime = DayTime.NOT_SPECIFIED, completionAmount = 1),
    ActivityTemplate(key = "trash", category = ActivityTemplateCategory.HOME, frequency = Frequency.DAILY, dayTime = DayTime.EVENING, completionAmount = 1),
    ActivityTemplate(key = "groceries", category = ActivityTemplateCategory.HOME, frequency = Frequency.WEEKLY, dayFrequency = listOf(DayOfWeek.SATURDAY), dayTime = DayTime.MORNING, completionAmount = 1),
    ActivityTemplate(key = "waterPlants", category = ActivityTemplateCategory.HOME, frequency = Frequency.WEEKLY, dayFrequency = listOf(DayOfWeek.MONDAY, DayOfWeek.THURSDAY), dayTime = DayTime.MORNING, completionAmount = 1),

    // Productivity / Work
    ActivityTemplate(key = "deepWork90", category = ActivityTemplateCategory.PRODUCTIVITY, frequency = Frequency.WEEKLY, dayFrequency = listOf(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY), dayTime = DayTime.MORNING, completionAmount = 1),
    ActivityTemplate(key = "inboxZero", category = ActivityTemplateCategory.PRODUCTIVITY, frequency = Frequency.DAILY, dayTime = DayTime.AFTERNOON, completionAmount = 1),
    ActivityTemplate(key = "dailyPlan", category = ActivityTemplateCategory.PRODUCTIVITY, frequency = Frequency.DAILY, dayTime = DayTime.MORNING, completionAmount = 1),
    ActivityTemplate(key = "weeklyReview", category = ActivityTemplateCategory.PRODUCTIVITY, frequency = Frequency.WEEKLY, dayFrequency = listOf(DayOfWeek.FRIDAY), dayTime = DayTime.EVENING, completionAmount = 1),

    // Mind & Social
    ActivityTemplate(key = "callLoved", category = ActivityTemplateCategory.MIND_SOCIAL, frequency = Frequency.WEEKLY, dayFrequency = listOf(DayOfWeek.SATURDAY), dayTime = DayTime.EVENING, completionAmount = 1),
    ActivityTemplate(key = "gratitude3", category = ActivityTemplateCategory.MIND_SOCIAL, frequency = Frequency.DAILY, dayTime = DayTime.EVENING, completionAmount = 1),
    ActivityTemplate(key = "digitalDetox", category = ActivityTemplateCategory.MIND_SOCIAL, frequency = Frequency.WEEKLY, dayFrequency = listOf(DayOfWeek.SUNDAY), dayTime = DayTime.EVENING, completionAmount = 1),
    ActivityTemplate(key = "hobby30", category = ActivityTemplateCategory.MIND_SOCIAL, frequency = Frequency.DAILY, dayTime = DayTime.NOT_SPECIFIED, completionAmount = 1),
)
