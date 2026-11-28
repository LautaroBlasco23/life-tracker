package com.lifetracker.domain.profile

import com.lifetracker.core.network.endpoints.DataApi
import java.io.ByteArrayOutputStream
import java.io.File
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
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/**
 * MockWebServer coverage of the data-backup flows: the XLSX export stream
 * (filename from Content-Disposition) and the destructive multipart import.
 */
class DataBackupRepositoryTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private lateinit var server: MockWebServer
    private lateinit var repo: DataBackupRepository

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
            .create(DataApi::class.java)
        repo = DataBackupRepository(api)
    }

    @After
    fun tearDown() {
        server.close()
    }

    @Test
    fun `exportTo streams the workbook into the sink and returns the suggested filename`() = runTest {
        val workbook = "PK-xlsx-bytes"
        server.enqueue(
            MockResponse(
                body = workbook,
                headers = okhttp3.Headers.headersOf(
                    "Content-Disposition",
                    """attachment; filename="life-tracker-backup-2026-09-30.xlsx"""",
                ),
            ),
        )
        val sink = ByteArrayOutputStream()
        val filename = repo.exportTo(sink)
        assertEquals("life-tracker-backup-2026-09-30.xlsx", filename)
        assertEquals(workbook, sink.toString("UTF-8"))
        assertEquals("/api/users/me/data/export", server.takeRequest().target)
    }

    @Test
    fun `exportTo falls back to the default filename when the header is absent`() = runTest {
        server.enqueue(MockResponse(body = "workbook"))
        assertEquals(DEFAULT_BACKUP_FILENAME, repo.exportTo(ByteArrayOutputStream()))
    }

    @Test
    fun `exportTo surfaces an ApiError on a failed response`() = runTest {
        server.enqueue(MockResponse(code = 500, body = """{"error":"Export failed"}"""))
        val error = runCatching { repo.exportTo(ByteArrayOutputStream()) }.exceptionOrNull()
        assertTrue(error is com.lifetracker.domain.auth.ApiError)
        assertEquals("Failed to export data", (error as com.lifetracker.domain.auth.ApiError).message)
        assertEquals(500, error.status)
    }

    @Test
    fun `importBackup uploads the file as a multipart part named file`() = runTest {
        server.enqueue(
            MockResponse(
                body = """{"message":"ok","data":{"activities":1,"timeRecords":2,"calendarEvents":3,""" +
                    """"notes":4,"routines":5,"routineActivities":6,"activityRecords":7,""" +
                    """"transactions":8,"payments":9}}""",
            ),
        )
        val file = File(tmp.root, "backup.xlsx").apply { writeText("workbook-bytes") }
        val counts = repo.importBackup(file)
        assertEquals(1, counts.activities)
        assertEquals(9, counts.payments)

        val recorded = server.takeRequest()
        assertEquals("POST", recorded.method)
        assertEquals("/api/users/me/data/import", recorded.target)
        val contentType = recorded.headers["Content-Type"] ?: ""
        assertTrue("multipart expected, got: $contentType", contentType.startsWith("multipart/form-data"))
        val body = recorded.body?.utf8() ?: ""
        assertTrue("part name missing: $body", body.contains("""name="file""""))
        assertTrue("filename missing: $body", body.contains("""filename="backup.xlsx""""))
    }
}
