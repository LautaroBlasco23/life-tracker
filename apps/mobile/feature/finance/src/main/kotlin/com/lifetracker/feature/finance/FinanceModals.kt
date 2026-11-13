package com.lifetracker.feature.finance

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.lifetracker.core.designsystem.LbButton
import com.lifetracker.core.designsystem.LbButtonVariant
import com.lifetracker.core.designsystem.LbModalSheet
import com.lifetracker.core.designsystem.LbOptionSelect
import com.lifetracker.core.designsystem.LbSelectOption
import com.lifetracker.core.designsystem.LbTextField
import com.lifetracker.core.designsystem.LocalAppColors
import com.lifetracker.core.designsystem.ToastState
import com.lifetracker.core.i18n.I18n
import com.lifetracker.core.network.model.CategoryResponse
import com.lifetracker.core.network.model.CreatePaymentRequest
import com.lifetracker.core.network.model.FixedTransactionResponse
import com.lifetracker.core.network.model.PaymentFrequency
import com.lifetracker.core.network.model.PaymentSummary
import com.lifetracker.core.network.model.TransactionType
import com.lifetracker.domain.finance.FinancesRepository
import com.lifetracker.domain.lib.time.formatShortDate
import com.lifetracker.domain.time.parseInstant
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.ZoneId
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/// ---------------------------------------------------------------------
/// Long-press transaction menu (RN `Alert.alert(category, undefined, […])`).
/// ---------------------------------------------------------------------

@Composable
internal fun TransactionActionsModal(
    title: String,
    onClose: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    val colors = LocalAppColors.current
    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Column(
            modifier = Modifier
                .padding(horizontal = 24.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(colors.background)
                .padding(20.dp),
        ) {
            Text(
                text = title,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = colors.foreground,
                maxLines = 1,
                modifier = Modifier.padding(bottom = 12.dp),
            )
            listOf(
                ActionRow(label = I18n.t("common.edit"), ink = colors.primary) { onEdit(); onClose() },
                ActionRow(label = t("finance.deleteTransaction"), ink = colors.danger) { onDelete(); onClose() },
                ActionRow(label = I18n.t("common.cancel"), ink = colors.textMuted) { onClose() },
            ).forEach { content -> content() }
        }
    }
}

private fun ActionRow(
    label: String,
    ink: Color,
    onClick: () -> Unit,
): @Composable () -> Unit = {
    val colors = LocalAppColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .border(1.dp, colors.border, RoundedCornerShape(8.dp))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick,
            )
            .padding(vertical = 14.dp, horizontal = 16.dp),
    ) {
        Text(label, fontSize = 16.sp, fontWeight = FontWeight.Medium, color = ink)
    }
}

/// ---------------------------------------------------------------------
/// Delete confirm — port of `components/ui/delete-modal.tsx` with the live
/// details slot (the movement/bill/payment variants differ).
/// ---------------------------------------------------------------------

@Composable
internal fun FinanceDeleteModal(
    visible: Boolean,
    onDismiss: () -> Unit,
    title: String,
    itemName: String,
    details: (@Composable () -> Unit)?,
    confirmLabel: String = I18n.t("finance.deleteTransaction"),
    onConfirm: suspend () -> String?,
) {
    if (!visible) return
    val colors = LocalAppColors.current
    var isDeleting by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(
            modifier = Modifier
                .padding(horizontal = 24.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(colors.background)
                .padding(20.dp),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(bottom = 16.dp),
            ) {
                androidx.compose.foundation.layout.Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(colors.danger.copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = FinanceIcons.AlertTriangle,
                        contentDescription = null,
                        tint = colors.danger,
                        modifier = Modifier.size(18.dp),
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(title, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = colors.foreground)
                    Text(
                        I18n.t("deleteModal.cannotBeUndone"),
                        fontSize = 13.sp,
                        color = colors.textMuted,
                    )
                }
            }
            Text(
                t("deleteModal.areYouSure", "name" to itemName),
                fontSize = 14.sp,
                color = colors.textMuted,
                modifier = Modifier.padding(bottom = 12.dp),
            )
            if (details != null) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .border(1.dp, colors.border, RoundedCornerShape(8.dp))
                        .background(colors.surface)
                        .padding(12.dp),
                ) {
                    details()
                }
            }
            Row(
                modifier = Modifier.padding(top = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                LbButton(
                    text = I18n.t("common.cancel"),
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f),
                    variant = LbButtonVariant.SECONDARY,
                    enabled = !isDeleting,
                )
                LbButton(
                    text = confirmLabel,
                    onClick = {
                        if (!isDeleting) {
                            scope.launch {
                                isDeleting = true
                                val error = onConfirm()
                                isDeleting = false
                                // Deleting errors keep the modal open (RN parity).
                                if (error == null) onDismiss()
                            }
                        }
                    },
                    modifier = Modifier.weight(1f),
                    variant = LbButtonVariant.DANGER,
                    enabled = !isDeleting,
                    loading = isDeleting,
                )
            }
        }
    }
}

