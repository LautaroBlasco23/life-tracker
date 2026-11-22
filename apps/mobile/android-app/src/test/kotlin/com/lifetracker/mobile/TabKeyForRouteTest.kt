package com.lifetracker.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TabKeyForRouteTest {

    @Test
    fun `main tabs map to themselves`() {
        assertEquals(Routes.ACTIVITIES, tabKeyForRoute(Routes.ACTIVITIES))
        assertEquals(Routes.TIME, tabKeyForRoute(Routes.TIME))
        assertEquals(Routes.NOTES, tabKeyForRoute(Routes.NOTES))
        assertEquals(Routes.SOCIAL, tabKeyForRoute(Routes.SOCIAL))
    }

    @Test
    fun `finance routes map to the finance tab`() {
        assertEquals(Routes.FINANCE_TRANSACTIONS, tabKeyForRoute(Routes.FINANCE_TRANSACTIONS))
        assertEquals(Routes.FINANCE_TRANSACTIONS, tabKeyForRoute(Routes.FINANCE_DASHBOARD))
    }

    @Test
    fun `profile shows the bar with no tab highlighted`() {
        assertEquals(Routes.PROFILE, tabKeyForRoute(Routes.PROFILE))
    }

    @Test
    fun `modal and auth routes hide the bar`() {
        assertNull(tabKeyForRoute(null))
        assertNull(tabKeyForRoute(Routes.LOGIN))
        assertNull(tabKeyForRoute(Routes.REGISTER))
        assertNull(tabKeyForRoute(Routes.BACKUP))
        assertNull(tabKeyForRoute(Routes.PUBLIC_PROFILE))
    }
}
