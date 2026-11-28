package com.lifetracker.domain.social

import com.lifetracker.core.network.endpoints.FollowsApi
import com.lifetracker.core.network.model.FollowStatus
import com.lifetracker.domain.auth.ApiError
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
 * MockWebServer coverage of the follow surface: the pending/accepted flow,
 * incoming requests and the accept/reject pair.
 */
class FollowsRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var repo: FollowsRepository

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
            .create(FollowsApi::class.java)
        repo = FollowsRepository(api)
    }

    @After
    fun tearDown() {
        server.close()
    }

    @Test
    fun `follow parses the resulting status`() = runTest {
        server.enqueue(MockResponse(body = """{"data":{"status":"pending"}}"""))
        val result = repo.follow("pepe")
        assertTrue(result.isSuccess)
        assertEquals(FollowStatus.PENDING, result.getOrThrow())
        assertEquals("/api/follows/pepe", server.takeRequest().target)
    }

    @Test
    fun `follow surfaces an ApiError when the status payload is missing`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok"}"""))
        val result = repo.follow("pepe")
        assertTrue(result.isFailure)
        assertEquals("Follow status payload was missing", (result.exceptionOrNull() as? ApiError)?.message)
    }

    @Test
    fun `unfollow issues DELETE and succeeds silently on the message envelope`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok"}"""))
        val result = repo.unfollow("pepe")
        assertTrue(result.isSuccess)
        val recorded = server.takeRequest()
        assertEquals("DELETE", recorded.method)
        assertEquals("/api/follows/pepe", recorded.target)
    }

    @Test
    fun `pendingRequests is null-tolerant - data null becomes an empty list`() = runTest {
        server.enqueue(MockResponse(body = """{"data":null}"""))
        val result = repo.pendingRequests()
        assertTrue(result.isSuccess)
        assertEquals(0, result.getOrThrow().size)
    }

    @Test
    fun `pendingRequests parses the incoming follow requests`() = runTest {
        server.enqueue(
            MockResponse(
                body = """{"data":[{"userId":2,"username":"pepe","firstName":"Pe","lastName":"Pe"}]}""",
            ),
        )
        val result = repo.pendingRequests()
        assertEquals(1, result.getOrThrow().size)
        assertEquals("pepe", result.getOrThrow()[0].username)
    }

    @Test
    fun `accept and reject POST to the follower id`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok"}"""))
        server.enqueue(MockResponse(body = """{"message":"ok"}"""))
        assertTrue(repo.acceptFollow(2).isSuccess)
        assertTrue(repo.rejectFollow(2).isSuccess)
        assertEquals("POST", server.takeRequest().method)
        val reject = server.takeRequest()
        assertEquals("POST", reject.method)
        assertEquals("/api/follows/pending/2/reject", reject.target)
    }
}
