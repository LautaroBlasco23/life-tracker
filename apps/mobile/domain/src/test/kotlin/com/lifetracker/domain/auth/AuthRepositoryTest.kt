package com.lifetracker.domain.auth

import com.lifetracker.core.network.SessionEvents
import com.lifetracker.core.network.TokenRefresher
import com.lifetracker.core.storage.SessionStore
import com.lifetracker.core.storage.SessionUser
import com.lifetracker.core.storage.TokenProvider
import com.lifetracker.core.network.endpoints.AuthApi
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.After
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.json.Json

/**
 * MockWebServer verification of the Phase 2 auth core (the gate deferred from
 * Phase 2 because no emulator was available): refresh-on-401 semantics, token
 * persistence and error-envelope parsing.
 */
class AuthRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var api: AuthApi
    private lateinit var tokens: FakeTokens
    private lateinit var sessions: FakeSessions
    private lateinit var repo: AuthRepository

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

    class FakeSessions : SessionStore {
        var user: SessionUser? = null
        override fun currentUser(): SessionUser? = user
        override fun setCurrentUser(user: SessionUser?) { this.user = user }
    }

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        val json = Json { ignoreUnknownKeys = true; explicitNulls = false; coerceInputValues = true }
        val retrofit = Retrofit.Builder()
            .baseUrl(server.url("/api/"))
            .client(OkHttpClient())
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
        api = retrofit.create(AuthApi::class.java)
        // Bootstrap retrofit shares the same client here (tests hit refresh directly).
        tokens = FakeTokens()
        sessions = FakeSessions()
        repo = AuthRepository(api, api, tokens, sessions)
    }

    @After
    fun tearDown() {
        server.close()
    }

    private fun enqueueLogin(ok: Boolean = true, degraded: Boolean = false) {
        val body = if (degraded) {
            """{"message":"ok","data":{"accessToken":"ACC_NEW","refreshToken":"REF_NEW","tokenType":"Bearer","expiresIn":900}}"""
        } else {
            """{"message":"ok","data":{"tokens":{"accessToken":"ACC_NEW","refreshToken":"REF_NEW","tokenType":"Bearer","expiresIn":900},"user":{"id":7,"username":"lauti","firstName":"Lua","lastName":"Tú","email":"l@example.com","createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"}}}"""
        }
        server.enqueue(
            if (ok) MockResponse(body = body) else MockResponse(code = 401, body = """{"error":"Invalid credentials"}"""),
        )
    }

    @Test
    fun `login persists tokens and user`() = kotlinx.coroutines.test.runTest {
        enqueueLogin()
        val result = repo.login(identifier = "lauti", password = "pw")
        assertTrue(result.isSuccess)
        assertEquals("ACC_NEW", tokens.access)
        assertEquals("REF_NEW", tokens.refresh)
        assertEquals(7L, sessions.user?.id)
        assertEquals("lauti", sessions.user?.username)
        assertEquals(true, repo.isAuthenticated)
    }

    @Test
    fun `login failure surfaces the backend error message`() = kotlinx.coroutines.test.runTest {
        enqueueLogin(ok = false)
        val result = repo.login(identifier = "lauti", password = "bad")
        assertFalse(result.isSuccess)
        assertEquals("Invalid credentials", (result.exceptionOrNull() as? ApiError)?.message)
        assertNull(tokens.access)
    }

    @Test
    fun `refreshBlocking swaps tokens on 200`() {
        tokens.storeTokens("ACC_OLD", "REF_OLD")
        server.enqueue(
            MockResponse(body = """{"message":"ok","data":{"accessToken":"ACC_NEW","refreshToken":"REF_NEW","tokenType":"Bearer","expiresIn":900}}"""),
        )
        assertTrue(repo.refreshBlocking("REF_OLD"))
        assertEquals("ACC_NEW", tokens.access)
        assertEquals("REF_NEW", tokens.refresh)
        assertEquals("/api/auth/refresh", server.takeRequest().target)
    }

    @Test
    fun `refreshBlocking refuses wrong refresh token`() {
        tokens.storeTokens("ACC_OLD", "REF_OLD")
        server.enqueue(
            MockResponse(code = 401, body = """{"error":"Invalid refresh token"}"""),
        )
        assertFalse(repo.refreshBlocking("REF_OLD"))
        // 401 refresh failure is not the refresher's force-logout (that lives
        // in the OkHttp authenticator) — local tokens survive untouched here.
        assertEquals("ACC_OLD", tokens.access)
    }

    @Test
    fun `logout clears local state and calls the server best-effort`() = kotlinx.coroutines.test.runTest {
        tokens.storeTokens("ACC", "REF")
        sessions.user = SessionUser(1, "lauti", "Lua", "Tú", "l@example.com")
        server.enqueue(MockResponse(body = """{"message":"Logged out"}"""))
        repo.logout()
        assertNull(tokens.access)
        assertNull(sessions.user)
        assertEquals("/api/auth/logout", server.takeRequest().target)
    }

    @Test
    fun `logout works even when the server is unreachable`() = kotlinx.coroutines.test.runTest {
        tokens.storeTokens("ACC", "REF")
        sessions.user = SessionUser(1, "lauti", "Lua", "Tú", "l@example.com")
        repo.logout()
        assertNull(tokens.access)
        assertNull(sessions.user)
    }

    @Test
    fun `degraded auth payload (no user) is a failure, not a partial session`() = kotlinx.coroutines.test.runTest {
        enqueueLogin(degraded = true)
        val result = repo.login(identifier = "lauti", password = "pw")
        assertFalse(result.isSuccess)
        assertNull(sessions.user)
    }
}
