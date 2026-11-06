package com.lifetracker.core.storage

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private const val PREFS_NAME = "lifetracker_secure"
private val Context.dataStore: DataStore<Preferences> by preferencesDataStore("settings")

/** This URL corresponds to the default Application production API. */
const val DEFAULT_API_URL = "https://api.example.com/api"

/**
 * Everything persisted on-device for the app:
 * - tokens + current user: EncryptedSharedPreferences (Android Keystore) — sync for OkHttp
 * - app settings (apiUrl override, language, theme): DataStore
 * Ports the split expo-sqlite-kv / expo-secure-store roles of `lib/storage-init.ts`.
 */
@Singleton
class SecureStore @Inject constructor(@ApplicationContext context: Context) : TokenProvider, SessionStore {

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = false }

    private val prefs = EncryptedSharedPreferences.create(
        context,
        PREFS_NAME,
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    // ---- TokenProvider (sync, OkHttp thread-safe) ----
    override fun accessToken(): String? = prefs.getString(KEY_ACCESS, null)

    override fun refreshToken(): String? = prefs.getString(KEY_REFRESH, null)

    override fun storeTokens(accessToken: String, refreshToken: String) {
        prefs.edit().putString(KEY_ACCESS, accessToken).putString(KEY_REFRESH, refreshToken).apply()
    }

    override fun clearTokens() = prefs.edit().remove(KEY_ACCESS).remove(KEY_REFRESH).apply()

    // ---- SessionStore (sync + write-through) ----
    override fun currentUser(): SessionUser? = prefs.getString(KEY_USER, null)?.let {
        runCatching { json.decodeFromString<SessionUser>(it) }.getOrNull()
    }

    override fun setCurrentUser(user: SessionUser?) {
        prefs.edit().putString(KEY_USER, user?.let(json::encodeToString)).apply()
    }

    companion object {
        private const val KEY_ACCESS = "accessToken"
        private const val KEY_REFRESH = "refreshToken"
        private const val KEY_USER = "currentUser"
    }
}

/**
 * App settings on the plaintext side. `apiUrl` mirrors the Profile override in
 * the RN app (https-only validated at the call site; empty => build-time default).
 */
@Singleton
class SettingsRepository @Inject constructor(@ApplicationContext private val context: Context) {

    val apiUrl: Flow<String> = context.dataStore.data.map { it[KEY_API_URL] ?: "" }
    val language: Flow<String> = context.dataStore.data.map { it[KEY_LANGUAGE] ?: "en" }
    val theme: Flow<String> = context.dataStore.data.map { it[KEY_THEME] ?: "system" }

    suspend fun setApiUrl(url: String) { context.dataStore.edit { it[KEY_API_URL] = url } }
    suspend fun setLanguage(code: String) { context.dataStore.edit { it[KEY_LANGUAGE] = code } }
    suspend fun setTheme(value: String) { context.dataStore.edit { it[KEY_THEME] = value } }

    /** Blocking read for OkHttp module use (router thread); "" means "no override". */
    fun currentApiUrlBlocking(): String = blocking { it[KEY_API_URL] ?: "" }

    fun currentLanguageBlocking(): String = blocking { it[KEY_LANGUAGE] ?: "en" }

    fun currentThemeBlocking(): String = blocking { it[KEY_THEME] ?: "system" }

    private inline fun <T> blocking(crossinline selector: (Preferences) -> T): T =
        kotlinx.coroutines.runBlocking {
            context.dataStore.data.map { p -> selector(p) }.firstOrNull()!!
        }

    companion object {
        private val KEY_API_URL = stringPreferencesKey("apiUrl")
        private val KEY_LANGUAGE = stringPreferencesKey("language")
        private val KEY_THEME = stringPreferencesKey("theme")
    }
}
