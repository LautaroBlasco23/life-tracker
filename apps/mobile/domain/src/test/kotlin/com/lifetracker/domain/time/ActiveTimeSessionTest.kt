package com.lifetracker.domain.time

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Unit tests for the active-timer session model + `getElapsedSeconds` port
 * (the pure half of `use-active-sessions.ts`; the SharedPreferences store
 * needs an Android context and stays on the instrumented side).
 */
class ActiveTimeSessionTest {

    @Test
    fun `elapsedSeconds returns accumulated seconds while paused (startedAt null)`() {
        val session = ActiveTimeSession(
            id = "s1", category = "reading", description = "Dune",
            startedAt = null, accumulatedSeconds = 120,
        )
        assertEquals(120, elapsedSeconds(session, now = 1_000_000L))
    }

    @Test
    fun `elapsedSeconds adds the running seconds since start`() {
        val session = ActiveTimeSession(
            id = "s1", category = "gaming", description = "",
            startedAt = 1_000_000L, accumulatedSeconds = 30,
        )
        // 90_000 ms running -> +90s (epoch-ms division truncates like JS).
        assertEquals(120, elapsedSeconds(session, now = 1_090_000L))
    }

    @Test
    fun `elapsedSeconds clamps to 0 when the clock skews backwards`() {
        val session = ActiveTimeSession(
            id = "s1", category = "gaming", description = "",
            startedAt = 2_000_000L, accumulatedSeconds = 10,
        )
        assertEquals(10, elapsedSeconds(session, now = 1_000_000L))
    }

    @Test
    fun `serialization round-trips the RN localStorage payload shape`() {
        val session = ActiveTimeSession(
            id = "s1", category = "exercise", description = "run",
            startedAt = 1_000_000L, accumulatedSeconds = 60,
        )
        val json = Json { ignoreUnknownKeys = true }
        val decoded = json.decodeFromString<ActiveTimeSession>(json.encodeToString(session))
        assertEquals(session, decoded)
    }

    @Test
    fun `serialization tolerates the optional fields being absent`() {
        val json = Json { ignoreUnknownKeys = true }
        val decoded = json.decodeFromString<ActiveTimeSession>(
            """{"id":"s1","category":"other","description":"x"}""",
        )
        assertEquals(null, decoded.startedAt)
        assertEquals(0, decoded.accumulatedSeconds)
    }
}
