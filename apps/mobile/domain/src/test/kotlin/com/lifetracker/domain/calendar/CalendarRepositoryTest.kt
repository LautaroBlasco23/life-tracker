package com.lifetracker.domain.calendar

import com.lifetracker.core.network.endpoints.CalendarEventsApi
import com.lifetracker.core.network.model.CreateCalendarEventRequest
import com.lifetracker.core.network.model.EventScope
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
 * MockWebServer coverage of the calendar repository: range-filtered reads and
 * the update/delete scope asymmetry (body vs query parameter).
 */
class CalendarRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var repo: CalendarRepository

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
            .create(CalendarEventsApi::class.java)
        repo = CalendarRepository(api)
    }

    @After
    fun tearDown() {
        server.close()
    }

    private val eventJson =
        """{"id":9,"title":"Standup","description":"","category":"work",""" +
            """"startAt":"2026-09-30T10:00:00.000Z","endAt":"2026-09-30T10:15:00.000Z",""" +
            """"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"}"""

    @Test
    fun `getEvents sends both range bounds and parses the list`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":[$eventJson]}"""))
        val events = repo.getEvents(from = "2026-09-01T00:00:00.000Z", to = "2026-10-01T00:00:00.000Z")
        assertEquals(1, events.size)
        assertEquals("Standup", events[0].title)
        val recorded = server.takeRequest()
        assertEquals("/api/calendar-events", recorded.url.encodedPath)
        assertEquals("2026-09-01T00:00:00.000Z", recorded.url.queryParameter("from"))
        assertEquals("2026-10-01T00:00:00.000Z", recorded.url.queryParameter("to"))
    }

    @Test
    fun `getEvents is null-tolerant - data null becomes an empty list`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":null}"""))
        assertEquals(0, repo.getEvents("a", "b").size)
    }

    @Test
    fun `create posts the event body and parses the response`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":$eventJson}"""))
        val created = repo.create(
            CreateCalendarEventRequest(
                title = "Standup",
                description = "",
                category = "work",
                startAt = "2026-09-30T10:00:00.000Z",
                endAt = "2026-09-30T10:15:00.000Z",
            ),
        )
        assertEquals(9, created.id)
        val recorded = server.takeRequest()
        assertEquals("POST", recorded.method)
        assertEquals("/api/calendar-events", recorded.target)
        val body = Json.parseToJsonElement(recorded.body?.utf8()!!).jsonObject
        assertEquals("Standup", body["title"]?.jsonPrimitive?.content)
    }

    @Test
    fun `create surfaces an ApiError when the payload is missing`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok"}"""))
        val error = runCatching {
            repo.create(
                CreateCalendarEventRequest(
                    title = "Standup", description = "", category = "work",
                    startAt = "2026-09-30T10:00:00.000Z", endAt = "2026-09-30T10:15:00.000Z",
                ),
            )
        }.exceptionOrNull()
        assertTrue(error is ApiError)
        assertEquals("Failed to create calendar event", (error as ApiError).message)
    }

    @Test
    fun `delete sends the scope as a lowercase query parameter`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"Event deleted"}"""))
        repo.delete(id = 9, scope = EventScope.SERIES)
        val recorded = server.takeRequest()
        assertEquals("DELETE", recorded.method)
        assertEquals("/api/calendar-events/9", recorded.url.encodedPath)
        assertEquals("series", recorded.url.queryParameter("scope"))
    }

    @Test
    fun `delete without a scope omits the query parameter`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"Event deleted"}"""))
        repo.delete(id = 9)
        val recorded = server.takeRequest()
        assertEquals(null, recorded.url.queryParameter("scope"))
    }
}
