package com.lifetracker.feature.activities

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lifetracker.core.designsystem.LbButton
import com.lifetracker.core.designsystem.LbModalSheet
import com.lifetracker.core.designsystem.LocalAppColors
import com.lifetracker.core.designsystem.ToastState
import com.lifetracker.core.i18n.I18n
import com.lifetracker.core.network.model.CreateActivityRequest
import com.lifetracker.domain.lib.activities.ACTIVITY_TEMPLATES
import com.lifetracker.domain.lib.activities.ACTIVITY_TEMPLATE_CATEGORIES
import com.lifetracker.domain.lib.activities.ActivityTemplate
import com.lifetracker.domain.lib.activities.Frequency as TemplateFrequency
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString

/**
 * Port of `components/activity/templates-modal.tsx`: category chips, the
 * curated template catalog multi-select with per-row metadata chips, pencil
 * customize (prefills the form) and sequential "create selected".
 */

/** Wire day order for the days chip label / created dayFrequency JSON. */
private val TEMPLATE_DAY_ORDER = listOf(
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
)

@Composable
internal fun TemplatesModal(
    visible: Boolean,
    onClose: () -> Unit,
    viewModel: ActivitiesViewModel,
    onCustomize: (ActivityPrefill) -> Unit,
    toast: ToastState,
) {
    val colors = LocalAppColors.current
    val scope = rememberCoroutineScope()

    var category by rememberSaveable { mutableStateOf(ACTIVITY_TEMPLATE_CATEGORIES.first()) }
    var selectedKeys by rememberSaveable { mutableStateOf(emptySet<String>()) }
    var isCreating by rememberSaveable { mutableStateOf(false) }

    // Category + selection reset when reopened (RN parity).
    LaunchedEffect(visible) {
        if (visible) {
            category = ACTIVITY_TEMPLATE_CATEGORIES.first()
            selectedKeys = emptySet()
            isCreating = false
        }
    }

    val templates = ACTIVITY_TEMPLATES.filter { it.category == category }
    val selectedCount = ACTIVITY_TEMPLATES.count { it.key in selectedKeys }

    LbModalSheet(visible = visible, onDismiss = onClose, title = I18n.t("activityTemplates.title")) {
        Text(
            text = I18n.t("activityTemplates.description"),
            fontSize = 14.sp,
            color = colors.textMuted,
            modifier = Modifier.padding(bottom = 12.dp),
        )

        // Category chips
        ChipRow(modifier = Modifier.padding(bottom = 12.dp)) {
            ACTIVITY_TEMPLATE_CATEGORIES.forEach { c ->
                LbSmallChip(
                    text = I18n.t("activityTemplates.category_${c.raw}"),
                    selected = category == c,
                    onClick = { category = c },
                )
            }
        }

        Column(
            modifier = Modifier
                .heightIn(max = 380.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            templates.forEach { template ->
                TemplateRow(
                    template = template,
                    isSelected = template.key in selectedKeys,
                    onToggle = {
                        selectedKeys = if (template.key in selectedKeys) {
                            selectedKeys - template.key
                        } else {
                            selectedKeys + template.key
                        }
                    },
                    onCustomize = {
                        // Web parity: customize a template = prefill the create form.
                        onCustomize(
                            ActivityPrefill(
                                title = I18n.t("activityTemplates.template_${template.key}"),
                                completionAmount = template.completionAmount,
                                frequency = template.frequency.toNetwork(),
                                dayTime = template.dayTime.toNetwork(),
                                dayFrequency = if (template.frequency == TemplateFrequency.WEEKLY) {
                                    template.dayFrequency?.map { it.raw }
                                } else {
                                    null
                                },
                            ),
                        )
                        onClose()
                    },
                )
            }
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.padding(top = 12.dp),
        ) {
            Text(
                text = tf("activityTemplates.selectedCount", "count" to selectedCount),
                fontSize = 14.sp,
                color = colors.textMuted,
                modifier = Modifier.weight(1f),
            )
            LbButton(
                text = if (isCreating) {
                    I18n.t("activityTemplates.creating")
                } else {
                    tf("activityTemplates.createSelected", "count" to selectedCount)
                },
                onClick = {
                    val selected = ACTIVITY_TEMPLATES.filter { it.key in selectedKeys }
                    if (selected.isEmpty() || isCreating) return@LbButton
                    isCreating = true
                    scope.launch {
                        var created = 0
                        var failed = 0
                        selected.forEach { template ->
                            val result = viewModel.createActivity(
                                CreateActivityRequest(
                                    title = I18n.t("activityTemplates.template_${template.key}"),
                                    description = "",
                                    completionAmount = template.completionAmount,
                                    frequency = template.frequency.toNetwork(),
                                    dayFrequency = if (template.frequency == TemplateFrequency.WEEKLY) {
                                        kotlinx.serialization.json.Json.encodeToString(
                                            TEMPLATE_DAY_ORDER.filter { day ->
                                                template.dayFrequency?.any { it.raw == day } == true
                                            },
                                        )
                                    } else {
                                        null
                                    },
                                    dayTime = template.dayTime.toNetwork(),
                                ),
                            )
                            if (result.isSuccess) created += 1 else failed += 1
                        }
                        isCreating = false
                        if (created > 0) {
                            toast.show(
                                I18n.t("activityTemplates.created") + "\n" +
                                    tf("activityTemplates.createdDescription", "count" to created),
                            )
                        }
                        if (failed > 0) {
                            toast.show(
                                I18n.t("activityTemplates.partialFailure") + "\n" +
                                    tf(
                                        "activityTemplates.partialFailureDescription",
                                        "created" to created,
                                        "failed" to failed,
                                    ),
                                isError = true,
                            )
                        }
                        if (created > 0) {
                            onClose()
                            viewModel.refresh()
                        }
                    }
                },
                enabled = selectedCount > 0 && !isCreating,
            )
        }
    }
}

@Composable
private fun TemplateRow(
    template: ActivityTemplate,
    isSelected: Boolean,
    onToggle: () -> Unit,
    onCustomize: () -> Unit,
) {
    val colors = LocalAppColors.current
    val accentShape = RoundedCornerShape(8.dp)
    Row(
        modifier = Modifier
            .padding(bottom = 8.dp)
            .clip(accentShape)
            .background(if (isSelected) colors.primary.copy(alpha = 0.05f) else colors.surface)
            .border(
                1.dp,
                if (isSelected) colors.primary.copy(alpha = 0.5f) else colors.border,
                accentShape,
            )
            .clickable(onClick = onToggle)
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .size(20.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(if (isSelected) colors.primary else colors.surface)
                .border(1.dp, if (isSelected) colors.primary else colors.border, RoundedCornerShape(4.dp)),
            contentAlignment = Alignment.Center,
        ) {
            if (isSelected) {
                Icon(
                    imageVector = Icons.Filled.Check,
                    contentDescription = null,
                    tint = colors.primaryForeground,
                    modifier = Modifier.size(13.dp),
                )
            }
        }
        Column(Modifier.weight(1f)) {
            Text(
                text = I18n.t("activityTemplates.template_${template.key}"),
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = colors.foreground,
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.padding(top = 6.dp),
            ) {
                LbChip(text = activityLabel(template.frequency.raw))
                if (template.frequency == TemplateFrequency.WEEKLY && template.dayFrequency != null) {
                    val days = TEMPLATE_DAY_ORDER.filter { day ->
                        template.dayFrequency!!.any { it.raw == day }
                    }.joinToString(", ") { day -> dayLabel(day) }
                    LbChip(text = days)
                }
                LbChip(text = activityLabel(template.dayTime.raw))
                if (template.completionAmount > 1) {
                    LbChip(text = template.completionAmount.toString())
                }
            }
        }
        Icon(
            imageVector = Icons.Outlined.Edit,
            contentDescription = I18n.t("activityTemplates.customize"),
            tint = colors.primary,
            modifier = Modifier
                .size(16.dp)
                .clickable(onClick = onCustomize),
        )
    }
}

/** Domain template enums → wire enums for the API requests (names align). */
private fun TemplateFrequency.toNetwork(): com.lifetracker.core.network.model.Frequency =
    com.lifetracker.core.network.model.Frequency.valueOf(name)

private fun com.lifetracker.domain.lib.activities.DayTime.toNetwork(): com.lifetracker.core.network.model.DayTime =
    com.lifetracker.core.network.model.DayTime.valueOf(name)
