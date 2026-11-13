package com.lifetracker.core.network.endpoints

import com.lifetracker.core.network.model.ApiEnvelope
import com.lifetracker.core.network.model.ApiList
import com.lifetracker.core.network.model.CategoryResponse
import com.lifetracker.core.network.model.CreatePaymentRequest
import com.lifetracker.core.network.model.CreateTransactionRequest
import com.lifetracker.core.network.model.FixedTransactionResponse
import com.lifetracker.core.network.model.FinanceSummaryResponse
import com.lifetracker.core.network.model.MovementsResponse
import com.lifetracker.core.network.model.MonthlyStats
import com.lifetracker.core.network.model.MovementResponse
import com.lifetracker.core.network.model.MonthlyStatsResponse
import com.lifetracker.core.network.model.PaymentResponse
import com.lifetracker.core.network.model.TransactionResponse
import com.lifetracker.core.network.model.UpdateTransactionRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query
import com.lifetracker.core.network.model.MessageOnly

/**
 * `/finances` endpoints (contract §9). Transaction/fixed-transaction/payment
 * path and model IDs are hex ObjectId strings.
 *
 * Envelope variants per the contract + Go controllers:
 * - `movements` uses the Movements envelope (`{ message, data, count, total }`)
 *   → [MovementsResponse].
 * - `monthly-stats` uses the MonthlyStats envelope (`{ message, data, year }`)
 *   → [MonthlyStatsResponse].
 * - every other list: [ApiList]; every other singleton: [ApiEnvelope].
 */
interface FinancesApi {

    /** Lists the category catalog with optional `type` / `frequency` filters. */
    @GET("finances/categories")
    suspend fun listCategories(
        @Query("type") type: String? = null,
        @Query("frequency") frequency: String? = null,
    ): Response<ApiList<CategoryResponse>>

    /** Creates a transaction; responds HTTP 201. */
    @POST("finances/transactions")
    suspend fun createTransaction(@Body body: CreateTransactionRequest): Response<ApiEnvelope<TransactionResponse>>

    /** Lists transactions with optional filters; server default `limit` = 100. */
    @GET("finances/transactions")
    suspend fun listTransactions(
        @Query("type") type: String? = null,
        @Query("frequency") frequency: String? = null,
        /** `YYYY-MM-DD`. */
        @Query("start_date") startDate: String? = null,
        /** `YYYY-MM-DD`. */
        @Query("end_date") endDate: String? = null,
        @Query("month") month: Int? = null,
        @Query("year") year: Int? = null,
        @Query("category") category: String? = null,
        @Query("limit") limit: Int? = null,
    ): Response<ApiList<TransactionResponse>>

    /** Fetches a single transaction. */
    @GET("finances/transactions/{id}")
    suspend fun getTransaction(@Path("id") id: String): Response<ApiEnvelope<TransactionResponse>>

    /** Partially updates a transaction (omit unchanged fields). */
    @PUT("finances/transactions/{id}")
    suspend fun updateTransaction(@Path("id") id: String, @Body body: UpdateTransactionRequest): Response<ApiEnvelope<TransactionResponse>>

    /** Deletes a transaction. */
    @DELETE("finances/transactions/{id}")
    suspend fun deleteTransaction(@Path("id") id: String): Response<MessageOnly>

    /** Lists fixed bills with optional month/year filters (totals per bill included). */
    @GET("finances/fixed-transactions")
    suspend fun listFixedTransactions(
        @Query("month") month: Int? = null,
        @Query("year") year: Int? = null,
    ): Response<ApiList<FixedTransactionResponse>>

    /** Fetches one fixed bill together with its payments. */
    @GET("finances/fixed-transactions/{id}")
    suspend fun getFixedTransaction(@Path("id") id: String): Response<ApiEnvelope<FixedTransactionResponse>>

    /** Unified money-movement feed with optional filters and offset paging. */
    @GET("finances/movements")
    suspend fun listMovements(
        @Query("type") type: String? = null,
        @Query("category") category: String? = null,
        @Query("month") month: Int? = null,
        @Query("year") year: Int? = null,
        /** Server cap: 200. */
        @Query("limit") limit: Int? = null,
        @Query("offset") offset: Int? = null,
    ): Response<MovementsResponse<MovementResponse>>

    /** Pays (records a payment on) a fixed transaction; responds HTTP 201. */
    @POST("finances/payments")
    suspend fun createPayment(@Body body: CreatePaymentRequest): Response<ApiEnvelope<PaymentResponse>>

    /** Lists payments, optionally by transaction; server default `limit` = 100. */
    @GET("finances/payments")
    suspend fun listPayments(
        /** Hex ObjectId of a fixed transaction. */
        @Query("transaction_id") transactionId: String? = null,
        /** `YYYY-MM-DD`. */
        @Query("start_date") startDate: String? = null,
        /** `YYYY-MM-DD`. */
        @Query("end_date") endDate: String? = null,
        @Query("limit") limit: Int? = null,
    ): Response<ApiList<PaymentResponse>>

    /** Deletes one payment (re-opens the bill for that period). */
    @DELETE("finances/payments/{id}")
    suspend fun deletePayment(@Path("id") id: String): Response<MessageOnly>

    /** Category totals; both `start_date` and `end_date` are REQUIRED (`YYYY-MM-DD`). */
    @GET("finances/summary")
    suspend fun financeSummary(
        /** `YYYY-MM-DD`. */
        @Query("start_date") startDate: String,
        /** `YYYY-MM-DD`. */
        @Query("end_date") endDate: String,
    ): Response<ApiEnvelope<FinanceSummaryResponse>>

    /** Per-month income/outcome aggregates; defaults to the current year. */
    @GET("finances/monthly-stats")
    suspend fun monthlyStats(@Query("year") year: Int? = null): Response<MonthlyStatsResponse>
}
