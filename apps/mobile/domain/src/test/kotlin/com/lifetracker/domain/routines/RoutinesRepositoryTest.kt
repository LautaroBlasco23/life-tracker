package com.lifetracker.domain.routines

import com.lifetracker.core.network.endpoints.RoutinesApi
import com.lifetracker.core.network.model.ActivityIDPosition
import com.lifetracker.core.network.model.CreateRoutineRequest
import com.lifetracker.core.network.model.DayTime
import com.lifetracker.core.network.model.PrivacyStatus
import com.lifetracker.core.network.model.UpdateRoutineRequest
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
 * MockWebServer coverage of the routines surface (routines manager modal):
 * list/create/update(PATCH)/delete.
 */
class RoutinesRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var repo: RoutinesRepository

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
            .create(RoutinesApi::class.java)
        repo = RoutinesRepository(api)
    }

    @After
    fun tearDown() {
        server.close()
    }

    private val routineJson =
        """{"id":5,"userId":7,"title":"Morning reset","description":"start strong",""" +
            """"privacyStatus":"private","dayTime":"morning","isCompletedToday":false,""" +
            """"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"}"""

    @Test
    fun `list hits routines-me and is null-tolerant`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":[$routineJson]}"""))
        val result = repo.list()
        assertEquals(1, result.getOrThrow().size)
        assertEquals("Morning reset", result.getOrThrow()[0].title)
        assertEquals("/api/routines/me", server.takeRequest().target)
    }

    @Test
    fun `get surfaces an ApiError when the payload is missing`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok"}"""))
        val result = repo.get(5)
        assertTrue(result.isFailure)
        assertEquals("Routine payload was missing", (result.exceptionOrNull() as? ApiError)?.message)
    }

    @Test
    fun `create posts the ordered activity list`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":$routineJson}"""))
        val result = repo.create(
            CreateRoutineRequest(
                title = "Morning reset",
                description = "start strong",
                privacyStatus = PrivacyStatus.PRIVATE,
                dayTime = DayTime.MORNING,
                activityIds = listOf(ActivityIDPosition(activityId = 1, position = 0)),
            ),
        )
        assertTrue(result.isSuccess)
        val recorded = server.takeRequest()
        assertEquals("POST", recorded.method)
        assertEquals("/api/routines", recorded.target)
        val body = Json.parseToJsonElement(recorded.body?.utf8()!!).jsonObject
        assertEquals("private", body["privacyStatus"]?.jsonPrimitive?.content)
        assertTrue(body["activityIds"].toString().contains("\"activityId\":1"))
    }

    @Test
    fun `update is a PATCH, not a PUT`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":$routineJson}"""))
        val result = repo.update(5, UpdateRoutineRequest(title = "Evening reset"))
        assertTrue(result.isSuccess)
        val recorded = server.takeRequest()
        assertEquals("PATCH", recorded.method)
        assertEquals("/api/routines/5", recorded.target)
    }

    @Test
    fun `delete issues DELETE to the routine id`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"Routine deleted"}"""))
        assertTrue(repo.delete(5).isSuccess)
        val recorded = server.takeRequest()
        assertEquals("DELETE", recorded.method)
        assertEquals("/api/routines/5", recorded.target)
    }
}
