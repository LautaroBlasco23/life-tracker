package com.lifetracker.feature.activities

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Alarm
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Replay
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lifetracker.core.designsystem.LocalAppColors

/**
 * Long-press context menu (RN `Alert.alert(title, undefined, options)`):
 * stacked rows with icons, destructive-tinted delete row, trailing Cancel.
 */

internal data class LbMenuOption(
    val text: String,
    val icon: ImageVector? = null,
    val destructive: Boolean = false,
    val onClick: () -> Unit,
)

@Composable
internal fun LbMenuDialog(
    visible: Boolean,
    title: String,
    options: List<LbMenuOption>,
    cancelLabel: String,
    onDismiss: () -> Unit,
) {
    if (!visible) return
    val colors = LocalAppColors.current
    AlertDialog(
        onDismissRequest = onDismiss,
        // Android hardware back closes the menu (Dialog default).
        confirmButton = {
            TextButton(onClick = onDismiss) { Text(text = cancelLabel) }
        },
        title = {
            Text(
                text = title,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = colors.foreground,
                maxLines = 1,
            )
        },
        text = {
            Column {
                options.forEach { option ->
                    TextButton(
                        onClick = {
                            onDismiss()
                            option.onClick()
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        option.icon?.let { icon ->
                            Icon(
                                imageVector = icon,
                                contentDescription = null,
                                tint = if (option.destructive) colors.danger else colors.primary,
                                modifier = Modifier.padding(end = 8.dp),
                            )
                        }
                        Text(
                            text = option.text,
                            color = if (option.destructive) colors.danger else colors.foreground,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                }
            }
        },
    )
}
