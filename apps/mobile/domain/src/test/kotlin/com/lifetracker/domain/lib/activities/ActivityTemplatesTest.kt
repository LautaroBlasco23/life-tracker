package com.lifetracker.domain.lib.activities

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for the activity/routine template catalog. The catalog drives
 * the templates modal and the wire payloads the API expects, so the tests
 * pin the invariants the shared contract relies on (api-contract.md §12).
 */
class ActivityTemplatesTest {

    @Test
    fun `every wire enum raw value is exactly lowercase or camelCase per contract`() {
        Frequency.entries.forEach { assertEquals(it.name.lowercase(), it.raw) }
        DayTime.entries.forEach {
            val expected = if (it == DayTime.NOT_SPECIFIED) "notSpecified" else it.name.lowercase()
            assertEquals(expected, it.raw)
        }
        // `notSpecified` is intentionally camelCase, not `not_specified`.
        assertEquals("notSpecified", DayTime.NOT_SPECIFIED.raw)
        DayOfWeek.entries.forEach { assertEquals(it.name.lowercase(), it.raw) }
        // goodHabits / homeTraining / mindSocial are intentionally camelCase.
        val activityCategoryRaws = mapOf(
            "health" to ActivityTemplateCategory.HEALTH,
            "study" to ActivityTemplateCategory.STUDY,
            "goodHabits" to ActivityTemplateCategory.GOOD_HABITS,
            "homeTraining" to ActivityTemplateCategory.HOME_TRAINING,
            "home" to ActivityTemplateCategory.HOME,
            "productivity" to ActivityTemplateCategory.PRODUCTIVITY,
            "mindSocial" to ActivityTemplateCategory.MIND_SOCIAL,
        )
        activityCategoryRaws.forEach { (raw, category) -> assertEquals(raw, category.raw) }
        assertEquals(activityCategoryRaws.size, ActivityTemplateCategory.entries.size)
        val routineCategoryRaws = mapOf(
            "home" to RoutineTemplateCategory.HOME,
            "homeTraining" to RoutineTemplateCategory.HOME_TRAINING,
        )
        routineCategoryRaws.forEach { (raw, category) -> assertEquals(raw, category.raw) }
        assertEquals(routineCategoryRaws.size, RoutineTemplateCategory.entries.size)
    }

    @Test
    fun `template keys are unique so i18n lookups stay unambiguous`() {
        val keys = ACTIVITY_TEMPLATES.map { it.key }
        assertEquals(keys.size, keys.toSet().size)
    }

    @Test
    fun `daily templates never carry a dayFrequency - weekly ones always do`() {
        ACTIVITY_TEMPLATES.forEach { template ->
            if (template.frequency == Frequency.DAILY) {
                assertNull("daily template ${template.key} must not carry dayFrequency", template.dayFrequency)
            } else {
                assertTrue(
                    "template ${template.key} (${template.frequency}) must list days",
                    !template.dayFrequency.isNullOrEmpty(),
                )
            }
        }
    }

    @Test
    fun `every template has a positive completion amount`() {
        ACTIVITY_TEMPLATES.forEach { template ->
            assertTrue("template ${template.key}", template.completionAmount >= 1)
        }
    }

    @Test
    fun `every catalog category owns at least one template`() {
        ACTIVITY_TEMPLATE_CATEGORIES.forEach { category ->
            assertTrue(
                "no template for category ${category.raw}",
                ACTIVITY_TEMPLATES.any { it.category == category },
            )
        }
    }

    @Test
    fun `every routine template references existing activity template keys`() {
        ROUTINE_TEMPLATES.forEach { routine ->
            assertTrue("routine ${routine.key} is empty", routine.activities.isNotEmpty())
            routine.activities.forEach { key ->
                assertTrue(
                    "routine ${routine.key} references unknown activity '$key'",
                    ACTIVITY_TEMPLATES.any { it.key == key },
                )
            }
        }
    }

    @Test
    fun `TEMPLATE_CATEGORIES_BY_KIND covers both modal dropdowns`() {
        assertEquals(ACTIVITY_TEMPLATE_CATEGORIES.map { it.raw }, TEMPLATE_CATEGORIES_BY_KIND[TemplateKind.ACTIVITY])
        assertEquals(RoutineTemplateCategory.entries.map { it.raw }, TEMPLATE_CATEGORIES_BY_KIND[TemplateKind.ROUTINE])
    }
}
