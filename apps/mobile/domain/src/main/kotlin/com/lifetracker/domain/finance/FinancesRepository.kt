package com.lifetracker.domain.finance

import com.lifetracker.core.network.endpoints.FinancesApi
import com.lifetracker.core.network.model.CategoryResponse
import com.lifetracker.core.network.model.CreatePaymentRequest
import com.lifetracker.core.network.model.CreateTransactionRequest
import com.lifetracker.core.network.model.FixedTransactionResponse
import com.lifetracker.core.network.model.FinanceSummaryResponse
import com.lifetracker.core.network.model.MonthlyStats
import com.lifetracker.core.network.model.MovementResponse
import com.lifetracker.core.network.model.PaymentResponse
import com.lifetracker.core.network.model.TransactionFrequency
import com.lifetracker.core.network.model.TransactionResponse
import com.lifetracker.core.network.model.TransactionType
import com.lifetracker.core.network.model.UpdateTransactionRequest
import com.lifetracker.domain.auth.ApiError
import com.lifetracker.domain.auth.successOrThrow
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Port of the RN `packages/shared/src/services/finance-service.ts` — the parts
 * consumed by the finance screens (contract §9; envelope quirks preserved):
 *
 * - `movements` uses the `{ message, data, count, total }` envelope; the
 *   client pagers read `total` (`result.total ?? data.length` in JS).
 * - create endpoints fill a missing RFC3339 `date` with the current instant
 *   (JS did `date: data.date || new Date().toISOString()`).
 * - transaction/payment/fixed ids are hex ObjectId strings.
 */
@Singleton
class FinancesRepository @Inject constructor(
    private val api: FinancesApi,
) {
    /** GET /finances/categories — category catalog with optional filters. */
    suspend fun getCategories(
        type: TransactionType? = null,
        frequency: TransactionFrequency? = null,
    ): List<CategoryResponse> =
        api.listCategories(
            type = type?.wire,
            frequency = frequency?.wire,
        ).successOrThrow().data.orEmpty()

    /** POST /finances/transactions (201); a missing `date` becomes now. */
    suspend fun createTransaction(request: CreateTransactionRequest): TransactionResponse {
        val body = if (request.date != null) request
        else request.copy(date = Instant.now().toString())
        return api.createTransaction(body).successOrThrow().data
            ?: throw ApiError("Failed to create transaction")
    }

    /** PUT /finances/transactions/{id} — partial update. */
    suspend fun updateTransaction(id: String, request: UpdateTransactionRequest): TransactionResponse =
        api.updateTransaction(id, request).successOrThrow().data
            ?: throw ApiError("Failed to update transaction")

    /** DELETE /finances/transactions/{id}. */
    suspend fun deleteTransaction(id: String) {
        api.deleteTransaction(id).successOrThrow()
    }

    /** GET /finances/fixed-transactions — fixed bills with per-period totals. */
    suspend fun getFixedTransactions(): List<FixedTransactionResponse> =
        api.listFixedTransactions().successOrThrow().data.orEmpty()

    /** GET /finances/fixed-transactions/{id} — bill + payment history. */
    suspend fun getFixedTransactionWithPayments(id: String): FixedTransactionResponse =
        api.getFixedTransaction(id).successOrThrow().data
            ?: throw ApiError("Failed to fetch fixed transaction")

    /** GET /finances/movements — unified feed page (`total` drives paging). */
    suspend fun getMovements(
        category: String? = null,
        month: Int? = null,
        year: Int? = null,
        limit: Int? = null,
        offset: Int? = null,
    ): MovementsPage {
        val response = api.listMovements(
            category = category,
            month = month,
            year = year,
            limit = limit,
            offset = offset,
        ).successOrThrow()
        return MovementsPage(
            data = response.data.orEmpty(),
            total = response.total ?: response.data?.size ?: 0,
        )
    }

    /** POST /finances/payments (201); a missing `date` becomes now. */
    suspend fun createPayment(request: CreatePaymentRequest): PaymentResponse {
        val body = if (request.date != null) request
        else request.copy(date = Instant.now().toString())
        return api.createPayment(body).successOrThrow().data
            ?: throw ApiError("Failed to create payment")
    }

    /** DELETE /finances/payments/{id} — re-opens the bill for that period. */
    suspend fun deletePayment(id: String) {
        api.deletePayment(id).successOrThrow()
    }

    /** GET /finances/summary — both `start_date` and `end_date` are required. */
    suspend fun getFinanceSummary(startDate: String, endDate: String): FinanceSummaryResponse? =
        api.financeSummary(startDate, endDate).successOrThrow().data

    /** GET /finances/monthly-stats — per-month aggregates for `year`. */
    suspend fun getMonthlyStats(year: Int): List<MonthlyStats> =
        api.monthlyStats(year).successOrThrow().data.orEmpty()
}

/** One movements-feed page (`{ data, total }` of the shared service). */
data class MovementsPage(
    val data: List<MovementResponse>,
    val total: Int,
)

/** Lowercase wire values of the enum params (contract §12). */
private val TransactionType.wire: String get() = name.lowercase()
private val TransactionFrequency.wire: String get() = name.lowercase()
