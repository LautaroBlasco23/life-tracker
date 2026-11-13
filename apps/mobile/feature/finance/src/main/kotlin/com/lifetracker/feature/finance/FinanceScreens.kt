package com.lifetracker.feature.finance

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.lifetracker.core.designsystem.AppHeader
import com.lifetracker.core.designsystem.LbButton
import com.lifetracker.core.designsystem.LbButtonVariant
import com.lifetracker.core.designsystem.LbCard
import com.lifetracker.core.designsystem.LbModalSheet
import com.lifetracker.core.designsystem.LbOptionSelect
import com.lifetracker.core.designsystem.LbProgressBar
import com.lifetracker.core.designsystem.LbSelectOption
import com.lifetracker.core.designsystem.LocalAppColors
import com.lifetracker.core.designsystem.ToastHost
import com.lifetracker.core.designsystem.rememberToastState
import com.lifetracker.core.i18n.I18n
import com.lifetracker.core.network.model.CategoryResponse
import com.lifetracker.core.network.model.CategorySummary
import com.lifetracker.core.network.model.DolarRate
import com.lifetracker.core.network.model.FixedTransactionResponse
import com.lifetracker.core.network.model.MovementSourceType
import com.lifetracker.core.network.model.MovementResponse
import com.lifetracker.core.network.model.PaymentFrequency
import com.lifetracker.core.network.model.TransactionType
import com.lifetracker.domain.lib.filters.monthYearOptions
import com.lifetracker.domain.lib.time.getDayKey
import com.lifetracker.domain.lib.time.formatShortDate
import com.lifetracker.domain.time.parseInstant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * `/finance/dashboard` — summary, monthly stats and fixed payments (web
 * parity). Mobile keeps TWO real finance routes (checklist correction): each
 * renders its own `AppHeader`, and the hamburger navigates between them.
 */
@Composable
fun FinanceDashboardScreen(
    onNavigate: (String) -> Unit = {},
    viewModel: DashboardViewModel = hiltViewModel(),
) {
    val colors = LocalAppColors.current
    val toast = rememberToastState()
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var paymentFor by remember { mutableStateOf<FixedTransactionResponse?>(null) }

    // RN `useFocusEffect` + the FinanceDashboard mount effect.
    LaunchedEffect(Unit) {
        viewModel.loadFixedTransactions(showSpinner = true)
        viewModel.loadDashboard(LocalDate.now())
        viewModel.loadDolarRates()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Full-screen spinner until the fixed list settles (web parity).
            AppHeader(
                title = "LifeTracker",
                items = financeNavItems(),
                currentKey = "finance/dashboard",
                onNavigate = onNavigate,
            )
            if (state.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = colors.primary)
                }
            } else {
                DashboardContent(
                    state = state,
                    onRecordPayment = { paymentFor = it },
                )
            }
        }
        ToastHost(state = toast)
    }

    PaymentModal(
        visible = paymentFor != null,
        transaction = paymentFor,
        onClose = { paymentFor = null },
        onSaved = { viewModel.loadFixedTransactions() },
        toast = toast,
    )
}

