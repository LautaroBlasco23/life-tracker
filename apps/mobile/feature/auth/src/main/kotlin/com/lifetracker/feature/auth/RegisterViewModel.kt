package com.lifetracker.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lifetracker.core.i18n.I18n
import com.lifetracker.domain.auth.AuthRepository
import com.lifetracker.domain.auth.Availability
import com.lifetracker.domain.auth.CredentialsValidatorRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Availability probe state for one field: none / taken (error text) / available. */
data class FieldCheck(
    val status: Availability? = null,
    /** Inline error text (RN `usernameTaken` / `emailTaken`); only when taken. */
    val error: String? = null,
)

data class RegisterUiState(
    val firstName: String = "",
    val lastName: String = "",
    val username: String = "",
    val email: String = "",
    val password: String = "",
    val confirmPassword: String = "",
    val isLoading: Boolean = false,
    val usernameCheck: FieldCheck = FieldCheck(),
    val emailCheck: FieldCheck = FieldCheck(),
    /** Client or server failure shown inline under the fields. */
    val error: String? = null,
) {
    val isPasswordValid: Boolean get() = password.length >= MIN_PASSWORD_LENGTH

    fun allFilled(): Boolean =
        firstName.isNotBlank() && lastName.isNotBlank() && username.isNotBlank() &&
            email.isNotBlank() && password.isNotBlank() && confirmPassword.isNotBlank()

    companion object {
        const val MIN_PASSWORD_LENGTH = 8
        const val MIN_USERNAME_LENGTH = 3
        const val CHECK_DEBOUNCE_MS = 500L
        val EMAIL_REGEX = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
    }
}

/**
 * Port of the register logic in `app/register.tsx`: single form, debounced
 * (500 ms) username/email availability probes against the rate-limited
 * `check-username`/`check-email` endpoints, submit validation in RN order
 * (mismatch before length), inline server error, values preserved on failure.
 */
@HiltViewModel
class RegisterViewModel @Inject constructor(
    private val auth: AuthRepository,
    private val checks: CredentialsValidatorRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(RegisterUiState())
    val state: MutableStateFlow<RegisterUiState> = _state

    /** Debounce emitters: each keystroke re-arms the 500 ms window (RN setTimeout). */
    private val usernameInput = MutableStateFlow("")
    private val emailInput = MutableStateFlow("")

    init {
        observeAvailability()
    }

    @OptIn(FlowPreview::class, ExperimentalCoroutinesApi::class)
    private fun observeAvailability() {
        viewModelScope.launch {
            usernameInput
                .debounce(RegisterUiState.CHECK_DEBOUNCE_MS)
                .collectLatest { value -> runCheck(value, isEmail = false) }
        }
        viewModelScope.launch {
            emailInput
                .debounce(RegisterUiState.CHECK_DEBOUNCE_MS)
                .collectLatest { value -> runCheck(value, isEmail = true) }
        }
    }

    /** RN `checkUsername`/`checkEmail`: invalid input clears status; failures are swallowed. */
    private suspend fun runCheck(value: String, isEmail: Boolean) {
        val valid = if (isEmail) {
            RegisterUiState.EMAIL_REGEX.matches(value)
        } else {
            value.length >= RegisterUiState.MIN_USERNAME_LENGTH
        }
        if (!valid) {
            _state.update {
                if (isEmail) it.copy(emailCheck = FieldCheck()) else it.copy(usernameCheck = FieldCheck())
            }
            return
        }
        val result = if (isEmail) checks.checkEmail(value) else checks.checkUsername(value)
        _state.update { s ->
            // Ignore stale responses that finished after the input changed again.
            val current = if (isEmail) s.email else s.username
            if (current != value) return@update s
            when (result) {
                Availability.Available -> setCheck(s, isEmail, FieldCheck(Availability.Available, null))
                Availability.Taken -> {
                    val key = if (isEmail) "auth.emailTaken" else "auth.usernameTaken"
                    setCheck(s, isEmail, FieldCheck(Availability.Taken, I18n.t(key)))
                }
                Availability.Unknown -> setCheck(s, isEmail, FieldCheck())
            }
        }
    }

    private fun setCheck(s: RegisterUiState, isEmail: Boolean, check: FieldCheck) =
        if (isEmail) s.copy(emailCheck = check) else s.copy(usernameCheck = check)

    fun onFirstNameChange(value: String) = _state.update { it.copy(firstName = value) }
    fun onLastNameChange(value: String) = _state.update { it.copy(lastName = value) }
    fun onUsernameChange(value: String) {
        _state.update { it.copy(username = value) }
        usernameInput.value = value
    }

    fun onEmailChange(value: String) {
        _state.update { it.copy(email = value) }
        emailInput.value = value
    }

    fun onPasswordChange(value: String) = _state.update { it.copy(password = value) }
    fun onConfirmPasswordChange(value: String) = _state.update { it.copy(confirmPassword = value) }

    fun register(onSuccess: (username: String?) -> Unit) {
        val s = _state.value
        if (s.isLoading) return
        // Validation order per checklist: mismatch BEFORE length.
        if (s.password != s.confirmPassword) {
            _state.update { it.copy(error = I18n.t("auth.passwordMismatch")) }
            return
        }
        if (!s.isPasswordValid) {
            _state.update { it.copy(error = I18n.t("auth.passwordTooShort")) }
            return
        }
        _state.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch {
            auth.register(
                email = s.email,
                password = s.password,
                firstName = s.firstName,
                lastName = s.lastName,
                username = s.username,
            )
                .onSuccess { user ->
                    _state.update { it.copy(isLoading = false, error = null) }
                    onSuccess(user.username)
                }
                .onFailure { err ->
                    _state.update {
                        it.copy(
                            isLoading = false,
                            error = err.message ?: I18n.t("auth.registrationFailed"),
                        )
                    }
                }
        }
    }
}
