package com.lifetracker.feature.finance

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lifetracker.core.network.model.CategoryResponse
import com.lifetracker.core.network.model.CreateTransactionRequest
import com.lifetracker.core.network.model.FixedTransactionResponse
import com.lifetracker.core.network.model.MovementResponse
import com.lifetracker.core.network.model.PaymentFrequency
import com.lifetracker.core.network.model.TransactionFrequency
import com.lifetracker.core.network.model.TransactionType
import com.lifetracker.core.network.model.UpdateTransactionRequest
import com.lifetracker.domain.finance.FinancesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Filter modal result (month/year/category option values; null = all). */
data class FinanceFilter(
    val month: Int? = null,
    val year: Int? = null,
    val category: String? = null,
) {
    val activeCount: Int get() = listOf(month, year, category).count { it != null }
}

/**
 * Port of the RN `app/(app)/finance/transactions.tsx` state: the movements
 * feed (30/page, offset paged), fixed bills, category catalog, and the
 * optimistic delete flows (movement + bill) with snapshot revert.
 */
@HiltViewModel
class TransactionsViewModel @Inject constructor(
    private val repo: FinancesRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(TransactionsUiState())
    val uiState: StateFlow<TransactionsUiState> = _uiState.asStateFlow()

    /** Screen-side feedback: the `loadFailed` / delete-failure toasts. */
    private val _events = MutableSharedFlow<TransactionsEvent>(extraBufferCapacity = 16)
    val events: SharedFlow<TransactionsEvent> = _events.asSharedFlow()

    /**
     * RN `useFocusEffect` on filter focus: movements reload (first page),
     * fixed bills and categories fetch. `isLoading` resets the list spinner.
     */
    fun reload(filter: FinanceFilter) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, filter = filter) }
            try {
                val (movements, fixed) = coroutineScope {
                    val movementsDeferred = async {
                        repo.getMovements(
                            category = filter.category,
                            month = filter.month,
                            year = filter.year,
                            limit = PAGE_SIZE,
                            offset = 0,
                        )
                    }
                    val fixedDeferred = async { repo.getFixedTransactions() }
                    movementsDeferred.await() to fixedDeferred.await()
                }
                _uiState.update {
                    it.copy(
                        movements = movements.data,
                        total = movements.total,
                        fixedTransactions = fixed,
                        isLoading = false,
                        isLoadingMore = false,
                    )
                }
            } catch (_: Exception) {
                _events.tryEmit(TransactionsEvent.LoadFailed)
                _uiState.update { it.copy(isLoading = false, isLoadingMore = false) }
            }
            // Categories fail silently (RN `.catch(() => undefined)`).
            runCatching { repo.getCategories() }.onSuccess { categories ->
                _uiState.update { it.copy(categories = categories) }
            }
        }
    }

    /** RN `loadMore`: appends the next page until `movements.length >= total`. */
    fun loadNextPage() {
        val state = _uiState.value
        if (state.isLoadingMore || state.movements.size >= state.total) return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingMore = true) }
            try {
                val page = repo.getMovements(
                    category = state.filter.category,
                    month = state.filter.month,
                    year = state.filter.year,
                    limit = PAGE_SIZE,
                    offset = state.movements.size,
                )
                _uiState.update {
                    it.copy(movements = it.movements + page.data, total = page.total, isLoadingMore = false)
                }
            } catch (_: Exception) {
                _events.tryEmit(TransactionsEvent.LoadFailed)
                _uiState.update { it.copy(isLoadingMore = false) }
            }
        }
    }

    /** RN `handleDeleteMovement`: optimistic local removal, reverted on failure. */
    suspend fun deleteMovement(movement: MovementResponse): String? {
        val snapshot = _uiState.value.movements
        _uiState.update { it.copy(movements = snapshot.filterNot { it.id == movement.id }) }
        return runCatching { repo.deleteTransaction(movement.id) }.fold(
            onSuccess = {
                _uiState.update { it.copy(total = maxOf(0, it.total - 1)) }
                null
            },
            onFailure = { error ->
                _uiState.update { it.copy(movements = snapshot) }
                error.message ?: "An error occurred"
            },
        )
    }

    /** RN `handleDeleteFixed`: optimistic, snapshot-reverted. */
    suspend fun deleteFixed(fixed: FixedTransactionResponse): String? {
        val snapshot = _uiState.value.fixedTransactions
        _uiState.update { it.copy(fixedTransactions = snapshot.filterNot { it.id == fixed.id }) }
        return runCatching { repo.deleteTransaction(fixed.id) }.fold(
            onSuccess = { null },
            onFailure = { error ->
                _uiState.update { it.copy(fixedTransactions = snapshot) }
                error.message ?: "An error occurred"
            },
        )
    }

    /** RN `handleApplyFilter`; the focus effect reloads on the change. */
    fun applyFilter(filter: FinanceFilter) {
        _uiState.update { it.copy(filter = filter) }
    }

    /** RN form-modal create path; a successful save reloads movements + bills. */
    suspend fun createTransaction(
        type: TransactionType,
        isFixed: Boolean,
        paymentFrequency: PaymentFrequency?,
        amount: Double,
        category: String,
        description: String?,
        date: String,
    ): String? =
        runCatching {
            repo.createTransaction(
                CreateTransactionRequest(
                    date = date,
                    type = type,
                    frequency = if (isFixed) TransactionFrequency.FIXED else TransactionFrequency.VARIABLE,
                    paymentFrequency = paymentFrequency,
                    description = description,
                    amount = amount,
                    category = category,
                ),
            )
        }.fold(
            onSuccess = {
                reload(_uiState.value.filter)
                null
            },
            onFailure = { error -> error.message ?: "An error occurred" },
        )

    /** RN form-modal update path (fixed edits keep amount 0, no date). */
    suspend fun updateTransaction(
        id: String,
        type: TransactionType,
        isFixed: Boolean,
        paymentFrequency: PaymentFrequency?,
        amount: Double,
        category: String,
        description: String?,
    ): String? =
        runCatching {
            repo.updateTransaction(
                id = id,
                request = UpdateTransactionRequest(
                    type = type,
                    frequency = if (isFixed) TransactionFrequency.FIXED else TransactionFrequency.VARIABLE,
                    paymentFrequency = paymentFrequency,
                    description = description,
                    amount = amount,
                    category = category,
                ),
            )
        }.fold(
            onSuccess = {
                reload(_uiState.value.filter)
                null
            },
            onFailure = { error -> error.message ?: "An error occurred" },
        )

    /** Post-save/payment refresh (RN `onSaved`): movements + bills reload. */
    fun refreshAfterSave(filter: FinanceFilter) {
        reload(filter)
    }

    companion object {
        /** RN `PAGE_SIZE` for the movements feed. */
        const val PAGE_SIZE = 30
    }
}

/** Screen state, ported from the RN useState family. */
data class TransactionsUiState(
    val movements: List<MovementResponse> = emptyList(),
    val total: Int = 0,
    val fixedTransactions: List<FixedTransactionResponse> = emptyList(),
    val categories: List<CategoryResponse> = emptyList(),
    val isLoading: Boolean = true,
    val isLoadingMore: Boolean = false,
    val filter: FinanceFilter = FinanceFilter(),
)

/** One-shot feedback consumed by the screen root and mapped to toasts. */
sealed interface TransactionsEvent {
    data object LoadFailed : TransactionsEvent
}
