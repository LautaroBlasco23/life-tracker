package com.lifetracker.feature.auth

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
import com.lifetracker.core.designsystem.LbTextField
import com.lifetracker.core.designsystem.LocalAppColors
import com.lifetracker.core.i18n.I18n
import com.lifetracker.domain.auth.Availability

/**
 * Port of `app/register.tsx`: ONE form with all six fields, 500 ms-debounced
 * username/email availability checks ("checking" → available/taken), RN
 * validation order (mismatch before too-short), inline error and a "Sign in"
 * back link. Success navigation is handled by [onRegisterSuccess].
 */
@Composable
fun RegisterScreen(
    onRegisterSuccess: (username: String?) -> Unit,
    onBack: () -> Unit,
    viewModel: RegisterViewModel = hiltViewModel(),
) {
    val colors = LocalAppColors.current
    I18n.current // subscribe: language flip must instantly re-resolve every label
    val state by viewModel.state.collectAsStateWithLifecycle()
    val usernameCheck = state.usernameCheck
    val emailCheck = state.emailCheck

    AuthScreenScaffold { _ ->
        AuthLanguageToggle(Modifier.align(Alignment.End))

        Text(
            text = I18n.t("auth.createAccount"),
            fontSize = 30.sp,
            fontWeight = FontWeight.SemiBold,
            color = colors.foreground,
            textAlign = TextAlign.Center,
            modifier = Modifier.align(Alignment.CenterHorizontally),
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = I18n.t("auth.createAccountDescription"),
            fontSize = 14.sp,
            color = colors.textMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.align(Alignment.CenterHorizontally),
        )
        Spacer(Modifier.height(32.dp))

        AuthFormColumn {
            LbTextField(
                value = state.firstName,
                onValueChange = viewModel::onFirstNameChange,
                label = I18n.t("auth.firstName"),
                placeholder = I18n.t("auth.firstNamePlaceholder"),
            )
            LbTextField(
                value = state.lastName,
                onValueChange = viewModel::onLastNameChange,
                label = I18n.t("auth.lastName"),
                placeholder = I18n.t("auth.lastNamePlaceholder"),
            )
            LbTextField(
                value = state.username,
                onValueChange = viewModel::onUsernameChange,
                label = I18n.t("auth.username"),
                placeholder = I18n.t("auth.usernamePlaceholder"),
                isError = usernameCheck.error != null,
                supportingText = usernameCheck.error.orEmpty(),
            )
            if (usernameCheck.status == Availability.Available) {
                AuthAvailableText(I18n.t("auth.usernameAvailable"))
            }
            LbTextField(
                value = state.email,
                onValueChange = viewModel::onEmailChange,
                label = I18n.t("auth.email"),
                placeholder = I18n.t("auth.emailPlaceholder"),
                keyboardType = KeyboardType.Email,
                isError = emailCheck.error != null,
                supportingText = emailCheck.error.orEmpty(),
            )
            if (emailCheck.status == Availability.Available) {
                AuthAvailableText(I18n.t("auth.emailAvailable"))
            }
            LbTextField(
                value = state.password,
                onValueChange = viewModel::onPasswordChange,
                label = I18n.t("auth.password"),
                placeholder = I18n.t("auth.createPasswordPlaceholder"),
                secure = true,
                keyboardType = KeyboardType.Password,
            )
            LbTextField(
                value = state.confirmPassword,
                onValueChange = viewModel::onConfirmPasswordChange,
                label = I18n.t("auth.confirmPassword"),
                placeholder = I18n.t("auth.confirmPasswordPlaceholder"),
                secure = true,
                keyboardType = KeyboardType.Password,
            )

            state.error?.let { error -> AuthErrorText(error) }

            LbButton(
                text = if (state.isLoading) I18n.t("auth.creatingAccount") else I18n.t("auth.signUp"),
                onClick = { viewModel.register(onRegisterSuccess) },
                modifier = Modifier.fillMaxWidth(),
                loading = state.isLoading,
                enabled = state.allFilled() && !state.isLoading,
            )
        }

        Spacer(Modifier.height(32.dp))
        AuthSwitchText(
            text = I18n.t("auth.haveAccount"),
            actionLabel = I18n.t("auth.signIn"),
            onAction = onBack,
            modifier = Modifier.align(Alignment.CenterHorizontally),
        )
    }
}
