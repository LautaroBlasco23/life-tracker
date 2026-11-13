package com.lifetracker.feature.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lifetracker.core.designsystem.ThemePreference
import com.lifetracker.core.network.model.PrivacyStatus
import com.lifetracker.core.network.model.RestoreCounts
import com.lifetracker.core.network.model.UserResponse
import com.lifetracker.core.storage.SessionStore
import com.lifetracker.core.storage.SessionUser
import com.lifetracker.core.storage.SettingsRepository
import com.lifetracker.domain.auth.AuthRepository
import com.lifetracker.domain.auth.Availability
import com.lifetracker.domain.auth.CredentialsValidatorRepository
import com.lifetracker.domain.profile.DataBackupRepository
import com.lifetracker.domain.profile.ProfileRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Profile row model (subset of the RN shared `User` the screen consumes). */
data class ProfileUser(
    val id: Long,
    val username: String?,
    val firstName: String,
    val lastName: String,
    val email: String,
    val thumbnailUrl: String? = null,
    val profilePicUrl: String? = null,
    /** `public` | `private` (null keeps the RN `?? 'public'` fallback). */
    val privacyStatus: String? = null,
)

/** Backup file queued behind the destructive-restore confirm modal. */
data class PendingImportFile(
    /** Display name shown in the confirm modal (RN picked-file name). */
    val name: String,
    /** Temporary copy the caller materialized from the picked Uri. */
    val file: java.io.File,
)

data class ProfileUiState(
    val user: ProfileUser? = null,
    val isUploadingImage: Boolean = false,
    /** Current API URL for the row display (override or build-time default). */
    val apiUrl: String = "",
    // Backup card (RN isExporting/isImporting pair; mutually disabling).
    val isExporting: Boolean = false,
    val isImporting: Boolean = false,
    val pendingImport: PendingImportFile? = null,
    /** True between the logout call and the navigation callback. */
    val isLoggingOut: Boolean = false,
)

sealed interface ProfileEvent {
    data class Toast(val text: String, val isError: Boolean = false) : ProfileEvent
}

/**
 * Port of the RN profile screen state (`app/(app)/profile.tsx`) plus the
 * `lib/data-backup.ts` flows:
 * - profile refresh (server fetch keeps the cached user on failure, no toast),
 * - optimistic privacy toggle with revert,
 * - avatar upload/remove (bytes come from the screen's ContentResolver read),
 * - API URL override (https-only in non-debug builds, trailing-slash trim),
 * - theme/language persisted through [SettingsRepository] (MainActivity
 *   bridges the DataStore values back into ThemeController/I18n),
 * - password/email changes through [AuthRepository] (fresh token pairs are
 *   stashed there), with the cached email patched after an email change,
 * - backup export (streamed into the picked Uri) / destructive import,
 * - logout ([AuthRepository.logout]) then the passed callback.
 */
