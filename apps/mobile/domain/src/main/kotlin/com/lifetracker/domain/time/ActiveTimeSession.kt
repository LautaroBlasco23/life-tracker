package com.lifetracker.domain.time

import kotlinx.serialization.Serializable

/**
 * One running/paused timer session — port of RN `hooks/use-active-sessions.ts`
 * (`ActiveTimeSession`). Serialization mirrors the localStorage payload:
 * `{ id, category, description, startedAt (epoch ms | null), accumulatedSeconds }`.
 */
@Serializable
data class ActiveTimeSession(
    val id: String,
    val category: String,
    val description: String,
    /** Epoch ms while running, null while paused. */
    val startedAt: Long? = null,
    /** Seconds frozen while paused. */
    val accumulatedSeconds: Int = 0,
)

/**
 * RN `getElapsedSeconds(session, now)`: accumulated seconds plus the running
 * seconds since `startedAt` (0 while paused). Epoch-ms division by 1000
 * truncates toward zero like JS (`Math.floor` of a non-negative value).
 */
fun elapsedSeconds(session: ActiveTimeSession, now: Long): Int {
    val startedAt = session.startedAt ?: return session.accumulatedSeconds
    val runningSeconds = ((now - startedAt) / 1000L).coerceAtLeast(0L)
    return session.accumulatedSeconds + runningSeconds.toInt()
}
