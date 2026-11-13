package com.lifetracker.domain

import com.lifetracker.core.network.endpoints.ActivitiesApi
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.MediaType.Companion.toMediaType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/**
 * Regression coverage for the "Revert last" flow: `@DELETE` + `@Body` is
 * rejected by Retrofit ("Non-body HTTP method cannot contain @Body"), which
 * made every revert silently fail. The endpoint is called without a body
 * (the server reverts the latest completion when `targetDate` is absent —
 * web `revertLastCompletion` parity).
 */
class RevertLastRequestTest {

    @Test
    fun `revertLast builds a DELETE without body when body param is null`() {
        val server = MockWebServer()
        server.start()
        server.enqueue(MockResponse(code = 200, body = """{"message":"ok"}"""))
        val json = Json { ignoreUnknownKeys = true; encodeDefaults = false }
        val api = Retrofit.Builder()
            .baseUrl(server.url("/api/"))
            .addConverterFactory(
                json.asConverterFactory("application/json".toMediaType()),
            )
            .build()
            .create(ActivitiesApi::class.java)

        val response = runBlocking { api.revertLastCompletion(42) }
        assertEquals(200, response.code())

        val recorded = server.takeRequest()
        assertEquals("DELETE", recorded.method)
        assertEquals("/api/activities/42/revert", recorded.url.encodedPath)
        assertTrue(
            "expected no request body, got: ${recorded.body?.utf8()}",
            (recorded.body?.size ?: 0) == 0,
        )
        server.close()
    }
}
