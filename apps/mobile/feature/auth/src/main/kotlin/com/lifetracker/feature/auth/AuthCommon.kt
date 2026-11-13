package com.lifetracker.feature.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.runtime.remember
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lifetracker.core.designsystem.LbButton
import com.lifetracker.core.designsystem.LbButtonVariant
import com.lifetracker.core.designsystem.LocalAppColors
import com.lifetracker.core.i18n.I18n

/**
 * Shared chrome for the auth screens (login/register): full-screen background,
 * keyboard-aware vertically centered scroll (RN `KeyboardAvoidingView` +
 * `ScrollView … justify-center p-6`) with a width-capped card.
 */
@Composable
fun AuthScreenScaffold(content: @Composable ColumnScope.(cardModifier: Modifier) -> Unit) {
    val colors = LocalAppColors.current
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background)
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 24.dp)
            .fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        content(
            Modifier
                .widthIn(max = 448.dp)
                .fillMaxWidth(),
        )
    }
}

/** RN top-right language toggle (`locale === 'en' ? Spanish : English`). */
@Composable
fun AuthLanguageToggle(modifier: Modifier = Modifier) {
    LbButton(
        text = I18n.t(if (I18n.current == I18n.Language.ENGLISH) "auth.spanish" else "auth.english"),
        onClick = {
            I18n.setLanguage(
                if (I18n.current == I18n.Language.ENGLISH) I18n.Language.SPANISH else I18n.Language.ENGLISH
            )
        },
        variant = LbButtonVariant.GHOST,
        modifier = modifier,
    )
}

/** RN `gap-4` form column. */
@Composable
fun AuthFormColumn(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        content()
    }
}

/** Inline screen-level error (danger ink, 14sp) — login/register submit failures. */
@Composable
fun AuthErrorText(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        fontSize = 14.sp,
        color = LocalAppColors.current.danger,
        modifier = modifier,
    )
}

/** `available` status line in success ink. */
@Composable
fun AuthAvailableText(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        fontSize = 14.sp,
        color = LocalAppColors.current.success,
        modifier = modifier,
    )
}

/** RN footer: muted sentence + primary tappable action link ("Sign up" / "Sign in"). */
@Composable
fun AuthSwitchText(
    text: String,
    actionLabel: String,
    onAction: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = LocalAppColors.current
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = text,
            fontSize = 14.sp,
            color = colors.textMuted,
        )
        Text(
            text = actionLabel,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = colors.primary,
            modifier = Modifier
                .padding(start = 4.dp)
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = onAction,
                ),
        )
    }
}