@Composable
private fun DashboardContent(
    state: DashboardUiState,
    onRecordPayment: (FixedTransactionResponse) -> Unit,
) {
    val colors = LocalAppColors.current
    val now = LocalDate.now()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column {
            Text(
                t("finance.dashboard"),
                fontSize = 24.sp,
                fontWeight = FontWeight.SemiBold,
                color = colors.foreground,
            )
            Text(
                t("finance.description"),
                fontSize = 14.sp,
                color = colors.textMuted,
                modifier = Modifier.padding(top = 4.dp),
            )
        }

        // ---- three summary cards (degrade to $0 on fetch failure) ----
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            SummaryCard(
                label = t("finance.totalIncome"),
                amount = state.summary?.totalIncome ?: 0.0,
                ink = colors.success,
                modifier = Modifier.weight(1f),
            )
            SummaryCard(
                label = t("finance.totalOutcome"),
                amount = state.summary?.totalOutcome ?: 0.0,
                ink = colors.danger,
                modifier = Modifier.weight(1f),
            )
            SummaryCard(
                label = t("finance.balance"),
                amount = state.summary?.balance ?: 0.0,
                ink = if ((state.summary?.balance ?: 0.0) >= 0) colors.success else colors.danger,
                modifier = Modifier.weight(1f),
            )
        }

        // ---- dolar rate cards ("unavailable" on external failure) ----
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            DolarCard(
                label = t("finance.usdOficial"),
                rate = state.dolarRates.oficial,
                modifier = Modifier.weight(1f),
            )
            DolarCard(
                label = t("finance.usdBlue"),
                rate = state.dolarRates.blue,
                modifier = Modifier.weight(1f),
            )
        }

        // ---- monthly trend ----
        LbCard(modifier = Modifier.fillMaxWidth()) {
            Text(
                t("finance.monthlyTrend"),
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = colors.foreground,
            )
            val points = monthlyTrendPoints(state.monthlyStats, now.monthValue)
            if (points.isEmpty()) {
                Text(
                    t("finance.noChartData"),
                    fontSize = 14.sp,
                    color = colors.textMuted,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 24.dp),
                )
            } else {
                MonthlyTrendChart(
                    points = points,
                    incomeColor = colors.success,
                    outcomeColor = colors.danger,
                    gridColor = colors.border,
                    axisLabelColor = colors.textMuted,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .padding(top = 12.dp),
                )
            }
        }

        // ---- category breakdowns ----
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            BreakdownCard(
                title = t("finance.incomeByCategory"),
                items = state.summary?.incomeByCategory.orEmpty(),
                isIncome = true,
                modifier = Modifier.weight(1f),
            )
            BreakdownCard(
                title = t("finance.outcomeByCategory"),
                items = state.summary?.outcomeByCategory.orEmpty(),
                isIncome = false,
                modifier = Modifier.weight(1f),
            )
        }

        // ---- upcoming bills (fixed transactions unpaid this period) ----
        LbCard(modifier = Modifier.fillMaxWidth()) {
            Text(
                t("finance.upcomingBills"),
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = colors.foreground,
            )
            val upcomingBills = state.fixedTransactions.filter { it.currentPeriodPayment == null }
            if (upcomingBills.isEmpty()) {
                Text(
                    t("finance.noUpcomingBills"),
                    fontSize = 14.sp,
                    color = colors.textMuted,
                    modifier = Modifier.padding(top = 12.dp),
                )
            } else {
                Spacer(Modifier.height(12.dp))
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    upcomingBills.forEach { bill ->
                        UpcomingBillRow(bill = bill, onRecordPayment = onRecordPayment)
                    }
                }
            }
        }
    }
}

@Composable
private fun SummaryCard(label: String, amount: Double, ink: Color, modifier: Modifier = Modifier) {
    val colors = LocalAppColors.current
    LbCard(modifier = modifier) {
        Text(
            label,
            fontSize = 12.sp,
            color = colors.textMuted,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            "$${formatCurrency(amount)}",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = ink,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}

@Composable
private fun DolarCard(label: String, rate: DolarRate?, modifier: Modifier = Modifier) {
    val colors = LocalAppColors.current
    LbCard(modifier = modifier) {
        Text(
            label,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = colors.foreground,
            modifier = Modifier.padding(bottom = 8.dp),
        )
        if (rate != null) {
            RateRow(label = t("finance.buy"), value = rate.compra)
            RateRow(label = t("finance.sell"), value = rate.venta, spaced = true)
        } else {
            Text(t("finance.unavailable"), fontSize = 12.sp, color = colors.textMuted)
        }
    }
}

@Composable
private fun RateRow(label: String, value: Double, spaced: Boolean = false) {
    val colors = LocalAppColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = if (spaced) 4.dp else 0.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, fontSize = 12.sp, color = colors.textMuted)
        Text(
            "$${formatCurrency(value)}",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = colors.foreground,
        )
    }
}

@Composable
private fun BreakdownCard(
    title: String,
    items: List<CategorySummary>,
    isIncome: Boolean,
    modifier: Modifier = Modifier,
) {
    val colors = LocalAppColors.current
    val ink = if (isIncome) colors.success else colors.danger
    LbCard(modifier = modifier) {
        Text(
            title,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = colors.foreground,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        if (items.isEmpty()) {
            Text(
                if (isIncome) t("finance.noIncomeCategories") else t("finance.noOutcomeCategories"),
                fontSize = 14.sp,
                color = colors.textMuted,
                modifier = Modifier.padding(top = 12.dp),
            )
        } else {
            Spacer(Modifier.height(12.dp))
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items.forEach { item ->
                    Column {
                        Row(modifier = Modifier.padding(bottom = 4.dp)) {
                            Text(
                                categoryLabel(item.categoryName),
                                fontSize = 14.sp,
                                color = colors.foreground,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f),
                            )
                            Text(
                                "$${formatCurrency(item.total)}",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium,
                                color = ink,
                                modifier = Modifier.padding(start = 8.dp),
                            )
                        }
                        LbProgressBar(value = item.percentage.toInt())
                    }
                }
            }
        }
    }
}

