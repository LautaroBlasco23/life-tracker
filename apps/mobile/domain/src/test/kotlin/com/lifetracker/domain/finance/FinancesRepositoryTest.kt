package com.lifetracker.domain.finance

import com.lifetracker.core.network.endpoints.FinancesApi
import com.lifetracker.core.network.model.CreateTransactionRequest
import com.lifetracker.core.network.model.TransactionFrequency
import com.lifetracker.core.network.model.TransactionType
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
 * MockWebServer coverage of the finance repository: the missing-date fill
 * (`date: data.date || new Date().toISOString()` RN parity), the movements
 * paging envelope (`total`) and the lowercase wire enum params.
 */
class FinancesRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var repo: FinancesRepository

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
            .create(FinancesApi::class.java)
        repo = FinancesRepository(api)
    }

    @After
    fun tearDown() {
        server.close()
    }

    private val transactionJson =
        """{"id":"507f1f77bcf86cd799439011","userId":7,"type":"income","frequency":"variable",""" +
            """"categoryName":"Salary","amount":100.0,"date":"2026-09-30T03:00:00.000Z",""" +
            """"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"}"""

    @Test
    fun `createTransaction fills a missing date with the current instant`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":$transactionJson}"""))
        repo.createTransaction(
            CreateTransactionRequest(
                type = TransactionType.INCOME,
                frequency = TransactionFrequency.VARIABLE,
                description = "Salary",
                amount = 100.0,
                category = "Salary",
            ),
        )
        val body = Json.parseToJsonElement(server.takeRequest().body?.utf8()!!).jsonObject
        // The RN service defaulted `date: data.date || new Date().toISOString()`.
        assertTrue(
            "expected the filled date to parse as an RFC3339 instant, got: $body",
            body["date"]?.jsonPrimitive?.content?.matches(Regex("""\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*""")) == true,
        )
    }

    @Test
    fun `createTransaction preserves an explicit date`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":$transactionJson}"""))
        repo.createTransaction(
            CreateTransactionRequest(
                date = "2026-01-15T10:00:00.000Z",
                type = TransactionType.INCOME,
                frequency = TransactionFrequency.VARIABLE,
                amount = 100.0,
                category = "Salary",
            ),
        )
        val body = Json.parseToJsonElement(server.takeRequest().body?.utf8()!!).jsonObject
        assertEquals("2026-01-15T10:00:00.000Z", body["date"]?.jsonPrimitive?.content)
    }

    @Test
    fun `createTransaction returns the parsed response`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"ok","data":$transactionJson}"""))
        val created = repo.createTransaction(
            CreateTransactionRequest(
                type = TransactionType.INCOME,
                frequency = TransactionFrequency.VARIABLE,
                amount = 100.0,
                category = "Salary",
            ),
        )
        assertEquals("507f1f77bcf86cd799439011", created.id)
        assertEquals("Salary", created.categoryName)
    }

    @Test
    fun `getMovements surfaces the paging total from the envelope`() = runTest {
        server.enqueue(
            MockResponse(
                body = """{"message":"ok","data":[{"id":"abc","sourceType":"transaction",""" +
                    """"type":"income","amount":10.0,"category":"Salary",""" +
                    """"date":"2026-09-30T03:00:00.000Z","paid":true}],"count":1,"total":17}""",
            ),
        )
        val page = repo.getMovements(limit = 10, offset = 0)
        assertEquals(1, page.data.size)
        assertEquals(17, page.total)
    }

    @Test
    fun `getMovements falls back to the data size when total is absent`() = runTest {
        server.enqueue(
            MockResponse(
                body = """{"message":"ok","data":[{"id":"abc","sourceType":"transaction",""" +
                    """"type":"outcome","amount":5.0,"category":"Food",""" +
                    """"date":"2026-09-30T03:00:00.000Z","paid":true}],"count":1}""",
            ),
        )
        val page = repo.getMovements()
        // JS parity: `result.total ?? data.length`.
        assertEquals(1, page.total)
    }

    @Test
    fun `getCategories sends lowercase wire enum params`() = runTest {
        server.enqueue(
            MockResponse(
                body = """{"message":"ok","data":[{"name":"Salary","type":"income",""" +
                    """"applicableToFreq":"variable"}]}""",
            ),
        )
        val categories = repo.getCategories(type = TransactionType.INCOME, frequency = TransactionFrequency.VARIABLE)
        assertEquals(1, categories.size)
        assertEquals("Salary", categories[0].name)
        val recorded = server.takeRequest()
        assertEquals("/api/finances/categories", recorded.url.encodedPath)
        assertEquals("income", recorded.url.queryParameter("type"))
        assertEquals("variable", recorded.url.queryParameter("frequency"))
    }

    @Test
    fun `deleteTransaction issues DELETE to the hex id`() = runTest {
        server.enqueue(MockResponse(body = """{"message":"Transaction deleted"}"""))
        repo.deleteTransaction("507f1f77bcf86cd799439011")
        val recorded = server.takeRequest()
        assertEquals("DELETE", recorded.method)
        assertEquals("/api/finances/transactions/507f1f77bcf86cd799439011", recorded.target)
    }

    @Test
    fun `getFinanceSummary passes both required range bounds`() = runTest {
        server.enqueue(
            MockResponse(
                body = """{"message":"ok","data":{"period":"Sep 2026","totalIncome":100.0,""" +
                    """"totalOutcome":40.0,"balance":60.0}}""",
            ),
        )
        val summary = repo.getFinanceSummary("2026-09-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z")
        assertEquals("Sep 2026", summary?.period)
        assertEquals(60.0, summary?.balance ?: 0.0, 0.0)
        val recorded = server.takeRequest()
        assertEquals("/api/finances/summary", recorded.url.encodedPath)
        assertEquals("2026-09-01T00:00:00.000Z", recorded.url.queryParameter("start_date"))
        assertEquals("2026-10-01T00:00:00.000Z", recorded.url.queryParameter("end_date"))
    }
}
