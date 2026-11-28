package com.lifetracker.domain.profile

import com.lifetracker.core.network.endpoints.UsersApi
import com.lifetracker.core.storage.SessionStore
import com.lifetracker.core.storage.SessionUser
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.After
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/**
 * MockWebServer coverage of the profile surface: the write-through of fresh
 * profile payloads into the cached session user, the privacy toggle and the
 * multipart avatar upload/delete.
 */
class ProfileRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var sessions: FakeSessions
    private lateinit var repo: ProfileRepository

    class FakeSessions : SessionStore {
        var user: SessionUser? = null
        override fun currentUser(): SessionUser? = user
        override fun setCurrentUser(user: SessionUser?) { this.user = user }
    }

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
            .create(UsersApi::class.java)
        sessions = FakeSessions()
        repo = ProfileRepository(api, sessions)
    }

    @After
    fun tearDown() {
        server.close()
    }

    private val userJson =
        """{"id":7,"username":"lauti","firstName":"Lua","lastName":"Tú","email":"l@example.com",""" +
            """"profilePicUrl":"https://cdn.example.com/p.png","thumbnailUrl":"https://cdn.example.com/t.png",""" +
            """"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"}"""

    @Test
    fun `getMyProfile refreshes the cached session user (RN write-through)`() = runTest {
        sessions.user = SessionUser(1, "old", "O", "L", "old@example.com")
        server.enqueue(MockResponse(body = """{"message":"ok","data":$userJson}"""))
        val user = repo.getMyProfile()
        assertEquals(7L, user.id)
        val cached = sessions.user
        assertEquals(7L, cached?.id)
        assertEquals("lauti", cached?.username)
        assertEquals("https://cdn.example.com/p.png", cached?.profilePicUrl)
        assertEquals("https://cdn.example.com/t.png", cached?.thumbnailUrl)
    }

    @Test
    fun `getMyProfile surfaces an ApiError when the payload is missing`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok"}"""))
        val error = runCatching { repo.getMyProfile() }.exceptionOrNull()
        assertTrue(error is com.lifetracker.domain.auth.ApiError)
        assertEquals("Failed to fetch profile", (error as com.lifetracker.domain.auth.ApiError).message)
    }

    @Test
    fun `deleteImage deletes then re-fetches the profile into the session`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"Profile image deleted"}"""))
        server.enqueue(MockResponse(body = """{"message":"ok","data":$userJson}"""))
        val user = repo.deleteImage()
        assertEquals(7L, user.id)
        assertEquals(7L, sessions.user?.id)
        // RN parity: DELETE /users/me/image followed by a profile refetch.
        assertEquals("/api/users/me/image", server.takeRequest().target)
        assertEquals("/api/users/me", server.takeRequest().target)
    }

    @Test
    fun `uploadImage posts a multipart part named image with a mime-derived filename`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":$userJson}"""))
        val user = repo.uploadImage(bytes = byteArrayOf(1, 2, 3), contentType = "image/png")
        assertEquals(7L, user.id)
        val recorded = server.takeRequest()
        assertEquals("POST", recorded.method)
        assertEquals("/api/users/me/image", recorded.target)
        val contentType = recorded.headers["Content-Type"] ?: ""
        assertTrue("multipart expected, got: $contentType", contentType.startsWith("multipart/form-data"))
        val body = recorded.body?.utf8() ?: ""
        assertTrue("part name missing: $body", body.contains("""name="image""""))
        assertTrue("png filename expected: $body", body.contains("""filename="profile.png""""))
    }

    @Test
    fun `uploadImage defaults to a jpg filename for unknown mimes`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":$userJson}"""))
        repo.uploadImage(bytes = byteArrayOf(1), contentType = "")
        assertTrue(server.takeRequest().body?.utf8()!!.contains("""filename="profile.jpg""""))
    }
}
