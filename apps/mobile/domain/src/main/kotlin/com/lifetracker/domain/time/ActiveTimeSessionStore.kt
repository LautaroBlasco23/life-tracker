package com.lifetracker.domain.time

import android.content.Context
import android.content.SharedPreferences
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Persistence for the active time sessions — port of the RN
 * `hooks/use-active-sessions.ts` round-trip on the shared `storage` adapter
 * under the key `time_active_sessions` (sessions restore with elapsed time
 * preserved after kill + reopen, per the QA checklist).
 *
 * Deviation: `SettingsRepository`/`SessionStore` cover the existing
 * preference domains (api-url/language/theme, tokens/user); adding a new
 * DataStore key is out of scope for this module (see agent constraints), and
 * the RN payload is a plain (non-secret) KV JSON blob — and iOS localStorage
 * is likewise unencrypted — so a fit-for-purpose `SharedPreferences` bucket
 * in `domain/time` mirrors the semantics without touching `core/storage`.
 */
@Singleton
class ActiveTimeSessionStore @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val prefs: SharedPreferences = context.getSharedPreferences(
        PREFS_NAME, Context.MODE_PRIVATE,
    )
    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Load the persisted sessions; corrupt payloads drop the whole list and
     * clear the key, exactly like the RN `loadSessions()` catch path.
     */
    fun load(): List<ActiveTimeSession> {
        val raw = prefs.getString(STORAGE_KEY, null) ?: return emptyList()
        val parsed = runCatching { json.decodeFromString<List<ActiveTimeSession>>(raw) }
        if (parsed.isFailure) {
            prefs.edit().remove(STORAGE_KEY).apply()
            return emptyList()
        }
        return parsed.getOrDefault(emptyList())
    }

    /** Write-through: saves every session mutation like the RN effect. */
    fun save(sessions: List<ActiveTimeSession>) {
        prefs.edit()
            .putString(STORAGE_KEY, if (sessions.isEmpty()) null else json.encodeToString(sessions))
            .apply()
    }

    private companion object {
        private const val PREFS_NAME = "lifetracker_runtime"

        /** Same key as the RN app's `SESSIONS_STORAGE_KEY`. */
        private const val STORAGE_KEY = "time_active_sessions"
    }
}
