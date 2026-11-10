package com.lifetracker.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lifetracker.core.i18n.I18n

/**
 * Port of RN `components/ui/form-field.tsx`: label, 44px bordered input,
 * placeholder in muted ink, password show/hide, error/supporting text.
 *
 * Matches RN behavior: no auto-capitalization, transparent input background,
 * border turns danger when in error. `supportingText` renders in danger ink
 * when `isError`, muted ink otherwise.
 *
 * Extra trailing parameter beyond the API contract: `secure` enables the
 * password show/hide toggle (RN `secureTextEntry`).
 */
@Composable
fun LbTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: String = "",
    placeholder: String = "",
    enabled: Boolean = true,
    isError: Boolean = false,
    supportingText: String = "",
    singleLine: Boolean = true,
    keyboardType: KeyboardType = KeyboardType.Unspecified,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    secure: Boolean = false,
) {
    val colors = LocalAppColors.current
    val borderColor = if (isError) colors.danger else colors.border
    var passwordVisible by rememberSaveable { mutableStateOf(false) }
    val transformation: VisualTransformation = when {
        secure && passwordVisible -> VisualTransformation.None
        secure -> PasswordVisualTransformation()
        else -> visualTransformation
    }

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (label.isNotEmpty()) {
            Text(label, fontSize = 14.sp, color = colors.foreground)
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(44.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .border(1.dp, borderColor, RoundedCornerShape(8.dp))
                    .background(androidx.compose.ui.graphics.Color.Transparent)
                    .padding(horizontal = 12.dp),
                contentAlignment = Alignment.CenterStart,
            ) {
                if (value.isEmpty() && placeholder.isNotEmpty()) {
                    Text(
                        placeholder,
                        fontSize = 16.sp,
                        color = colors.textMuted,
                        maxLines = 1,
                    )
                }
                BasicTextField(
                    value = value,
                    onValueChange = onValueChange,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = enabled,
                    singleLine = singleLine,
                    textStyle = TextStyle(fontSize = 16.sp, color = colors.foreground),
                    cursorBrush = SolidColor(colors.primary),
                    keyboardOptions = KeyboardOptions(
                        capitalization = KeyboardCapitalization.None,
                        keyboardType = keyboardType,
                    ),
                    visualTransformation = transformation,
                )
            }
            if (secure) {
                IconButton(
                    onClick = { passwordVisible = !passwordVisible },
                    modifier = Modifier.size(40.dp),
                ) {
                    Icon(
                        imageVector = if (passwordVisible) Icons.Filled.Visibility else Icons.Filled.VisibilityOff,
                        contentDescription = I18n.t(if (passwordVisible) "common.hide" else "common.show"),
                        tint = colors.primary,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
        }
        if (supportingText.isNotEmpty()) {
            Text(
                supportingText,
                fontSize = 14.sp,
                fontWeight = FontWeight.Normal,
                color = if (isError) colors.danger else colors.textMuted,
            )
        }
    }
}
