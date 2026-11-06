package com.lifetracker.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.lifetracker.core.i18n.I18n

/**
 * Port of the RN modal surfaces (`filter-modal.tsx` / `delete-modal.tsx`
 * container): centered dim dialog, rounded-2xl (16px) background sheet,
 * header title + close button, live `ColumnScope` content.
 */
@Composable
fun LbModalSheet(
    visible: Boolean,
    onDismiss: () -> Unit,
    title: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    if (!visible) return
    val colors = LocalAppColors.current
    Dialog(
        onDismissRequest = onDismiss,
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
            Row(
                modifier = Modifier.padding(bottom = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    title,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = colors.foreground,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = onDismiss, modifier = Modifier.size(40.dp)) {
                    Icon(
                        imageVector = Icons.Outlined.Close,
                        contentDescription = I18n.t("common.close"),
                        tint = colors.textMuted,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
            content()
        }
    }
}

/**
 * Port of RN `components/ui/delete-modal.tsx`: warning icon in a danger-tinted
 * circle, title, message (with the item name in semibold ink), Cancel +
 * destructive Delete buttons side by side.
 *
 * The session-scoped `visible` dialog closes only when the caller flips it
 * off after a successful `onConfirm` (RN kept the modal open on throws).
 */
@Composable
fun LbDeleteConfirm(
    visible: Boolean,
    name: String,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
    title: String,
    message: String,
    deleteLabel: String,
) {
    if (!visible) return
    val colors = LocalAppColors.current
    Dialog(
        onDismissRequest = onDismiss,
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
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(colors.danger.copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Outlined.WarningAmber,
                        contentDescription = null,
                        tint = colors.danger,
                        modifier = Modifier.size(18.dp),
                    )
                }
                Text(
                    title,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = colors.foreground,
                    modifier = Modifier.weight(1f),
                )
            }
            Text(
                text = annotatedWithBoldName(message, name),
                fontSize = 14.sp,
                color = colors.textMuted,
                modifier = Modifier.padding(top = 16.dp, bottom = 12.dp),
            )
            Row(
                modifier = Modifier.padding(top = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                LbButton(
                    text = I18n.t("common.cancel"),
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f),
                    variant = LbButtonVariant.SECONDARY,
                )
                LbButton(
                    text = deleteLabel,
                    onClick = onConfirm,
                    modifier = Modifier.weight(1f),
                    variant = LbButtonVariant.DANGER,
                )
            }
        }
    }
}

/** Bolds the item name inside `message` when present (mirrors the RN "areYouSure" emphasis). */
private fun annotatedWithBoldName(message: String, name: String): AnnotatedString {
    if (message.isBlank() || name.isEmpty() || !message.contains(name)) {
        return AnnotatedString(message)
    }
    return buildAnnotatedString {
        var index = 0
        while (true) {
            val at = message.indexOf(name, index)
            if (at < 0) {
                append(message.substring(index))
                break
            }
            append(message.substring(index, at))
            pushStyle(SpanStyle(fontWeight = FontWeight.SemiBold))
            append(name)
            pop()
            index = at + name.length
        }
    }
}