@Composable
private fun UpcomingBillRow(
    bill: FixedTransactionResponse,
    onRecordPayment: (FixedTransactionResponse) -> Unit,
) {
    val colors = LocalAppColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(colors.background)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                categoryLabel(bill.categoryName),
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = colors.foreground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            val description = bill.description
            if (!description.isNullOrEmpty()) {
                Text(
                    description,
                    fontSize = 14.sp,
                    color = colors.textMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Text(
                bill.paymentFrequency?.let { paymentFrequencyLabel(it) }.orEmpty(),
                fontSize = 12.sp,
                color = colors.textMuted,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        LbButton(
            text = t("finance.recordPayment"),
            onClick = { onRecordPayment(bill) },
            modifier = Modifier.padding(start = 12.dp),
        )
    }
}

/// ---------------------------------------------------------------------
/// `/finance/transactions` — movements feed + bills (web parity).
/// ---------------------------------------------------------------------

@Composable
fun FinanceTransactionsScreen(
    onNavigate: (String) -> Unit = {},
    viewModel: TransactionsViewModel = hiltViewModel(),
) {
    val colors = LocalAppColors.current
    val toast = rememberToastState()
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    // Screen-level modal state (RN useState family).
    var showFilterModal by remember { mutableStateOf(false) }
    var showFormModal by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<EditingTransaction?>(null) }
    var paymentFor by remember { mutableStateOf<FixedTransactionResponse?>(null) }
    var deletingMovement by remember { mutableStateOf<MovementResponse?>(null) }
    var deletingFixed by remember { mutableStateOf<FixedTransactionResponse?>(null) }
    var menuMovement by remember { mutableStateOf<MovementResponse?>(null) }
    var menuFixed by remember { mutableStateOf<FixedTransactionResponse?>(null) }

    // RN `useFocusEffect` keyed on the filter: first load + reloads on apply.
    LaunchedEffect(state.filter) {
        viewModel.reload(state.filter)
    }
    // One-shot feedback (load failures) → destructive toast.
    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                TransactionsEvent.LoadFailed -> toast.show(t("finance.loadFailed"), isError = true)
            }
        }
    }

    // Group movements by day for section headers (RN dayGroups loop).
    val dayGroups = remember(state.movements) {
        val zone = ZoneId.systemDefault()
        val groups = mutableListOf<Pair<String, List<MovementResponse>>>()
        for (movement in state.movements) {
            val key = parseInstant(movement.date, zone)?.let { getDayKey(it) } ?: movement.date
            val index = groups.indexOfFirst { it.first == key }
            if (index >= 0) {
                groups[index] = key to groups[index].second + movement
            } else {
                groups.add(key to listOf(movement))
            }
        }
        groups
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            AppHeader(
                title = "LifeTracker",
                items = financeNavItems(),
                currentKey = "finance/transactions",
                onNavigate = onNavigate,
            )
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 96.dp),
            ) {
                // ===================== ListHeaderComponent =====================
                item {
                    Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                        Text(
                            t("finance.movements"),
                            fontSize = 24.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = colors.foreground,
                        )
                        Text(
                            t("finance.description"),
                            fontSize = 14.sp,
                            color = colors.textMuted,
                            modifier = Modifier.padding(top = 4.dp, bottom = 16.dp),
                        )
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.padding(bottom = 12.dp),
                        ) {
                            AlertChip(
                                text = if (state.filter.activeCount > 0) {
                                    "${I18n.t("common.filters")} (${state.filter.activeCount})"
                                } else {
                                    I18n.t("common.filters")
                                },
                                icon = FinanceIcons.SlidersHorizontal,
                                onClick = { showFilterModal = true },
                            )
                            if (state.filter.activeCount > 0) {
                                AlertChip(
                                    text = I18n.t("common.clearAll"),
                                    icon = FinanceIcons.X,
                                    onClick = { viewModel.applyFilter(FinanceFilter()) },
                                )
                            }
                        }
                    }
                }
                // ===================== load / empty states =====================
                if (state.isLoading) {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(top = 40.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            CircularProgressIndicator(color = colors.primary)
                        }
                    }
                } else if (dayGroups.isEmpty()) {
                    item { FeedEmptyState(filtered = state.filter.activeCount > 0) }
                }
                // ===================== day-grouped feed =====================
                dayGroups.forEach { (key, groupMovements) ->
                    item(key = key) {
                        val label = groupMovements.firstOrNull()
                            ?.let { parseInstant(it.date) }
                            ?.let { formatDayLabel(it, ZonedDateTime.now()) }
                            ?: key
                        Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                            Text(
                                label,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium,
                                color = colors.textMuted,
                                modifier = Modifier.padding(top = 8.dp, bottom = 8.dp),
                            )
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                groupMovements.forEach { movement ->
                                    MovementRow(
                                        movement = movement,
                                        onPress = {
                                            // Pending fixed movements open the payment modal.
                                            if (movement.isPending) {
                                                movement.transactionId?.let {
                                                    paymentFor = pendingMovementAsBill(movement)
                                                }
                                            }
                                        },
                                        onLongPress = { menuMovement = movement },
                                    )
                                }
                            }
                        }
                    }
                }
                // ===================== bills footer =====================
                item {
                    BillsFooter(
                        state = state,
                        onPressBill = { paymentFor = it },
                        onLongPressBill = { menuFixed = it },
                    )
                }
            }
        }

        // FAB (create transaction).
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(bottom = 24.dp, end = 20.dp)
                .size(56.dp)
                .clip(CircleShape)
                .background(colors.primary)
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = {
                        editing = null
                        showFormModal = true
                    },
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = FinanceIcons.Plus,
                contentDescription = I18n.t("common.new"),
                tint = colors.primaryForeground,
                modifier = Modifier.size(26.dp),
            )
        }

        ToastHost(state = toast)
    }

    // ---- screen modals (RN renders these at the screen root) ----
    // The RN port renders Alert.alert() menus only with a target; gate them on
    // their state so they never surface empty (a stacked Dialog shows when the
    // screen is re-entered via the drawer otherwise).

    if (menuMovement != null) {
        TransactionActionsModal(
            title = categoryLabel(menuMovement?.category.orEmpty()),
            onClose = { menuMovement = null },
            onEdit = {
                menuMovement?.let { movement ->
                    editing = EditingTransaction(
                        id = movement.id,
                        type = movement.type,
                        isFixed = false,
                        paymentFrequency = null,
                        amount = movement.amount,
                        category = movement.category,
                        description = movement.description,
                    )
                    showFormModal = true
                }
            },
            onDelete = { menuMovement?.let { deletingMovement = it } },
        )
    }

    if (menuFixed != null) {
        TransactionActionsModal(
            title = categoryLabel(menuFixed?.categoryName.orEmpty()),
            onClose = { menuFixed = null },
            onEdit = {
                menuFixed?.let { fixed ->
                    editing = EditingTransaction(
                        id = fixed.id,
                        type = fixed.type,
                        isFixed = true,
                        paymentFrequency = fixed.paymentFrequency,
                        amount = 0.0,
                        category = fixed.categoryName,
                        description = fixed.description,
                    )
                    showFormModal = true
                }
            },
            onDelete = { menuFixed?.let { deletingFixed = it } },
        )
    }

    TransactionFormModal(
        visible = showFormModal,
        onDismiss = {
            showFormModal = false
            editing = null
        },
        transaction = editing,
        categories = state.categories,
        toast = toast,
        onCreate = { type, isFixed, paymentFrequency, amount, category, description, date ->
            viewModel.createTransaction(
                type = type,
                isFixed = isFixed,
                paymentFrequency = paymentFrequency,
                amount = amount,
                category = category,
                description = description,
                date = date,
            )
        },
        onUpdate = { id, type, isFixed, paymentFrequency, amount, category, description ->
            viewModel.updateTransaction(
                id = id,
                type = type,
                isFixed = isFixed,
                paymentFrequency = paymentFrequency,
                amount = amount,
                category = category,
                description = description,
            )
        },
    )

    PaymentModal(
        visible = paymentFor != null,
        transaction = paymentFor,
        onClose = { paymentFor = null },
        onSaved = { viewModel.refreshAfterSave(state.filter) },
        toast = toast,
    )

    val targetMovement = deletingMovement
    FinanceDeleteModal(
        visible = targetMovement != null,
        onDismiss = { deletingMovement = null },
        title = t("finance.deleteTransaction"),
        itemName = targetMovement?.category.orEmpty(),
        confirmLabel = t("finance.deleteTransaction"),
        details = if (targetMovement != null) {
            {
                MovementDeleteDetails(
                    category = targetMovement.category,
                    description = targetMovement.description,
                    type = targetMovement.type,
                    amount = targetMovement.amount,
                )
            }
        } else {
            null
        },
        onConfirm = {
            val error = targetMovement?.let { viewModel.deleteMovement(it) } ?: return@FinanceDeleteModal null
            if (error == null) {
                toast.show(
                    toastText(t("finance.transactionDeleted"), t("finance.transactionDeletedDescription")),
                )
            } else {
                toast.show(toastText(t("finance.deleteFailed"), error), isError = true)
            }
            error
        },
    )

    val targetFixed = deletingFixed
    FinanceDeleteModal(
        visible = targetFixed != null,
        onDismiss = { deletingFixed = null },
        title = t("finance.deleteTransaction"),
        itemName = targetFixed?.categoryName.orEmpty(),
        confirmLabel = t("finance.deleteTransaction"),
        details = if (targetFixed != null) {
            {
                FixedDeleteDetails(
                    category = targetFixed.categoryName,
                    description = targetFixed.description,
                    paymentFrequency = targetFixed.paymentFrequency,
                )
            }
        } else {
            null
        },
        onConfirm = {
            val error = targetFixed?.let { viewModel.deleteFixed(it) } ?: return@FinanceDeleteModal null
            if (error == null) {
                toast.show(
                    toastText(t("finance.transactionDeleted"), t("finance.transactionDeletedDescription")),
                )
            } else {
                toast.show(toastText(t("finance.deleteFailed"), error), isError = true)
            }
            error
        },
    )

    FinanceFilterModal(
        visible = showFilterModal,
        currentFilter = state.filter,
        categories = state.categories,
        onApply = viewModel::applyFilter,
        onDismiss = { showFilterModal = false },
    )
}

