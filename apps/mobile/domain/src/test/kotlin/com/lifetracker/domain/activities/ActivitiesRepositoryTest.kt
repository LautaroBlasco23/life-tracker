package com.lifetracker.domain.activities

import com.lifetracker.core.network.endpoints.ActivitiesApi
import com.lifetracker.core.network.model.CreateActivityRequest
import com.lifetracker.core.network.model.DayTime
import com.lifetracker.core.network.model.Frequency
import com.lifetracker.core.network.model.RecordActivityRequest
import com.lifetracker.domain.auth.ApiError
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
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
 * MockWebServer coverage of the activities repository surface (today list,
 * filters, streak null-tolerance and the record-completion flow).
 * Wire/JSON contract per `backend/.../activity_dto.go`.
 */
class ActivitiesRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var api: ActivitiesApi
    private lateinit var repo: ActivitiesRepository

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        val json = Json { ignoreUnknownKeys = true; explicitNulls = false; coerceInputValues = true }
        api = Retrofit.Builder()
            .baseUrl(server.url("/api/"))
            .client(OkHttpClient())
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(ActivitiesApi::class.java)
        repo = ActivitiesRepository(api)
    }

    @After
    fun tearDown() {
        server.close()
    }

    private val activityJson =
        """{"id":1,"userId":7,"title":"Drink water","description":"8 glasses","frequency":"daily",""" +
            """"dayTime":"morning","completionAmount":8,"todayCompletions":1,"isActive":true,""" +
            """"isCompletedToday":false,"privacyStatus":"private","streak":{"current":2,"longest":5},""" +
            """"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"}"""

    @Test
    fun `today parses the scheduled list`() = runTest {
        server.enqueue(
            MockResponse(body = """{"message":"ok","data":[$activityJson]}"""),
        )
        val result = repo.today()
        assertTrue(result.isSuccess)
        val activities = result.getOrThrow()
        assertEquals(1, activities.size)
        assertEquals("Drink water", activities[0].title)
        assertEquals(8, activities[0].completionAmount)
        assertEquals(2, activities[0].streak?.current ?: 0)
        assertEquals("/api/activities/today", server.takeRequest().target)
    }

    @Test
    fun `today is null-tolerant - data null becomes an empty list`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":null}"""))
        val result = repo.today()
        assertTrue(result.isSuccess)
        assertEquals(emptyList<com.lifetracker.core.network.model.ActivityResponse>(), result.getOrThrow())
    }

    @Test
    fun `list with a scheduledFor filter hits the filter endpoint params`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":[]}"""))
        val result = repo.list(ActivityFilter(scheduledFor = "2026-09-30"))
        assertTrue(result.isSuccess)
        val recorded = server.takeRequest()
        assertEquals("/api/activities", recorded.url.encodedPath)
        assertEquals("2026-09-30", recorded.url.queryParameter("scheduled_for"))
    }

    @Test
    fun `list without a filter hits the plain list endpoint`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":[$activityJson]}"""))
        val result = repo.list()
        assertTrue(result.isSuccess)
        val recorded = server.takeRequest()
        assertEquals("/api/activities", recorded.target)
        assertEquals(null, recorded.url.queryParameter("scheduled_for"))
    }

    @Test
    fun `streak parses the global completion streak`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":{"current":3,"longest":10}}"""))
        val result = repo.streak()
        assertTrue(result.isSuccess)
        assertEquals(3, result.getOrThrow().current)
        assertEquals(10, result.getOrThrow().longest)
    }

    @Test
    fun `streak surfaces an ApiError when the payload is missing`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok"}"""))
        val result = repo.streak()
        assertTrue(result.isFailure)
        assertEquals("Global streak payload was missing", (result.exceptionOrNull() as? ApiError)?.message)
    }

    @Test
    fun `get surfaces the backend error message on failure`() = runTest {
        server.enqueue(
            MockResponse(code = 404, body = """{"error":"Activity not found"}"""),
        )
        val result = repo.get(42)
        assertTrue(result.isFailure)
        val error = result.exceptionOrNull() as? ApiError
        assertEquals("Activity not found", error?.message)
        assertEquals(404, error?.status)
    }

    @Test
    fun `create posts the wire-shaped body`() = runTest {
        server.enqueue(
            MockResponse(
                body = """{"message":"ok","data":$activityJson}""",
            ),
        )
        val result = repo.create(
            CreateActivityRequest(
                title = "Drink water",
                description = "8 glasses",
                frequency = Frequency.DAILY,
                dayTime = DayTime.MORNING,
                completionAmount = 8,
            ),
        )
        assertTrue(result.isSuccess)
        val recorded = server.takeRequest()
        assertEquals("POST", recorded.method)
        assertEquals("/api/activities", recorded.target)
        val body = Json.parseToJsonElement(recorded.body?.utf8()!!).jsonObject
        assertEquals("daily", body["frequency"]?.jsonPrimitive?.content)
        assertEquals("morning", body["dayTime"]?.jsonPrimitive?.content)
    }

    @Test
    fun `record posts one completion and parses the record id`() = runTest {
        server.enqueue(
            MockResponse(
                body = """{"message":"ok","data":{"id":"abc123","activityId":42,"userId":7,""" +
                    """"completionDate":"2026-09-30T03:00:00.000Z",""" +
                    """"createdAt":"2026-09-30T03:00:00.000Z"}}""",
            ),
        )
        val result = repo.record(42, RecordActivityRequest(notes = "gym session"))
        assertTrue(result.isSuccess)
        assertEquals("abc123", result.getOrThrow().id)
        val recorded = server.takeRequest()
        assertEquals("POST", recorded.method)
        assertEquals("/api/activities/42/record", recorded.target)
        val body = Json.parseToJsonElement(recorded.body?.utf8()!!).jsonObject
        assertEquals("gym session", body["notes"]?.jsonPrimitive?.content)
    }
}
