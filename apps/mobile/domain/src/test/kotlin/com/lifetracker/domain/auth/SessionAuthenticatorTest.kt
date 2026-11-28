package com.lifetracker.domain.auth

import com.lifetracker.core.network.SessionAuthenticator
import com.lifetracker.core.network.TokenRefresher
import com.lifetracker.core.storage.TokenProvider
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit verification of the refresh-on-401 authenticator semantics (the OkHttp
 * half of the auth core): single-flight refresh via the token store, retry
 * header swap, force-logout on refresh failure and the anonymous-401 passthrough.
 * Built on hand-rolled Responses so no server is needed.
 */
class SessionAuthenticatorTest {

    class FakeTokens : TokenProvider {
        var access: String? = null
        var refresh: String? = null
        override fun accessToken(): String? = access
        override fun refreshToken(): String? = refresh
        override fun storeTokens(accessToken: String, refreshToken: String) {
            access = accessToken; refresh = refreshToken
        }
        override fun clearTokens() { access = null; refresh = null }
    }

    class FakeRefresher(
        private val tokens: FakeTokens,
        var success: Boolean = true,
    ) : TokenRefresher {
        var calls: MutableList<String> = mutableListOf()
        override fun refreshBlocking(refreshToken: String): Boolean {
            calls.add(refreshToken)
            if (!success) return false
            // AuthRepository writes the swapped tokens into the same store.
            tokens.storeTokens("ACC_NEW", "REF_NEW")
            return true
        }
    }

    private lateinit var tokens: FakeTokens
    private lateinit var refresher: FakeRefresher
    private var forcedLogouts: Int = 0

    private fun build() = SessionAuthenticator(
        tokens = tokens,
        refresher = { refresher },
        onSessionInvalid = { forcedLogouts++ },
    )

    private fun failingResponse(authorization: String?, prior: Response? = null): Response {
        val builder = Request.Builder().url("https://api.example.com/api/time-records")
        if (authorization != null) builder.header("Authorization", authorization)
        val request = builder.build()
        val response = Response.Builder()
            .request(request)
            .protocol(Protocol.HTTP_1_1)
            .code(401)
            .message("Unauthorized")
            .build()
        return if (prior != null) response.newBuilder().priorResponse(prior).build() else response
    }

    private fun setUp(access: String = "ACC_OLD", refresh: String? = "REF_OLD") {
        tokens = FakeTokens().apply { this.access = access; this.refresh = refresh }
        refresher = FakeRefresher(tokens)
        forcedLogouts = 0
    }

    @Test
    fun `401 on an anonymous request is passed through untouched`() {
        setUp(access = "ACC_OLD", refresh = null)
        tokens.access = null // a failed login carries no Authorization header
        val result = build().authenticate(null, failingResponse(authorization = null))
        assertNull(result)
        assertTrue(refresher.calls.isEmpty())
        assertEquals(0, forcedLogouts)
    }

    @Test
    fun `refresh success swaps the retry header to the fresh token`() {
        setUp()
        val result = build().authenticate(null, failingResponse("Bearer ACC_OLD"))
        assertEquals("Bearer ACC_NEW", result?.header("Authorization"))
        // The refresher received the refresh token the failing chain carried.
        assertEquals(listOf("REF_OLD"), refresher.calls)
        assertEquals(0, forcedLogouts)
    }

    @Test
    fun `refresh failure clears tokens and fires the force-logout event`() {
        setUp()
        refresher.success = false
        val result = build().authenticate(null, failingResponse("Bearer ACC_OLD"))
        assertNull(result)
        assertNull(tokens.access)
        assertEquals(1, forcedLogouts)
    }

    @Test
    fun `a 401 carrying a stale token reuses the current token without another refresh`() {
        setUp(access = "ACC_NEW")
        // Another thread already refreshed: current != failedToken.
        val result = build().authenticate(null, failingResponse("Bearer ACC_OLD"))
        assertEquals("Bearer ACC_NEW", result?.header("Authorization"))
        assertTrue(refresher.calls.isEmpty())
        assertEquals(0, forcedLogouts)
    }

    @Test
    fun `a second consecutive 401 gives up and invalidates the session`() {
        setUp()
        // priorResponse chain of length 2 = the retry already failed once.
        val result = build().authenticate(
            null,
            failingResponse("Bearer ACC_NEW", prior = failingResponse("Bearer ACC_OLD")),
        )
        assertNull(result)
        assertNull(tokens.access)
        assertEquals(1, forcedLogouts)
        assertTrue(refresher.calls.isEmpty())
    }

    @Test
    fun `missing refresh token invalidates the session without a network refresh`() {
        setUp(refresh = null)
        val result = build().authenticate(null, failingResponse("Bearer ACC_OLD"))
        assertNull(result)
        assertNull(tokens.access)
        assertEquals(1, forcedLogouts)
        assertFalse(tokens.access != null && refresher.calls.isNotEmpty())
    }
}
