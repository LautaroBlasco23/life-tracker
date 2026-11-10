package com.lifetracker.feature.auth

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.lifetracker.core.designsystem.LbButton
import com.lifetracker.core.designsystem.LbCard
import com.lifetracker.core.designsystem.LbTextField
import com.lifetracker.core.designsystem.LocalAppColors
import com.lifetracker.core.i18n.I18n

/**
 * Port of `app/login.tsx`: centered card with language toggle, identifier
 * (username OR email) + password, inline failure error and a "Sign up" link.
 * Success navigation is handled by [onLoginSuccess] (AppHost goes to activities).
 */
@Composable
fun LoginScreen(
    onLoginSuccess: (username: String?) -> Unit,
    /** RN `Link href="/register"`; defaulted so the AppHost call surface stays exact. */
    onNavigateToRegister: (() -> Unit)? = null,
    viewModel: LoginViewModel = hiltViewModel(),
) {
    val colors = LocalAppColors.current
    I18n.current // subscribe: language flip must instantly re-resolve every label
    val state by viewModel.state.collectAsStateWithLifecycle()

    AuthScreenScaffold { cardModifier ->
        LbCard(cardModifier) {
            Box(
                modifier = Modifier.fillMaxWidth(),
                contentAlignment = Alignment.CenterEnd,
            ) {
                AuthLanguageToggle()
            }

            Text(
                text = I18n.t("auth.signIn"),
                fontSize = 24.sp,
                fontWeight = FontWeight.SemiBold,
                color = colors.foreground,
                textAlign = TextAlign.Center,
                modifier = Modifier.align(Alignment.CenterHorizontally),
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = I18n.t("auth.signInDescription"),
                fontSize = 14.sp,
                color = colors.textMuted,
                textAlign = TextAlign.Center,
                modifier = Modifier.align(Alignment.CenterHorizontally),
            )
            Spacer(Modifier.height(24.dp))

            AuthFormColumn {
                LbTextField(
                    value = state.identifier,
                    onValueChange = viewModel::onIdentifierChange,
                    label = I18n.t("auth.usernameOrEmail"),
                    placeholder = I18n.t("auth.usernameOrEmailPlaceholder"),
                    keyboardType = KeyboardType.Email,
                )
                LbTextField(
                    value = state.password,
                    onValueChange = viewModel::onPasswordChange,
                    label = I18n.t("auth.password"),
                    placeholder = I18n.t("auth.passwordPlaceholder"),
                    secure = true,
                    keyboardType = KeyboardType.Password,
                )

                state.error?.let { error -> AuthErrorText(error) }

                LbButton(
                    text = if (state.isLoading) I18n.t("auth.signingIn") else I18n.t("auth.signIn"),
                    onClick = { viewModel.login(onLoginSuccess) },
                    modifier = Modifier.fillMaxWidth(),
                    loading = state.isLoading,
                    enabled = state.identifier.isNotBlank() && state.password.isNotBlank(),
                )
            }

            Spacer(Modifier.height(24.dp))
            if (onNavigateToRegister != null) {
                AuthSwitchText(
                    text = I18n.t("auth.noAccount"),
                    actionLabel = I18n.t("auth.signUp"),
                    onAction = onNavigateToRegister,
                    modifier = Modifier.align(Alignment.CenterHorizontally),
                )
            }
        }
    }
}