/// ---------------------------------------------------------------------
/// Transaction form (create/edit) — RN `transaction-form-modal.tsx`.
/// ---------------------------------------------------------------------

/** Snapshot the RN screen builds when long-pressing a movement / fixed bill. */
internal data class EditingTransaction(
    val id: String,
    val type: TransactionType,
    val isFixed: Boolean,
    val paymentFrequency: PaymentFrequency?,
    val amount: Double,
    val category: String,
    val description: String?,
)

private val PAYMENT_FREQUENCIES = listOf(
    PaymentFrequency.MONTHLY,
    PaymentFrequency.BIMONTHLY,
    PaymentFrequency.YEARLY,
)

/** `translatePaymentFrequency` (createTransaction namespace). */
internal fun paymentFrequencyLabel(frequency: PaymentFrequency): String = I18n.t(
    when (frequency) {
        PaymentFrequency.MONTHLY -> "createTransaction.monthly"
        PaymentFrequency.BIMONTHLY -> "createTransaction.bimonthly"
        PaymentFrequency.YEARLY -> "createTransaction.yearly"
    }
)

@Composable
internal fun TransactionFormModal(
    visible: Boolean,
    onDismiss: () -> Unit,
    /** Set when editing an existing transaction; null creates one. */
    transaction: EditingTransaction?,
    categories: List<CategoryResponse>,
    toast: ToastState,
    onCreate: suspend (
        type: TransactionType,
        isFixed: Boolean,
        paymentFrequency: PaymentFrequency?,
        amount: Double,
        category: String,
        description: String?,
        date: String,
    ) -> String?,
    onUpdate: suspend (
        id: String,
        type: TransactionType,
        isFixed: Boolean,
        paymentFrequency: PaymentFrequency?,
        amount: Double,
        category: String,
        description: String?,
    ) -> String?,
) {
    val isEdit = transaction != null
    val colors = LocalAppColors.current

    var type by remember { mutableStateOf(TransactionType.OUTCOME) }
    var isFixed by remember { mutableStateOf(false) }
    var paymentFrequency by remember { mutableStateOf(PaymentFrequency.MONTHLY) }
    var amount by remember { mutableStateOf("") }
    var category by remember { mutableStateOf<String?>(null) }
    var description by remember { mutableStateOf("") }
    var date by remember { mutableStateOf(todayInput()) }
    var isSaving by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    // RN prefills on every open (create resets, edit takes the target's fields).
    LaunchedEffect(visible) {
        if (!visible) return@LaunchedEffect
        if (transaction != null) {
            type = transaction.type
            isFixed = transaction.isFixed
            paymentFrequency = transaction.paymentFrequency ?: PaymentFrequency.MONTHLY
            amount = if (!transaction.isFixed && transaction.amount > 0) {
                formatInputValue(transaction.amount.toString())
            } else {
                ""
            }
            category = transaction.category
            description = transaction.description.orEmpty()
        } else {
            type = TransactionType.OUTCOME
            isFixed = false
            paymentFrequency = PaymentFrequency.MONTHLY
            amount = ""
            category = null
            description = ""
            date = todayInput()
        }
    }

    val dialogTitle = when {
        isEdit -> t("finance.updateTransaction")
        isFixed -> I18n.t("createTransaction.titleFixed")
        else -> I18n.t("createTransaction.titleNew")
    }

    // ---- validation / save-failure alert (RN `Alert.alert`) ----
    var alertTitle by remember { mutableStateOf<String?>(null) }
    var alertMessage by remember { mutableStateOf<String?>(null) }
    if (alertTitle != null) {
        AlertDialog(
            onDismissRequest = { alertTitle = null; alertMessage = null },
            confirmButton = {
                TextButton(
                    onClick = { alertTitle = null; alertMessage = null },
                ) { Text(I18n.t("common.cancel")) }
            },
            title = {
                Text(alertTitle.orEmpty(), color = colors.foreground, fontWeight = FontWeight.SemiBold)
            },
            text = { Text(alertMessage.orEmpty(), color = colors.textMuted, fontSize = 14.sp) },
        )
    }

    LbModalSheet(visible = visible, onDismiss = onDismiss, title = dialogTitle) {
        Column(
            // Same cap + scroll as the other ported forms (RN max-h-[90%] sheet).
            modifier = Modifier
                .heightIn(max = 560.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            LbOptionSelect(
                label = I18n.t("createTransaction.type"),
                options = listOf(
                    LbSelectOption(TransactionType.OUTCOME, I18n.t("createTransaction.expense")),
                    LbSelectOption(TransactionType.INCOME, I18n.t("createTransaction.income")),
                ),
                selected = type,
                onSelect = { type = it },
            )
            FormSpacer()
            LbOptionSelect(
                label = I18n.t("createTransaction.frequency"),
                options = listOf(
                    LbSelectOption(false, I18n.t("createTransaction.variable")),
                    LbSelectOption(true, I18n.t("createTransaction.fixed")),
                ),
                selected = isFixed,
                onSelect = { isFixed = it },
            )
            if (isFixed) {
                FormSpacer()
                LbOptionSelect(
                    label = I18n.t("createTransaction.paymentFrequency"),
                    options = PAYMENT_FREQUENCIES.map { freq ->
                        LbSelectOption(freq, paymentFrequencyLabel(freq))
                    },
                    selected = paymentFrequency,
                    onSelect = { paymentFrequency = it },
                )
            }
            if (!isFixed) {
                FormSpacer()
                LbTextField(
                    value = amount,
                    onValueChange = { amount = formatInputValue(it) },
                    label = I18n.t("createTransaction.amount"),
                    placeholder = "0",
                    keyboardType = androidx.compose.ui.text.input.KeyboardType.Number,
                )
                FormSpacer()
                LbTextField(
                    value = date,
                    onValueChange = { date = it },
                    label = I18n.t("createTransaction.date"),
                    placeholder = "YYYY-MM-DD",
                )
            }
            FormSpacer()
            LbOptionSelect(
                label = I18n.t("createTransaction.category"),
                // RN: the type select filters the category options.
                options = categories
                    .filter { it.type == type }
                    .map { LbSelectOption(it.name, it.name) },
                selected = category,
                onSelect = { category = it },
                placeholder = I18n.t("createTransaction.selectCategory"),
            )
            FormSpacer()
            LbTextField(
                value = description,
                onValueChange = { description = it },
                label = I18n.t("createTransaction.descriptionLabel"),
                placeholder = I18n.t("createTransaction.descriptionPlaceholder"),
            )

            Row(
                modifier = Modifier.padding(top = 20.dp, bottom = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                LbButton(
                    text = I18n.t("common.cancel"),
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f),
                    variant = LbButtonVariant.SECONDARY,
                    enabled = !isSaving,
                )
                LbButton(
                    text = if (isEdit) I18n.t("common.save") else I18n.t("common.creating"),
                    onClick = {
                        if (isSaving) return@LbButton
                        scope.launch {
                            // ---- validation order matches the RN modal ----
                            val chosenCategory = category
                            if (chosenCategory == null) {
                                alertTitle = I18n.t("createTransaction.validationError")
                                alertMessage = I18n.t("createTransaction.selectCategoryError")
                                return@launch
                            }
                            val amountValue = if (isFixed) 0.0 else parseInputValue(amount).toDoubleOrNull()
                            if (!isFixed && (amountValue == null || amountValue <= 0)) {
                                alertTitle = I18n.t("createTransaction.validationError")
                                alertMessage = I18n.t("createTransaction.invalidAmountError")
                                return@launch
                            }
                            isSaving = true
                            val error = if (transaction != null) {
                                onUpdate(
                                    transaction.id,
                                    type,
                                    isFixed,
                                    if (isFixed) paymentFrequency else null,
                                    amountValue ?: 0.0,
                                    chosenCategory,
                                    description.trim().takeIf { it.isNotEmpty() },
                                )
                            } else {
                                onCreate(
                                    type,
                                    isFixed,
                                    if (isFixed) paymentFrequency else null,
                                    amountValue ?: 0.0,
                                    chosenCategory,
                                    description.trim().takeIf { it.isNotEmpty() },
                                    dateInputToISO(date),
                                )
                            }
                            isSaving = false
                            if (error == null) {
                                onDismiss()
                            } else {
                                // Generic error alert; the modal stays open (RN parity).
                                alertTitle = I18n.t("common.error")
                                alertMessage = error
                            }
                        }
                    },
                    modifier = Modifier.weight(1f),
                    enabled = !isSaving,
                    loading = isSaving,
                )
            }
        }
    }
}

/** Vertical rhythm used across the form rows (RN `h-4` gap). */
@Composable
internal fun FormSpacer() {
    Spacer(Modifier.padding(vertical = 8.dp))
}

/// ---------------------------------------------------------------------
/// Payment modal — RN `payment-modal.tsx` + its Hilt model.
/// ---------------------------------------------------------------------

/**
 * Modal-scoped state holder: fixed-bill details (payments + total paid),
 * record flow, and the optimistic-revert payment deletion.
 */
@HiltViewModel
class PaymentViewModel @Inject constructor(
    private val repo: FinancesRepository,
) : ViewModel() {

    private val _payments = MutableStateFlow<List<PaymentSummary>>(emptyList())
    val payments: StateFlow<List<PaymentSummary>> = _payments

    private val _totalPaid = MutableStateFlow(0.0)
    val totalPaid: StateFlow<Double> = _totalPaid

    private val _isLoadingDetails = MutableStateFlow(false)
    val isLoadingDetails: StateFlow<Boolean> = _isLoadingDetails

    private val _isRecording = MutableStateFlow(false)
    val isRecording: StateFlow<Boolean> = _isRecording

    /** Loads the bill with its payment history (RN open effect). */
    fun loadPayments(fixedId: String) {
        viewModelScope.launch {
            _isLoadingDetails.value = true
            try {
                val details = repo.getFixedTransactionWithPayments(fixedId)
                _payments.value = details.payments.orEmpty()
                _totalPaid.value = details.totalPaid
            } catch (_: Exception) {
                // The caller toasts the generic error (RN parity).
            } finally {
                _isLoadingDetails.value = false
            }
        }
    }

    /** `null` on success; otherwise the error message for the modal toast. */
    suspend fun recordPayment(fixedId: String, amount: Double, date: String): String? {
        _isRecording.value = true
        try {
            return runCatching {
                repo.createPayment(
                    CreatePaymentRequest(transactionId = fixedId, amount = amount, date = date),
                )
            }.fold(
                onSuccess = { null },
                onFailure = { error -> error.message ?: "An error occurred" },
            )
        } finally {
            _isRecording.value = false
        }
    }

    /**
     * RN delete-payment: optimistic row removal + total-paid decrement, both
     * restored on failure (the delete modal stays open on errors).
     */
    suspend fun deletePayment(payment: PaymentSummary): String? {
        val paymentsSnapshot = _payments.value
        val totalPaidSnapshot = _totalPaid.value
        _payments.value = paymentsSnapshot.filterNot { it.id == payment.id }
        _totalPaid.value = totalPaidSnapshot - payment.amount
        return runCatching { repo.deletePayment(payment.id) }.fold(
            onSuccess = { null },
            onFailure = { error ->
                _payments.value = paymentsSnapshot
                _totalPaid.value = totalPaidSnapshot
                error.message ?: "An error occurred"
            },
        )
    }
}

@Composable
internal fun PaymentModal(
    visible: Boolean,
    onClose: () -> Unit,
    onSaved: () -> Unit,
    /** The fixed bill (or a synthesized pending movement) being paid. */
    transaction: FixedTransactionResponse?,
    toast: ToastState,
    viewModel: PaymentViewModel = hiltViewModel(),
) {
    val colors = LocalAppColors.current
    val scope = rememberCoroutineScope()

    var amount by remember { mutableStateOf("") }
    var date by remember { mutableStateOf(todayInput()) }
    var deletingPayment by remember { mutableStateOf<PaymentSummary?>(null) }

    // RN open effect: empty amount, today's date, fetch the payment roster.
    LaunchedEffect(visible, transaction?.id) {
        if (!visible || transaction == null) return@LaunchedEffect
        amount = ""
        date = todayInput()
        viewModel.loadPayments(transaction.id)
    }

    val payments by viewModel.payments.collectAsStateWithLifecycle()
    val totalPaid by viewModel.totalPaid.collectAsStateWithLifecycle()
    val isLoadingDetails by viewModel.isLoadingDetails.collectAsStateWithLifecycle()
    val isRecording by viewModel.isRecording.collectAsStateWithLifecycle()

    LbModalSheet(visible = visible, onDismiss = onClose, title = I18n.t("paymentModal.title")) {
        Column(
            modifier = Modifier
                .heightIn(max = 560.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            if (!transaction?.description.isNullOrEmpty()) {
                Text(
                    transaction?.description.orEmpty(),
                    fontSize = 14.sp,
                    color = colors.textMuted,
                    modifier = Modifier.padding(bottom = 8.dp),
                )
            }
            Text(
                "${I18n.t("paymentModal.totalPaid")}: $${formatCurrency(totalPaid)}",
                fontSize = 14.sp,
                color = colors.textMuted,
                modifier = Modifier.padding(bottom = 16.dp),
            )

            LbTextField(
                value = amount,
                onValueChange = { amount = formatInputValue(it) },
                label = I18n.t("paymentModal.amount"),
                placeholder = "0",
                keyboardType = androidx.compose.ui.text.input.KeyboardType.Number,
            )
            FormSpacer()
            LbTextField(
                value = date,
                onValueChange = { date = it },
                label = I18n.t("paymentModal.date"),
                placeholder = "YYYY-MM-DD",
            )

            LbButton(
                text = I18n.t("paymentModal.recordPayment"),
                onClick = {
                    if (isRecording || transaction == null) return@LbButton
                    scope.launch {
                        val amountValue = parseInputValue(amount).toDoubleOrNull()
                        if (amountValue == null || amountValue <= 0) {
                            toast.show(I18n.t("paymentModal.invalidAmount"), isError = true)
                            return@launch
                        }
                        val error = viewModel.recordPayment(
                            fixedId = transaction.id,
                            amount = amountValue,
                            date = dateInputToISO(date),
                        )
                        if (error == null) {
                            toast.show(
                                toastText(
                                    I18n.t("paymentModal.paymentRecorded"),
                                    t(
                                        "paymentModal.paymentRecordedDescription",
                                        "amount" to formatCurrency(amountValue),
                                    ),
                                ),
                            )
                            onSaved()
                            onClose()
                        } else {
                            // Modal stays open with a destructive toast (RN parity).
                            toast.show(
                                toastText(I18n.t("paymentModal.paymentFailed"), error),
                                isError = true,
                            )
                        }
                    }
                },
                modifier = Modifier.padding(top = 20.dp),
                enabled = !isRecording,
                loading = isRecording,
            )

            // ---- payment history ----
            if (isLoadingDetails) {
                Text(
                    I18n.t("common.loading"),
                    fontSize = 14.sp,
                    color = colors.textMuted,
                    modifier = Modifier.padding(top = 20.dp),
                )
            } else if (payments.isNotEmpty()) {
                Text(
                    t("paymentModal.paymentHistory", "count" to payments.size),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = colors.foreground,
                    modifier = Modifier.padding(top = 24.dp, bottom = 8.dp),
                )
                payments.forEach { payment ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                    ) {
                        Text(
                            parseInstant(payment.date)?.let { formatShortDate(it) }.orEmpty(),
                            fontSize = 14.sp,
                            color = colors.textMuted,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            "$${formatCurrency(payment.amount)}",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                            color = colors.foreground,
                            modifier = Modifier.padding(end = 12.dp),
                        )
                        LbButton(
                            text = I18n.t("common.delete"),
                            onClick = { deletingPayment = payment },
                            modifier = Modifier.heightIn(min = 32.dp),
                            variant = LbButtonVariant.GHOST,
                        )
                    }
                }
            }

            LbButton(
                text = I18n.t("common.close"),
                onClick = onClose,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp, bottom = 4.dp),
                variant = LbButtonVariant.SECONDARY,
            )
        }
    }

    // RN embeds the payment delete confirm inside the modal screen.
    val deleteTarget = deletingPayment
    if (deleteTarget != null) {
        FinanceDeleteModal(
            visible = true,
            onDismiss = { deletingPayment = null },
            title = I18n.t("common.delete"),
            itemName = formatCurrency(deleteTarget.amount),
            details = {
                Column {
                    Text(
                        "$${formatCurrency(deleteTarget.amount)}",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = colors.foreground,
                    )
                    Text(
                        parseInstant(deleteTarget.date)?.let { formatShortDate(it) }.orEmpty(),
                        fontSize = 12.sp,
                        color = colors.textMuted,
                    )
                }
            },
            confirmLabel = I18n.t("common.delete"),
            onConfirm = {
                val error = viewModel.deletePayment(deleteTarget)
                if (error == null) {
                    toast.show(
                        toastText(
                            I18n.t("paymentModal.paymentDeleted"),
                            I18n.t("paymentModal.paymentDeletedDescription"),
                        ),
                    )
                } else {
                    toast.show(
                        toastText(I18n.t("paymentModal.deleteFailed"), error),
                        isError = true,
                    )
                }
                error
            },
        )
    }
}
