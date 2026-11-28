package com.lifetracker.domain.reminders

import com.lifetracker.core.network.endpoints.RemindersApi
import com.lifetracker.core.network.model.CreateReminderRequest
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
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * MockWebServer coverage of the reminders surface: CRUD null-tolerance and
 * the complete/revert-completion pair the Activities screen drives
 * optimistically.
 */
class RemindersRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var repo: RemindersRepository

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
            .create(RemindersApi::class.java)
        repo = RemindersRepository(api)
    }

    @After
    fun tearDown() {
        server.close()
    }

    private val reminderJson =
        """{"id":3,"userId":7,"title":"Vitamins","description":"","dueAt":"2026-09-30T03:00:00.000Z",""" +
            """"privacyStatus":"private","createdAt":"2025-01-01T00:00:00.000Z",""" +
            """"updatedAt":"2025-01-01T00:00:00.000Z"}"""

    @Test
    fun `list parses the reminders and is null-tolerant`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":[$reminderJson]}"""))
        val result = repo.list()
        assertEquals(1, result.getOrThrow().size)
        assertEquals("Vitamins", result.getOrThrow()[0].title)
        assertEquals("/api/reminders", server.takeRequest().target)
    }

    @Test
    fun `get surfaces an ApiError when the payload is missing`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok"}"""))
        val result = repo.get(3)
        assertTrue(result.isFailure)
        assertEquals("Reminder payload was missing", (result.exceptionOrNull() as? ApiError)?.message)
    }

    @Test
    fun `create posts title-description-dueAt`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":$reminderJson}"""))
        val result = repo.create(
            CreateReminderRequest(
                title = "Vitamins",
                description = "",
                dueAt = "2026-09-30T03:00:00.000Z",
            ),
        )
        assertTrue(result.isSuccess)
        val recorded = server.takeRequest()
        assertEquals("POST", recorded.method)
        assertEquals("/api/reminders", recorded.target)
        val body = Json.parseToJsonElement(recorded.body?.utf8()!!).jsonObject
        assertEquals("2026-09-30T03:00:00.000Z", body["dueAt"]?.jsonPrimitive?.content)
    }

    @Test
    fun `complete POSTs and parses the fresh payload`() = runTest {
        server.enqueue(
            MockResponse(
                body = """{"message":"ok","data":{"id":3,"userId":7,"title":"Vitamins","description":"",""" +
                    """"dueAt":"2026-09-30T03:00:00.000Z","completedAt":"2026-09-30T12:00:00.000Z",""" +
                    """"privacyStatus":"private","createdAt":"2025-01-01T00:00:00.000Z",""" +
                    """"updatedAt":"2026-09-30T12:00:00.000Z"}}""",
            ),
        )
        val result = repo.complete(3)
        assertTrue(result.isSuccess)
        assertEquals("2026-09-30T12:00:00.000Z", result.getOrThrow().completedAt)
        val recorded = server.takeRequest()
        assertEquals("POST", recorded.method)
        assertEquals("/api/reminders/3/complete", recorded.target)
    }

    @Test
    fun `revertCompletion DELETEs the complete endpoint`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok"}"""))
        assertTrue(repo.revertCompletion(3).isSuccess)
        val recorded = server.takeRequest()
        assertEquals("DELETE", recorded.method)
        assertEquals("/api/reminders/3/complete", recorded.target)
    }

    @Test
    fun `delete issues DELETE to the reminder id`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"Reminder deleted"}"""))
        assertTrue(repo.delete(3).isSuccess)
        assertEquals("/api/reminders/3", server.takeRequest().target)
    }
}