/// ---------------------------------------------------------------------
/// Movements feed pieces
/// ---------------------------------------------------------------------

private val MovementResponse.isPending: Boolean
    get() = !paid && sourceType == MovementSourceType.FIXED

/** RN `handlePendingMovement`: opens the payment modal for the pending bill. */
private fun pendingMovementAsBill(movement: MovementResponse): FixedTransactionResponse? =
    movement.transactionId?.let { transactionId ->
        FixedTransactionResponse(
            id = transactionId,
            type = movement.type,
            frequency = com.lifetracker.core.network.model.TransactionFrequency.FIXED,
            paymentFrequency = null,
            categoryName = movement.category,
            description = movement.description,
            totalPaid = 0.0,
            payments = null,
            currentPeriodPayment = null,
            createdAt = movement.date,
            updatedAt = movement.date,
        )
    }

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MovementRow(
    movement: MovementResponse,
    onPress: () -> Unit,
    onLongPress: () -> Unit,
) {
    val colors = LocalAppColors.current
    val isIncome = movement.type == TransactionType.INCOME
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .border(1.dp, colors.border, RoundedCornerShape(12.dp))
            .background(colors.surface)
            .combinedClickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = if (movement.isPending) onPress else {
                    {}
                },
                onLongClick = onLongPress,
            )
            .padding(16.dp),
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
            Text(
                categoryLabel(movement.category),
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                color = colors.foreground,
            )
            val description = movement.description
            if (!description.isNullOrEmpty()) {
                Text(
                    description,
                    fontSize = 14.sp,
                    color = colors.textMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Text(
                text = buildString {
                    val date = parseInstant(movement.date) ?: return@buildString
                    append(formatShortDate(date))
                    if (movement.isPending) append(" · ${I18n.t("social.pending")}")
                },
                fontSize = 12.sp,
                color = colors.textMuted,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        Text(
            text = "${if (isIncome) "+" else "−"}$${formatCurrency(movement.amount)}",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (isIncome) colors.success else colors.danger,
        )
    }
}

@Composable
private fun FeedEmptyState(filtered: Boolean) {
    val colors = LocalAppColors.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 40.dp, start = 24.dp, end = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            if (filtered) t("finance.noTransactionsMatch") else t("finance.noMovementsYet"),
            fontSize = 18.sp,
            fontWeight = FontWeight.Medium,
            color = colors.foreground,
            textAlign = TextAlign.Center,
        )
        Text(
            if (filtered) t("finance.tryAdjusting") else t("finance.movementsGetStarted"),
            fontSize = 14.sp,
            color = colors.textMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}

/** Bills section footer: per-type accent blocks + bill rows + empty states. */
@Composable
private fun BillsFooter(
    state: TransactionsUiState,
    onPressBill: (FixedTransactionResponse) -> Unit,
    onLongPressBill: (FixedTransactionResponse) -> Unit,
) {
    val colors = LocalAppColors.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
    ) {
        Text(
            t("finance.bills"),
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold,
            color = colors.foreground,
        )
        Text(
            t("finance.billsSubtitle"),
            fontSize = 14.sp,
            color = colors.textMuted,
            modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
        )
        listOf(TransactionType.INCOME, TransactionType.OUTCOME).forEach { type ->
            val list = state.fixedTransactions.filter { it.type == type }
            if (list.isNotEmpty()) {
                val accentColor = if (type == TransactionType.INCOME) colors.success else colors.danger
                val icon = if (type == TransactionType.INCOME) FinanceIcons.TrendingUp else FinanceIcons.TrendingDown
                val labelKey = if (type == TransactionType.INCOME) "finance.income" else "finance.expenses"
                val paidCount = list.count { it.currentPeriodPayment != null }
                val totalThisPeriod = list.sumOf { it.currentPeriodPayment?.amount ?: 0.0 }
                Column(modifier = Modifier.padding(top = 8.dp)) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .size(width = 4.dp, height = 48.dp)
                                .background(accentColor),
                        )
                        Icon(
                            imageVector = icon,
                            contentDescription = null,
                            tint = accentColor,
                            modifier = Modifier.size(22.dp),
                        )
                        Text(
                            I18n.t(labelKey),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = colors.foreground,
                            modifier = Modifier.weight(1f),
                        )
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                "$${formatCurrency(totalThisPeriod)}",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = accentColor,
                            )
                            Text(
                                "${list.size} · $paidCount/${list.size} ${t("finance.paid")}",
                                fontSize = 14.sp,
                                color = colors.textMuted,
                            )
                        }
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        list.forEach { bill ->
                            BillRow(
                                bill = bill,
                                onPress = { onPressBill(bill) },
                                onLongPress = { onLongPressBill(bill) },
                            )
                        }
                    }
                    Spacer(Modifier.height(24.dp))
                }
            }
        }
        if (state.fixedTransactions.isEmpty()) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 24.dp),
            ) {
                Text(
                    t("finance.noBillsYet"),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    color = colors.foreground,
                )
                Text(
                    t("finance.noBillsYetDescription"),
                    fontSize = 14.sp,
                    color = colors.textMuted,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun BillRow(
    bill: FixedTransactionResponse,
    onPress: () -> Unit,
    onLongPress: () -> Unit,
) {
    val colors = LocalAppColors.current
    val isPaid = bill.currentPeriodPayment != null
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .border(1.dp, colors.border, RoundedCornerShape(12.dp))
            .background(colors.surface)
            .combinedClickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onPress,
                onLongClick = onLongPress,
            )
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
            Text(
                categoryLabel(bill.categoryName),
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                color = colors.foreground,
            )
            val description = bill.description
            if (!description.isNullOrEmpty()) {
                Text(
                    description,
                    fontSize = 14.sp,
                    color = colors.textMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Text(
                "${t("finance.thisPeriod")}: $${formatCurrency(bill.currentPeriodPayment?.amount ?: 0.0)}",
                fontSize = 12.sp,
                color = colors.textMuted,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(
                imageVector = FinanceIcons.AlertTriangle,
                contentDescription = null,
                tint = if (isPaid) colors.success else colors.warning,
                modifier = Modifier.size(14.dp),
            )
            Text(
                if (isPaid) t("finance.paid") else I18n.t("social.pending"),
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = if (isPaid) colors.success else colors.warning,
            )
        }
    }
}

@Composable
private fun AlertChip(
    text: String,
    icon: ImageVector,
    onClick: () -> Unit,
) {
    val colors = LocalAppColors.current
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .border(1.dp, colors.border, RoundedCornerShape(8.dp))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick,
            )
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = colors.primary,
            modifier = Modifier.size(14.dp),
        )
        Text(text, fontSize = 14.sp, color = colors.foreground)
    }
}

