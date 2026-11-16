package com.lifetracker.domain.notes

import com.lifetracker.core.network.endpoints.NotesApi
import kotlinx.serialization.json.Json
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/**
 * MockWebServer contract of `NotesRepository.updateNote`: a blank title must
 * be OMITTED from the PUT body (meaning "keep the server title") because the
 * backend rejects `title=""` with `min=1` — untitled notes can only save
 * content-only. A non-blank title is sent alongside the content.
 */
class NotesRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var repo: NotesRepository

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
        repo = NotesRepository(retrofit.create(NotesApi::class.java))
    }

    @After
    fun tearDown() {
        server.close()
    }

    /** Success envelope of `PUT /notes/{id}` (server keeps its own title). */
    private fun enqueueUpdate() {
        server.enqueue(
            MockResponse(
                body = """{"message":"Note updated","data":{""" +
                    """"id":5,"userId":1,"title":"","content":"hello world",""" +
                    """"groupId":null,"position":0,""" +
                    """"createdAt":"2025-01-01T00:00:00.000Z",""" +
                    """"editedAt":"2025-01-01T00:00:00.000Z"}}""",
            ),
        )
    }

    @Test
    fun `update with a blank title omits the title field`() = kotlinx.coroutines.test.runTest {
        enqueueUpdate()

        repo.updateNote(id = 5, title = "", content = "hello world")

        val request = server.takeRequest()
        assertEquals("/api/notes/5", request.target)
        val body = request.body!!.utf8()
        assertTrue("expected content in body: $body", body.contains("\"content\":\"hello world\""))
        assertFalse("blank title must be omitted: $body", body.contains("\"title\""))
    }

    @Test
    fun `update with a title sends title and content`() = kotlinx.coroutines.test.runTest {
        enqueueUpdate()

        repo.updateNote(id = 5, title = "Shopping list", content = "hello world")

        val request = server.takeRequest()
        val body = request.body!!.utf8()
        assertTrue("expected title in body: $body", body.contains("\"title\":\"Shopping list\""))
        assertTrue("expected content in body: $body", body.contains("\"content\":\"hello world\""))
    }
}
