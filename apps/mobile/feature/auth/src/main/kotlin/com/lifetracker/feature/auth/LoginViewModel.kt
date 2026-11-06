package com.lifetracker.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lifetracker.core.i18n.I18n
import com.lifetracker.domain.auth.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val identifier: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    /** Server/auth failure shown inline under the fields (RN `err.message`). */
    val error: String? = null,
)

/**
 * Port of the login logic in `app/login.tsx`: identifier (username OR email)
 * + password against AuthRepository.login; inline error, form values preserved;
 * loading state disables the submit button.
 */
@HiltViewModel
class LoginViewModel @Inject constructor(
    private val auth: AuthRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(LoginUiState())
    val state: MutableStateFlow<LoginUiState> = _state

    fun onIdentifierChange(value: String) = _state.update { it.copy(identifier = value) }

    fun onPasswordChange(value: String) = _state.update { it.copy(password = value) }

    fun login(onSuccess: (username: String?) -> Unit) {
        if (_state.value.isLoading) return
        _state.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch {
            val s = _state.value
            auth.login(identifier = s.identifier, password = s.password)
                .onSuccess { user ->
                    _state.update { it.copy(isLoading = false, error = null) }
                    onSuccess(user.username)
                }
                .onFailure { err ->
                    _state.update {
                        it.copy(
                            isLoading = false,
                            error = err.message ?: I18n.t("auth.loginFailed"),
                        )
                    }
                }
        }
    }
}
