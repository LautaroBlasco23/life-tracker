package com.lifetracker.feature.finance

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lifetracker.core.network.endpoints.DolarApi
import com.lifetracker.core.network.model.DolarRate
import com.lifetracker.core.network.model.FixedTransactionResponse
import com.lifetracker.core.network.model.FinanceSummaryResponse
import com.lifetracker.core.network.model.MonthlyStats
import com.lifetracker.domain.finance.FinancesRepository
import com.lifetracker.domain.auth.successOrThrow
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.LocalDate
import java.time.ZoneId
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** One dashboard dolar-rate pair (oficial + blue; each null when missing/failed). */
data class DolarRates(
    val oficial: DolarRate? = null,
    val blue: DolarRate? = null,
)

/**
 * Port of the RN `app/(app)/finance/dashboard.tsx` +
 * `components/finance/finance-dashboard.tsx` state:
 * fixed bills (screen-level), summary + monthly stats (dashboard-level, both
 * degrade to empty on failure — no error toast, web parity), and the external
 * dolar rates (each card shows "unavailable" on failure).
 */
@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val repo: FinancesRepository,
    private val dolarApi: DolarApi,
) : ViewModel() {

    private val zone: ZoneId = ZoneId.systemDefault()

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    /** RN `loadFixed` (both the focus effect and the payment-modal refresh). */
    fun loadFixedTransactions(showSpinner: Boolean = false) {
        viewModelScope.launch {
            _uiState.update { if (showSpinner) it.copy(isLoading = true) else it }
            try {
                _uiState.update {
                    it.copy(fixedTransactions = repo.getFixedTransactions(), isLoading = false)
                }
            } catch (_: Exception) {
                // Dashboard summary still renders; fixed list just stays empty.
                _uiState.update { it.copy(isLoading = false, fixedTransactions = emptyList()) }
            }
        }
    }

    /** Summary + monthly stats in parallel (`Promise.all`), silent degradation. */
    fun loadDashboard(date: LocalDate) {
        viewModelScope.launch {
            try {
                val (summary, stats) = coroutineScope {
                    val summaryDeferred = async {
                        monthRange(date).let { (start, end) -> repo.getFinanceSummary(start, end) }
                    }
                    val statsDeferred = async { repo.getMonthlyStats(date.year) }
                    summaryDeferred.await() to statsDeferred.await()
                }
                _uiState.update { it.copy(summary = summary, monthlyStats = stats) }
            } catch (_: Exception) {
                // Dashboard degrades to empty cards.
            }
        }
    }

    /** `fetchDolarRates()` — degrades each cabinet to `null` on any failure. */
    fun loadDolarRates() {
        viewModelScope.launch {
            val rates = runCatching {
                dolarApi.dolares().successOrThrow()
            }.getOrNull()
            _uiState.update {
                it.copy(
                    dolarRates = DolarRates(
                        oficial = rates?.firstOrNull { rate -> rate.casa == "oficial" },
                        blue = rates?.firstOrNull { rate -> rate.casa == "blue" },
                    ),
                )
            }
        }
    }

    /** `currentMonthRange()`: first → last day of the given month (`YYYY-MM-DD`). */
    private fun monthRange(date: LocalDate): Pair<String, String> {
        val month = date.monthValue.toString().padStart(2, '0')
        val lastDay = date.lengthOfMonth()
        return "${date.year}-$month-01" to "${date.year}-$month-${lastDay.toString().padStart(2, '0')}"
    }
}

/** Dashboard screen state (RN useState family of the two finance components). */
data class DashboardUiState(
    val fixedTransactions: List<FixedTransactionResponse> = emptyList(),
    val summary: FinanceSummaryResponse? = null,
    val monthlyStats: List<MonthlyStats> = emptyList(),
    val dolarRates: DolarRates = DolarRates(),
    /** Screen-level full-screen spinner until the fixed list settles. */
    val isLoading: Boolean = true,
)
