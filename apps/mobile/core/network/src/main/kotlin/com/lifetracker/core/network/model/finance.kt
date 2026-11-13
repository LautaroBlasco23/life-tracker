package com.lifetracker.core.network.model

import kotlinx.serialization.Serializable

/**
 * Wire models for the `/finances` routes.
 *
 * Transaction, fixed-transaction and payment IDs are hex ObjectId **strings**
 * (Mongo), while `userId` stays a numeric `Int` (Go `uint`).
 *
 * Every `List` response field is nullable: Go nil slices marshal as JSON
 * `null`, not `[]`. Always null-tolerant on the client.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Raw values are sent/received exactly lowercase (see contract §12). */
@Serializable
enum class TransactionType {
    @kotlinx.serialization.SerialName("income") INCOME,
    @kotlinx.serialization.SerialName("outcome") OUTCOME,
}

/** Raw values are sent/received exactly lowercase (see contract §12). */
@Serializable
enum class TransactionFrequency {
    @kotlinx.serialization.SerialName("fixed") FIXED,
    @kotlinx.serialization.SerialName("variable") VARIABLE,
}

/** Raw values are sent/received exactly lowercase (see contract §12). */
@Serializable
enum class PaymentFrequency {
    @kotlinx.serialization.SerialName("monthly") MONTHLY,
    @kotlinx.serialization.SerialName("bimonthly") BIMONTHLY,
    @kotlinx.serialization.SerialName("yearly") YEARLY,
}

/** `sourceType` of a movement feed entry. */
@Serializable
enum class MovementSourceType {
    @kotlinx.serialization.SerialName("transaction") TRANSACTION,
    @kotlinx.serialization.SerialName("payment") PAYMENT,
    @kotlinx.serialization.SerialName("fixed") FIXED,
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** Body of `POST /finances/transactions`; `amount` is `gte=0`. */
@Serializable
data class CreateTransactionRequest(
    /** RFC3339; the app always fills it with the current instant. */
    val date: String? = null,
    val type: TransactionType,
    val frequency: TransactionFrequency,
    /** Only meaningful when [frequency] is [TransactionFrequency.FIXED]. */
    val paymentFrequency: PaymentFrequency? = null,
    val description: String? = null,
    val amount: Double,
    /** Category *name* (not an id). */
    val category: String,
)

/** Body of `PUT /finances/transactions/{id}` — all fields optional. */
@Serializable
data class UpdateTransactionRequest(
    val date: String? = null,
    val type: TransactionType? = null,
    val frequency: TransactionFrequency? = null,
    val paymentFrequency: PaymentFrequency? = null,
    val description: String? = null,
    val amount: Double? = null,
    val category: String? = null,
)

/** Body of `POST /finances/payments`; `amount` is `> 0`. */
@Serializable
data class CreatePaymentRequest(
    /** Hex ObjectId of the fixed transaction being paid. */
    val transactionId: String,
    val amount: Double,
    /** RFC3339; the app always fills it with the current instant. */
    val date: String? = null,
)

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

/** Item of `GET /finances/transactions` (list envelope) and `GET /finances/transactions/{id}`. */
@Serializable
data class TransactionResponse(
    /** Hex ObjectId string. */
    val id: String,
    val userId: Int,
    val type: TransactionType,
    val frequency: TransactionFrequency,
    /** Absent (or empty) when the transaction is variable. */
    val paymentFrequency: PaymentFrequency? = null,
    val categoryName: String,
    val description: String? = null,
    val amount: Double,
    /** RFC3339 timestamp. */
    val date: String,
    /** RFC3339 timestamp. */
    val createdAt: String,
    /** RFC3339 timestamp. */
    val updatedAt: String,
)

/** Embedded payment brief inside a [FixedTransactionResponse]. */
@Serializable
data class PaymentSummary(
    /** Hex ObjectId string. */
    val id: String,
    val amount: Double,
    /** RFC3339 timestamp. */
    val date: String,
)

/** Item of `GET /finances/fixed-transactions` and `GET /finances/fixed-transactions/{id}` (includes payments). */
@Serializable
data class FixedTransactionResponse(
    /** Hex ObjectId string. */
    val id: String,
    val type: TransactionType,
    val frequency: TransactionFrequency,
    /**
     * Nullable defensively: the backend stores fixed transactions created
     * without `paymentFrequency` as empty string (Go omitempty on the DTO is a
     * non-pointer field), so the wire may emit `""` or omit the key.
     */
    val paymentFrequency: PaymentFrequency? = null,
    val categoryName: String,
    val description: String? = null,
    val totalPaid: Double,
    /** Go nil slice → JSON null when there are no payments yet. */
    val payments: List<PaymentSummary>? = null,
    val currentPeriodPayment: PaymentSummary? = null,
    /** RFC3339 timestamp. */
    val createdAt: String,
    /** RFC3339 timestamp. */
    val updatedAt: String,
)

/** Item of `GET /finances/categories`. */
@Serializable
data class CategoryResponse(
    val name: String,
    val type: TransactionType,
    val icon: String? = null,
    val applicableToFreq: TransactionFrequency,
)

/** Item of `GET /finances/movements` (Movements envelope — carries an extra `total`). */
@Serializable
data class MovementResponse(
    /** Hex ObjectId string. */
    val id: String,
    val sourceType: MovementSourceType,
    val type: TransactionType,
    val amount: Double,
    val category: String,
    val description: String? = null,
    /** RFC3339 timestamp. */
    val date: String,
    /** `false` means a pending bill of a fixed transaction (not yet paid). */
    val paid: Boolean,
    /** Only set when [sourceType] is [MovementSourceType.PAYMENT]. */
    val transactionId: String? = null,
)

/** One category aggregation inside a [FinanceSummaryResponse]. */
@Serializable
data class CategorySummary(
    val categoryName: String,
    val total: Double,
    /** 0–1 ratio. */
    val percentage: Double,
    val count: Long,
)

/** Data of `GET /finances/summary?start_date&end_date` (single envelope). */
@Serializable
data class FinanceSummaryResponse(
    /** Human-readable period label produced by the backend. */
    val period: String,
    /** Go nil slices marshal as JSON `null`. */
    val incomeByCategory: List<CategorySummary>? = null,
    /** Go nil slices marshal as JSON `null`. */
    val outcomeByCategory: List<CategorySummary>? = null,
    val totalIncome: Double,
    val totalOutcome: Double,
    val balance: Double,
)

/**
 * Item of `GET /finances/monthly-stats` (MonthlyStats envelope — carries an
 * extra `year`; see [com.lifetracker.core.network.endpoints.FinancesApi.monthlyStats]).
 */
@Serializable
data class MonthlyStats(
    /** Month name as produced by the backend (e.g. `January`). */
    val month: String,
    val year: Int,
    val totalIncome: Double,
    val totalOutcome: Double,
    val balance: Double,
    val transactionCount: Long,
)

/** Payment record (ObjectId string ids, RFC3339 dates). */
@Serializable
data class PaymentResponse(
    val id: String,
    val transactionId: String,
    val userId: Long? = null,
    val amount: Double,
    val date: String,
    val createdAt: String,
)
