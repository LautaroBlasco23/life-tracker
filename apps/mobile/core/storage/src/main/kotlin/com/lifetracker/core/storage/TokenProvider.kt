package com.lifetracker.core.storage

/**
 * Blocking token store contract consumed by OkHttp (`Interceptor` /
 * `Authenticator` run on IO threads and cannot suspend). Encrypted persistence
 * lives in the implementation (Android Keystore, port of expo-secure-store).
 */
interface TokenProvider {
    fun accessToken(): String?
    fun refreshToken(): String?
    /** Persisted after a successful refresh or full login (both tokens rotate). */
    fun storeTokens(accessToken: String, refreshToken: String)
    fun clearTokens()
}

/** Sync cache of the current session user (write-through + encrypted persistence). */
interface SessionStore {
    fun currentUser(): SessionUser?
    fun setCurrentUser(user: SessionUser?)
}
