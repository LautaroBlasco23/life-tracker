package com.lifetracker.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lifetracker.core.i18n.I18n

/** Generic option for [LbOptionSelect] (same shape as RN `Option<T>`). */
data class LbSelectOption<T>(val value: T, val label: String)

/**
 * Port of RN `components/ui/option-select.tsx`: label + bordered 44px trigger
 * that opens a bottom-sheet picker (slid up, max-height, check-mark on the
 * selected row, centered Cancel below). Selecting an option commits immediately
 * and closes the sheet, matching the RN modal.
 *
 * Extra trailing parameter beyond the API contract: `placeholder` (RN default "—").
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun <T> LbOptionSelect(
    label: String,
    options: List<LbSelectOption<T>>,
    selected: T?,
    onSelect: (T) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "—",
) {
    var open by remember { mutableStateOf(false) }
    val colors = LocalAppColors.current
    val selectedLabel = options.firstOrNull { it.value == selected }?.label

    Column(modifier = modifier) {
        Text(
            label,
            fontSize = 14.sp,
            color = colors.foreground,
            modifier = Modifier.padding(bottom = 6.dp),
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(44.dp)
                .clip(RoundedCornerShape(8.dp))
                .border(1.dp, colors.border, RoundedCornerShape(8.dp))
                .clickable { open = true }
                .padding(horizontal = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = selectedLabel ?: placeholder,
                fontSize = 16.sp,
                color = if (selectedLabel != null) colors.foreground else colors.textMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Icon(
                imageVector = Icons.Outlined.ExpandMore,
                contentDescription = null,
                tint = colors.textMuted,
                modifier = Modifier.size(18.dp),
            )
        }
    }

    if (open) {
        ModalBottomSheet(
            onDismissRequest = { open = false },
            containerColor = colors.background,
            tonalElevation = 0.dp,
            shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp),
        ) {
            Column(modifier = Modifier.fillMaxWidth().padding(20.dp)) {
                Text(
                    label,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = colors.foreground,
                    modifier = Modifier.padding(bottom = 12.dp),
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 420.dp)
                        .verticalScroll(rememberScrollState()),
                ) {
                    options.forEach { option ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onSelect(option.value)
                                    open = false
                                }
                                .padding(vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                option.label,
                                fontSize = 16.sp,
                                color = colors.foreground,
                            )
                            if (selected == option.value) {
                                Icon(
                                    imageVector = Icons.Filled.Check,
                                    contentDescription = null,
                                    tint = colors.primary,
                                    modifier = Modifier.size(18.dp),
                                )
                            }
                        }
                        HorizontalDivider(thickness = 1.dp, color = colors.border)
                    }
                }
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(44.dp)
                        .clickable { open = false },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = I18n.t("common.cancel"),
                        fontSize = 16.sp,
                        color = colors.primary,
                    )
                }
            }
        }
    }
}
