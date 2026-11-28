package com.lifetracker.domain.social

import com.lifetracker.core.network.endpoints.SubscriptionsApi
import com.lifetracker.core.network.model.SubscriptionSourceType
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
 * MockWebServer coverage of the subscription (clone) surface: cloning a
 * public activity/routine and abandoning the clone.
 */
class SubscriptionsRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var repo: SubscriptionsRepository

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
            .create(SubscriptionsApi::class.java)
        repo = SubscriptionsRepository(api)
    }

    @After
    fun tearDown() {
        server.close()
    }

    @Test
    fun `subscribe clones a source and returns the clone ids`() = runTest {
        server.enqueue(
            MockResponse(
                body = """{"message":"ok","data":{"id":11,"sourceType":"activity","sourceId":42,"clonedId":43}}""",
            ),
        )
        val result = repo.subscribe(SubscriptionSourceType.ACTIVITY, sourceId = 42)
        assertTrue(result.isSuccess)
        val subscription = result.getOrThrow()
        assertEquals(43, subscription.clonedId)
        assertEquals(42, subscription.sourceId)

        val recorded = server.takeRequest()
        assertEquals("POST", recorded.method)
        assertEquals("/api/subscriptions", recorded.target)
        val body = Json.parseToJsonElement(recorded.body?.utf8()!!).jsonObject
        assertEquals("activity", body["sourceType"]?.jsonPrimitive?.content)
        assertEquals(42, body["sourceId"]?.jsonPrimitive?.content?.toInt())
    }

    @Test
    fun `subscribe surfaces an ApiError when the payload is missing`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok"}"""))
        val result = repo.subscribe(SubscriptionSourceType.ROUTINE, sourceId = 3)
        assertTrue(result.isFailure)
        assertEquals("Subscription payload was missing", (result.exceptionOrNull() as? ApiError)?.message)
    }

    @Test
    fun `mySubscriptions is null-tolerant - data null becomes an empty list`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":null}"""))
        val result = repo.mySubscriptions()
        assertTrue(result.isSuccess)
        assertEquals(0, result.getOrThrow().size)
    }

    @Test
    fun `unsubscribe issues DELETE to the clone id`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok"}"""))
        assertTrue(repo.unsubscribe(11).isSuccess)
        val recorded = server.takeRequest()
        assertEquals("DELETE", recorded.method)
        assertEquals("/api/subscriptions/11", recorded.target)
    }
}
