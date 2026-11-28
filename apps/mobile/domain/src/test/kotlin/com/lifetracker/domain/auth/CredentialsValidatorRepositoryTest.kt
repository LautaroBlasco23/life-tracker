package com.lifetracker.domain.auth

import com.lifetracker.core.network.endpoints.UsersApi
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.After
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/**
 * MockWebServer coverage of the register-screen availability probes: the
 * available/taken mapping and the swallow-to-Unknown error behavior (RN
 * parity — failures clear the status instead of surfacing an error).
 */
class CredentialsValidatorRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var repo: CredentialsValidatorRepository

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        val json = Json { ignoreUnknownKeys = true; explicitNulls = false; coerceInputValues = true }
        val api = Retrofit.Builder()
            .baseUrl(server.url("/api/"))
            .client(OkHttpClient())
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(UsersApi::class.java)
        repo = CredentialsValidatorRepository(api)
    }

    @After
    fun tearDown() {
        server.close()
    }

    @Test
    fun `checkUsername maps available=true to Available`() = runTest {
        server.enqueue(MockResponse(body = """{"available":true,"username":"lauti"}"""))
        assertEquals(Availability.Available, repo.checkUsername("lauti"))
        val recorded = server.takeRequest()
        assertEquals("/api/users/check-username", recorded.url.encodedPath)
        assertEquals("lauti", recorded.url.queryParameter("username"))
    }

    @Test
    fun `checkUsername maps available=false to Taken`() = runTest {
        server.enqueue(MockResponse(body = """{"available":false}"""))
        assertEquals(Availability.Taken, repo.checkUsername("taken"))
    }

    @Test
    fun `checkEmail maps the same way`() = runTest {
        server.enqueue(MockResponse(body = """{"available":true,"email":"l@example.com"}"""))
        assertEquals(Availability.Available, repo.checkEmail("l@example.com"))
        val recorded = server.takeRequest()
        assertEquals("/api/users/check-email", recorded.url.encodedPath)
        assertEquals("l@example.com", recorded.url.queryParameter("email"))
    }

    @Test
    fun `http failures swallow to Unknown (RN catch parity)`() = runTest {
        server.enqueue(MockResponse(code = 429, body = """{"error":"Too many requests"}"""))
        assertEquals(Availability.Unknown, repo.checkUsername("lauti"))
    }

    @Test
    fun `network failures swallow to Unknown`() = runTest {
        // Nothing enqueued: the connection fails mid-call.
        val result = runCatching { repo.checkUsername("lauti") }
        // The repo swallows; both the Result and the mapped status are Unknown.
        assertTrue(result.isFailure || result.getOrNull() == Availability.Unknown)
        assertEquals(Availability.Unknown, repo.checkEmail("l@example.com"))
    }
}