@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val profileRepo: ProfileRepository,
    private val dataBackupRepo: DataBackupRepository,
    private val auth: AuthRepository,
    private val sessions: SessionStore,
    private val settings: SettingsRepository,
    private val credentials: CredentialsValidatorRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        ProfileUiState(user = sessions.currentUser()?.let { it.toProfileUser() }),
    )
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<ProfileEvent>(extraBufferCapacity = 16)
    val events: SharedFlow<ProfileEvent> = _events.asSharedFlow()

    private fun toast(text: String, isError: Boolean = false) {
        _events.tryEmit(ProfileEvent.Toast(text, isError))
    }

    private fun errorToast(titleKey: String, error: Throwable): Unit =
        toast(toastText(t(titleKey), error.message), isError = true)

    // ---- profile ----

    /** RN `useFocusEffect` refresh: keep the cached user on failure (no toast). */
    fun refreshProfile() {
        viewModelScope.launch {
            val updated = runCatching { profileRepo.getMyProfile() }
                .map { profile -> profile.toProfileUser() }
                .getOrNull() ?: return@launch
            _uiState.update { it.copy(user = updated) }
            _uiState.update { it.copy(apiUrl = profileRepo.effectiveApiUrl()) }
        }
    }

    /** Optimistic public ↔ private flip, reverted on failure (RN `togglePrivacy`). */
    fun togglePrivacy() {
        val current = _uiState.value.user ?: return
        val previous = current
        val next = if (current.privacyStatus == "public") "private" else "public"
        _uiState.update { it.copy(user = current.copy(privacyStatus = next)) }
        viewModelScope.launch {
            runCatching {
                profileRepo.updatePrivacyStatus(
                    if (next == "public") PrivacyStatus.PUBLIC else PrivacyStatus.PRIVATE,
                )
            }.onSuccess { user ->
                _uiState.update { it.copy(user = user.toProfileUser()) }
            }.onFailure { error ->
                _uiState.update { it.copy(user = previous) }
                errorToast("profile.updateFailed", error)
            }
        }
    }

    /** Avatar upload: bytes + mime already read from the ContentResolver. */
    fun uploadImage(bytes: ByteArray, contentType: String) {
        if (_uiState.value.isUploadingImage) return
        _uiState.update { it.copy(isUploadingImage = true) }
        viewModelScope.launch {
            runCatching { profileRepo.uploadImage(bytes, contentType) }
                .onSuccess { user -> _uiState.update { it.copy(user = user.toProfileUser()) } }
                .onFailure { error -> errorToast("profile.uploadFailed", error) }
            _uiState.update { it.copy(isUploadingImage = false) }
        }
    }

    fun removeImage() {
        if (_uiState.value.isUploadingImage) return
        viewModelScope.launch {
            runCatching { profileRepo.deleteImage() }
                .onSuccess { user -> _uiState.update { it.copy(user = user.toProfileUser()) } }
                .onFailure { error -> errorToast("profile.updateFailed", error) }
        }
    }

    // ---- settings rows ----

    /** Persisted; MainActivity bridges the value into ThemeController (re-themes instantly). */
    fun setTheme(preference: ThemePreference) {
        viewModelScope.launch { settings.setTheme(preference.name.lowercase()) }
    }

    /** Persisted; MainActivity bridges the value into I18n (labels flip instantly). */
    fun setLanguage(code: String) {
        viewModelScope.launch { settings.setLanguage(code) }
    }

    /**
     * RN `saveApiUrl`: trims + strips trailing slashes; empty input does
     * nothing; non-https is rejected outside debug builds (this value decides
     * where Bearer tokens are sent). `onResult(true)` means "applied".
     */
    fun saveApiUrl(
        input: String,
        isDebugBuild: Boolean,
        onResult: (Boolean) -> Unit,
    ) {
        val url = input.trim().trimEnd('/')
        if (url.isEmpty()) return
        if (!url.startsWith("https://") && !isDebugBuild) {
            toast(
                toastText(t("profile.apiUrlInvalidTitle"), t("profile.apiUrlInvalidMessage")),
                isError = true,
            )
            return
        }
        viewModelScope.launch {
            settings.setApiUrl(url)
            _uiState.update { it.copy(apiUrl = url) }
            toast(
                toastText(t("profile.apiUrlUpdated"), t("profile.apiUrlUpdatedDescription")),
            )
            onResult(true)
        }
    }

    // ---- password / email (AuthRepository stashes the fresh token pairs) ----

    fun changePassword(
        currentPassword: String,
        newPassword: String,
        onResult: (Boolean) -> Unit,
    ) {
        viewModelScope.launch {
            runCatching { auth.changePassword(currentPassword, newPassword) }
                .onSuccess {
                    toast(
                        toastText(
                            t("updatePassword.passwordUpdated"),
                            t("updatePassword.passwordUpdatedDescription"),
                        ),
                    )
                    onResult(true)
                }
                .onFailure { error -> errorToast("updatePassword.updateFailed", error) }
        }
    }

    fun changeEmail(
        password: String,
        newEmail: String,
        onResult: (Boolean) -> Unit,
    ) {
        viewModelScope.launch {
            runCatching { auth.changeEmail(password, newEmail) }
                .onSuccess {
                    // RN rewrites the cached user's email in storage; AuthRepository
                    // only stashes tokens, so the session snapshot is patched here.
                    sessions.currentUser()?.let { cached ->
                        sessions.setCurrentUser(cached.copy(email = newEmail))
                    }
                    _uiState.update { state -> state.copy(user = state.user?.copy(email = newEmail)) }
                    toast(
                        toastText(t("updateEmail.emailUpdated"), t("updateEmail.emailUpdatedDescription")),
                    )
                    onResult(true)
                }
                .onFailure { error -> errorToast("updateEmail.updateFailed", error) }
        }
    }

    /** Availability probe for the email modal (null = unknown/failed). */
    suspend fun checkEmail(newEmail: String): Boolean? =
        when (credentials.checkEmail(newEmail)) {
            Availability.Available -> true
            Availability.Taken -> false
            Availability.Unknown -> null
        }

    // ---- backup ----

    /**
     * Streams the export response into the output stream the screen opened on
     * the picked CreateDocument Uri (`null` stream = the platform write failed).
     */
    fun exportTo(stream: java.io.OutputStream?) {
        if (_uiState.value.isExporting || _uiState.value.isImporting) return
        if (stream == null) {
            toast(t("dataBackup.exportFailed"), isError = true)
            return
        }
        _uiState.update { it.copy(isExporting = true) }
        viewModelScope.launch {
            runCatching { dataBackupRepo.exportTo(stream) }
                .onSuccess {
                    toast(
                        toastText(t("dataBackup.exportSuccess"), t("dataBackup.exportSuccessDescription")),
                    )
                }
                .onFailure { error -> errorToast("dataBackup.exportFailed", error) }
            _uiState.update { it.copy(isExporting = false) }
        }
    }

    /** Called after the screen copied the picked file into cache. */
    fun onImportFileSelected(name: String, file: java.io.File?) {
        if (file == null) {
            toast(t("dataBackup.importFailed"), isError = true)
            return
        }
        _uiState.update { it.copy(pendingImport = PendingImportFile(name, file)) }
    }

    fun dismissImport() = _uiState.update { it.copy(pendingImport = null) }

    /** Destructive restore; refreshes the profile afterwards (RN parity). */
    fun confirmImport() {
        val pending = _uiState.value.pendingImport ?: return
        if (_uiState.value.isImporting) return
        _uiState.update { it.copy(pendingImport = null, isImporting = true) }
        viewModelScope.launch {
            runCatching { dataBackupRepo.importBackup(pending.file) }
                .onSuccess { counts ->
                    toast(
                        toastText(
                            t("dataBackup.importSuccess"),
                            t("dataBackup.importSuccessDescription", "count" to counts.sumOf()),
                        ),
                    )
                    // The restore replaced all server data — refresh the cache.
                    runCatching { profileRepo.getMyProfile() }
                        .onSuccess { user -> _uiState.update { s -> s.copy(user = user.toProfileUser()) } }
                }
                .onFailure { error -> errorToast("dataBackup.importFailed", error) }
            _uiState.update { it.copy(isImporting = false) }
        }
    }

    // ---- logout ----

    /** Calls [AuthRepository.logout] (suspend) then [onLogout]. */
    fun logout(onLogout: () -> Unit) {
        if (_uiState.value.isLoggingOut) return
        _uiState.update { it.copy(isLoggingOut = true) }
        viewModelScope.launch {
            auth.logout()
            // Give the neutral sign-out toast a beat before the redirect
            // (RN showed the toast before router.replace).
            toast(
                toastText(t("profile.signedOut"), t("profile.signedOutDescription")),
            )
            delay(400)
            onLogout()
        }
    }
}

internal fun SessionUser.toProfileUser() = ProfileUser(
    id = id,
    username = username,
    firstName = firstName,
    lastName = lastName,
    email = email,
    thumbnailUrl = thumbnailUrl,
    profilePicUrl = profilePicUrl,
)

internal fun UserResponse.toProfileUser() = ProfileUser(
    id = id,
    username = username,
    firstName = firstName,
    lastName = lastName,
    email = email,
    thumbnailUrl = thumbnailUrl,
    profilePicUrl = profilePicUrl,
    privacyStatus = profilePrivacyStatus,
)

private fun RestoreCounts.sumOf(): Int =
    activities + timeRecords + calendarEvents + notes + routines +
        routineActivities + activityRecords + transactions + payments
