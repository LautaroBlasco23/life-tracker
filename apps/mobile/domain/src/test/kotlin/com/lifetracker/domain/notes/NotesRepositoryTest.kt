package com.lifetracker.domain.notes

import com.lifetracker.core.network.endpoints.NotesApi
import com.lifetracker.core.network.model.NotePositionItem
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
 * MockWebServer coverage of the notes surface: the `q` search param, the
 * one-shot reorder payload and the `{ "message": … }` error-body quirk of
 * the notes/note-groups/sticky-notes controllers (contract §1.6).
 */
class NotesRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var repo: NotesRepository

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
            .create(NotesApi::class.java)
        repo = NotesRepository(api)
    }

    @After
    fun tearDown() {
        server.close()
    }

    private val noteJson =
        """{"id":3,"userId":7,"title":"Groceries","content":"eggs, milk","position":0,""" +
            """"createdAt":"2025-01-01T00:00:00.000Z","editedAt":"2025-01-01T00:00:00.000Z"}"""

    @Test
    fun `getNotes sends the q query when a search term is present`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":[$noteJson]}"""))
        val notes = repo.getNotes(query = "eggs")
        assertEquals(1, notes.size)
        assertEquals("Groceries", notes[0].title)
        val recorded = server.takeRequest()
        assertEquals("/api/notes", recorded.url.encodedPath)
        assertEquals("eggs", recorded.url.queryParameter("q"))
    }

    @Test
    fun `getNotes omits q when no query is given`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":null}"""))
        assertEquals(0, repo.getNotes().size)
        assertEquals(null, server.takeRequest().url.queryParameter("q"))
    }

    @Test
    fun `createNote posts title and content`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":$noteJson}"""))
        val created = repo.createNote(title = "Groceries", content = "eggs, milk")
        assertEquals(3, created.id)
        val body = Json.parseToJsonElement(server.takeRequest().body?.utf8()!!).jsonObject
        assertEquals("Groceries", body["title"]?.jsonPrimitive?.content)
        assertEquals("eggs, milk", body["content"]?.jsonPrimitive?.content)
    }

    @Test
    fun `error bodies surface the message key - not just error`() = runTest {
        // The notes controllers return `{ "message": … }` for 4xx bodies;
        // users must still see the backend text (contract §1.6).
        server.enqueue(MockResponse(code = 400, body = """{"message":"Title is required"}"""))
        val error = runCatching { repo.getNotes() }.exceptionOrNull()
        assertTrue(error is ApiError)
        assertEquals("Title is required", (error as ApiError).message)
        assertEquals(400, (error as ApiError).status)
    }

    @Test
    fun `error bodies still parse the standard error key when present`() = runTest {
        server.enqueue(MockResponse(code = 400, body = """{"error":"Bad request"}"""))
        val error = runCatching { repo.getNotes() }.exceptionOrNull()
        assertEquals("Bad request", (error as? ApiError)?.message)
    }

    @Test
    fun `reorderNotes posts the items payload`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok"}"""))
        repo.reorderNotes(listOf(NotePositionItem(id = 3, groupId = null, position = 1)))
        val recorded = server.takeRequest()
        assertEquals("POST", recorded.method)
        assertEquals("/api/notes/reorder", recorded.target)
        val body = Json.parseToJsonElement(recorded.body?.utf8()!!).jsonObject
        val items = body["items"]?.toString() ?: ""
        assertTrue("note id missing: $items", items.contains("\"id\":3"))
        assertTrue("position missing: $items", items.contains("\"position\":1"))
        // explicitNulls=false drops the null groupId from the wire body.
        assertTrue("items array missing: $items", items.contains("[]").not() && items.contains("{"))
    }

    @Test
    fun `deleteNote issues DELETE to the note id`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"Note deleted"}"""))
        repo.deleteNote(3)
        val recorded = server.takeRequest()
        assertEquals("DELETE", recorded.method)
        assertEquals("/api/notes/3", recorded.target)
    }

    @Test
    fun `note-group rename PUTs the name`() = runTest {
        server.enqueue(
            MockResponse(
                body = """{"message":"ok","data":{"id":4,"userId":7,"name":"Kitchen","position":0,""" +
                    """"createdAt":"2025-01-01T00:00:00.000Z","editedAt":"2025-01-01T00:00:00.000Z"}}""",
            ),
        )
        val group = repo.updateNoteGroup(id = 4, name = "Kitchen")
        assertEquals("Kitchen", group.name)
        val recorded = server.takeRequest()
        assertEquals("PUT", recorded.method)
        assertEquals("/api/note-groups/4", recorded.target)
    }

    @Test
    fun `sticky note creation tolerates null title and description`() = runTest {
        server.enqueue(
            MockResponse(
                body = """{"message":"ok","data":{"id":8,"userId":7,"title":"Todo","description":"buy bread",""" +
                    """"createdAt":"2025-01-01T00:00:00.000Z","editedAt":"2025-01-01T00:00:00.000Z"}}""",
            ),
        )
        val sticky = repo.createStickyNote(title = "Todo", description = "buy bread")
        assertEquals(8, sticky.id)
        val body = Json.parseToJsonElement(server.takeRequest().body?.utf8()!!).jsonObject
        assertEquals("Todo", body["title"]?.jsonPrimitive?.content)
    }
}
