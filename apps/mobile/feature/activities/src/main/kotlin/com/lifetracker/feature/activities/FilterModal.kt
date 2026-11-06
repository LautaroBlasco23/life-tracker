package com.lifetracker.feature.activities

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.lifetracker.core.designsystem.LbButton
import com.lifetracker.core.designsystem.LbButtonVariant
import com.lifetracker.core.designsystem.LbModalSheet
import com.lifetracker.core.designsystem.LbOptionSelect
import com.lifetracker.core.designsystem.LbSelectOption
import com.lifetracker.core.designsystem.LbTextField
import com.lifetracker.core.i18n.I18n
import com.lifetracker.core.network.model.DayTime
import com.lifetracker.core.network.model.Frequency
import com.lifetracker.domain.activities.ActivityFilter

/**
 * Port of `components/ui/filter-modal.tsx` specialized for the Activities
 * screen: frequency select, time-of-day select and scheduled-for date.
 * Draft values apply on "Apply", reset clears the draft — RN parity.
 */

private val FILTER_FREQUENCIES = listOf(Frequency.DAILY, Frequency.WEEKLY, Frequency.MONTHLY)
private val FILTER_DAY_TIMES = listOf(DayTime.NOT_SPECIFIED, DayTime.MORNING, DayTime.AFTERNOON, DayTime.EVENING)

@Composable
internal fun ActivitiesFilterModal(
    visible: Boolean,
    currentFilter: ActivityFilter?,
    onApply: (ActivityFilter?) -> Unit,
    onClose: () -> Unit,
) {
    var frequency by rememberSaveable { mutableStateOf<Frequency?>(null) }
    var dayTime by rememberSaveable { mutableStateOf<DayTime?>(null) }
    var scheduledFor by rememberSaveable { mutableStateOf("") }

    // Keep the draft in sync with the applied filter (e.g. after reopening).
    LaunchedEffect(visible) {
        if (visible) {
            frequency = currentFilter?.frequency
            dayTime = currentFilter?.dayTime
            scheduledFor = currentFilter?.scheduledFor.orEmpty()
        }
    }

    val draftActive = frequency != null || dayTime != null || scheduledFor.isNotBlank()

    LbModalSheet(visible = visible, onDismiss = onClose, title = I18n.t("filterModal.filter")) {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            val frequencyOptions: List<LbSelectOption<Frequency?>> = listOf(
                LbSelectOption<Frequency?>(value = null, label = I18n.t("activities.allFrequencies")),
            ) + FILTER_FREQUENCIES.map { f ->
                LbSelectOption<Frequency?>(value = f, label = activityLabel(f.wire))
            }
            LbOptionSelect(
                label = I18n.t("activities.frequency"),
                options = frequencyOptions,
                selected = frequency,
                onSelect = { frequency = it },
            )
            val dayTimeOptions: List<LbSelectOption<DayTime?>> = listOf(
                LbSelectOption<DayTime?>(value = null, label = I18n.t("activities.allTimes")),
            ) + FILTER_DAY_TIMES.map { dt ->
                LbSelectOption<DayTime?>(value = dt, label = activityLabel(dt.wire))
            }
            LbOptionSelect(
                label = I18n.t("activities.timeOfDay"),
                options = dayTimeOptions,
                selected = dayTime,
                onSelect = { dayTime = it },
            )
            LbTextField(
                value = scheduledFor,
                onValueChange = { scheduledFor = it },
                label = I18n.t("activities.scheduledFor"),
                placeholder = "YYYY-MM-DD",
            )

            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.padding(top = 8.dp),
            ) {
                if (draftActive) {
                    LbButton(
                        text = I18n.t("filterModal.reset"),
                        onClick = {
                            frequency = null
                            dayTime = null
                            scheduledFor = ""
                        },
                        variant = LbButtonVariant.GHOST,
                    )
                }
                LbButton(
                    text = I18n.t("filterModal.applyFilters"),
                    onClick = {
                        val filter = if (
                            frequency == null && dayTime == null && scheduledFor.isBlank()
                        ) {
                            null
                        } else {
                            ActivityFilter(
                                frequency = frequency,
                                dayTime = dayTime,
                                scheduledFor = scheduledFor.trim().takeIf { it.isNotEmpty() },
                            )
                        }
                        onApply(filter)
                        onClose()
                    },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

/** Number of active filter values (`getActiveFilterCount`). */
internal fun activeFilterCount(filter: ActivityFilter?): Int {
    if (filter == null) return 0
    return listOfNotNull(
        filter.frequency,
        filter.dayTime,
        filter.scheduledFor,
    ).size
}
