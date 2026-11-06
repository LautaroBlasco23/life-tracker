package com.lifetracker.core.network

import com.lifetracker.core.storage.TokenProvider
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route

/**
 * Ports the auth-service refresh-on-401 flow:
 * - only refresh when the failing request carried the CURRENT access token
 *   (otherwise another thread already refreshed — just retry with the new one)
 * - single in-flight refresh (mutex), port of the RN write-through refresh
 * - on refresh failure: clear tokens and emit force-logout
 * - a 401 on a request WITHOUT Authorization (e.g. failed login) is NOT a
 *   session problem: pass it through untouched.
 */
class SessionAuthenticator(
    private val tokens: TokenProvider,
    private val refresher: TokenRefresher,
    private val onSessionInvalid: () -> Unit,
) : Authenticator {

    override fun authenticate(route: Route?, response: Response): Request? {
        if (response.request.header("Authorization") == null) return null
        if (chainCount(response) >= 2) {
            // Second consecutive 401 for the same chain: give up (RN parity).
            invalidateSession()
            return null
        }
        val fresh = synchronized(lock) { refreshWithMutex(endpointBearer(response)) }
            ?: return null
        return response.request.newBuilder()
            .header("Authorization", "Bearer $fresh")
            .build()
    }

    private fun chainCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }

    /** The token the failing request carried; null = anonymous request. */
    private fun endpointBearer(response: Response): String? =
        response.request.header("Authorization")?.removePrefix("Bearer ")

    /**
     * Single-flight refresh: re-reads the token store first so simultaneous
     * 401s collapse into one network refresh (current != failed means another
     * thread already refreshed — reuse its token).
     */
    private fun refreshWithMutex(failedToken: String?): String? {
        val current = tokens.accessToken()
        if (current != null && current != failedToken) return current
        val startRefresh = tokens.refreshToken()
        if (startRefresh == null || !refresher.refreshBlocking(startRefresh)) {
            invalidateSession()
            return null
        }
        return tokens.accessToken()
    }

    private fun invalidateSession() {
        tokens.clearTokens()
        onSessionInvalid()
    }

    private companion object {
        val lock = Any()
    }
}

/** Implemented by domain AuthRepository (owns the bootstrap AuthApi). */
fun interface TokenRefresher {
    /** Returns true when tokens were swapped successfully. */
    fun refreshBlocking(refreshToken: String): Boolean
}
