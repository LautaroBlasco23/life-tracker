package com.lifetracker.domain.time

import com.lifetracker.core.network.endpoints.TimeRecordsApi
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
 * MockWebServer coverage of the time-records repository surface: list filters,
 * create/update bodies and delete, plus the error-envelope propagation.
 */
class TimeRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var repo: TimeRepository

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
            .create(TimeRecordsApi::class.java)
        repo = TimeRepository(api)
    }

    @After
    fun tearDown() {
        server.close()
    }

    private val recordJson =
        """{"id":5,"category":"reading","description":"Dune","durationMinutes":45,""" +
            """"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"}"""

    @Test
    fun `getRecords sends the category-month-year filters and parses the list`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":[$recordJson]}"""))
        val records = repo.getRecords(category = "reading", month = 9, year = 2026)
        assertEquals(1, records.size)
        assertEquals("Dune", records[0].description)
        val recorded = server.takeRequest()
        assertEquals("/api/time-records", recorded.url.encodedPath)
        assertEquals("reading", recorded.url.queryParameter("category"))
        assertEquals("9", recorded.url.queryParameter("month"))
        assertEquals("2026", recorded.url.queryParameter("year"))
    }

    @Test
    fun `getRecords is null-tolerant - data null becomes an empty list`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":null}"""))
        assertEquals(0, repo.getRecords().size)
    }

    @Test
    fun `create posts category-description-duration and returns the record`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":$recordJson}"""))
        val created = repo.create(category = "reading", description = "Dune", durationMinutes = 45)
        assertEquals(5, created.id)
        val recorded = server.takeRequest()
        assertEquals("POST", recorded.method)
        assertEquals("/api/time-records", recorded.target)
        val body = Json.parseToJsonElement(recorded.body?.utf8()!!).jsonObject
        assertEquals("reading", body["category"]?.jsonPrimitive?.content)
        assertEquals("Dune", body["description"]?.jsonPrimitive?.content)
        assertEquals(45, body["durationMinutes"]?.jsonPrimitive?.content?.toInt())
    }

    @Test
    fun `create surfaces an ApiError when the payload is missing`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok"}"""))
        val error = runCatching {
            repo.create(category = "reading", description = "Dune", durationMinutes = 45)
        }.exceptionOrNull()
        assertTrue(error is ApiError)
        assertEquals("Failed to create time record", (error as ApiError).message)
    }

    @Test
    fun `update PUTs all three fields to the record id`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":$recordJson}"""))
        val updated = repo.update(id = 5, category = "work", description = "Reports", durationMinutes = 90)
        assertEquals(5, updated.id)
        val recorded = server.takeRequest()
        assertEquals("PUT", recorded.method)
        assertEquals("/api/time-records/5", recorded.target)
        val body = Json.parseToJsonElement(recorded.body?.utf8()!!).jsonObject
        assertEquals("work", body["category"]?.jsonPrimitive?.content)
        assertEquals(90, body["durationMinutes"]?.jsonPrimitive?.content?.toInt())
    }

    @Test
    fun `delete issues DELETE to the record id`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"Time record deleted"}"""))
        repo.delete(5)
        val recorded = server.takeRequest()
        assertEquals("DELETE", recorded.method)
        assertEquals("/api/time-records/5", recorded.target)
    }

    @Test
    fun `errors propagate the backend message and status`() = runTest {
        server.enqueue(MockResponse(code = 500, body = """{"error":"Internal server error"}"""))
        val error = runCatching { repo.getRecords() }.exceptionOrNull()
        assertTrue(error is ApiError)
        assertEquals("Internal server error", (error as ApiError).message)
        assertEquals(500, error.status)
    }
}