/// ---------------------------------------------------------------------
/// Filter modal (month / year / category) — RN shared FilterModal port.
/// ---------------------------------------------------------------------

@Composable
internal fun FinanceFilterModal(
    visible: Boolean,
    currentFilter: FinanceFilter,
    categories: List<CategoryResponse>,
    onApply: (FinanceFilter) -> Unit,
    onDismiss: () -> Unit,
) {
    val options = monthYearOptions(
        tMonths = { key -> I18n.t("months.$key") },
        now = remember(visible) { LocalDate.now() },
    )
    var draftMonth by remember { mutableStateOf<String?>(null) }
    var draftYear by remember { mutableStateOf<String?>(null) }
    var draftCategory by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(visible) {
        if (visible) {
            draftMonth = currentFilter.month?.toString()
            draftYear = currentFilter.year?.toString()
            draftCategory = currentFilter.category
        }
    }
    val draftActive = draftMonth != null || draftYear != null || draftCategory != null

    LbModalSheet(visible = visible, onDismiss = onDismiss, title = t("finance.filterTransactions")) {
        Column {
            LbOptionSelect(
                label = t("finance.month"),
                options = listOf(LbSelectOption("", t("finance.allMonths"))) +
                    options.monthOptions.map { LbSelectOption(it.value, it.label) },
                selected = draftMonth.orEmpty(),
                onSelect = { value -> draftMonth = value.takeUnless { it.isEmpty() } },
                placeholder = t("finance.allMonths"),
            )
            FormSpacer()
            LbOptionSelect(
                label = t("finance.year"),
                options = listOf(LbSelectOption("", t("finance.allYears"))) +
                    options.yearOptions.map { LbSelectOption(it.value, it.label) },
                selected = draftYear.orEmpty(),
                onSelect = { value -> draftYear = value.takeUnless { it.isEmpty() } },
                placeholder = t("finance.allYears"),
            )
            FormSpacer()
            LbOptionSelect(
                label = t("finance.category"),
                options = listOf(LbSelectOption("", t("finance.allCategories"))) +
                    categories.map { LbSelectOption(it.name, it.name) },
                selected = draftCategory.orEmpty(),
                onSelect = { value -> draftCategory = value.takeUnless { it.isEmpty() } },
                placeholder = t("finance.allCategories"),
            )

            Row(
                modifier = Modifier.padding(top = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (draftActive) {
                    LbButton(
                        text = I18n.t("filterModal.reset"),
                        onClick = {
                            draftMonth = null
                            draftYear = null
                            draftCategory = null
                        },
                        variant = LbButtonVariant.GHOST,
                    )
                }
                LbButton(
                    text = I18n.t("filterModal.applyFilters"),
                    onClick = {
                        onApply(
                            FinanceFilter(
                                month = draftMonth?.toIntOrNull(),
                                year = draftYear?.toIntOrNull(),
                                category = draftCategory,
                            ),
                        )
                        onDismiss()
                    },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

/// ---------------------------------------------------------------------
/// Delete-modal detail boxes
/// ---------------------------------------------------------------------

@Composable
private fun MovementDeleteDetails(
    category: String,
    description: String?,
    type: TransactionType,
    amount: Double,
) {
    val colors = LocalAppColors.current
    Column {
        Text(category, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = colors.foreground)
        Text(
            buildString {
                if (!description.isNullOrEmpty()) append("$description\n")
                append(type.name.lowercase())
                append(" · $${formatCurrency(amount)}")
            },
            fontSize = 12.sp,
            color = colors.textMuted,
        )
    }
}

@Composable
private fun FixedDeleteDetails(
    category: String,
    description: String?,
    paymentFrequency: PaymentFrequency?,
) {
    val colors = LocalAppColors.current
    Column {
        Text(category, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = colors.foreground)
        Text(
            buildString {
                if (!description.isNullOrEmpty()) append("$description\n")
                append(paymentFrequency ?: "")
            },
            fontSize = 12.sp,
            color = colors.textMuted,
        )
    }
}
