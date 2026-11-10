package com.lifetracker.feature.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.lifetracker.core.designsystem.LbButton
import com.lifetracker.core.designsystem.LbButtonVariant
import com.lifetracker.core.designsystem.LbModalSheet
import com.lifetracker.core.designsystem.LbTextField
import com.lifetracker.core.designsystem.LocalAppColors
import com.lifetracker.core.designsystem.ThemeController
import com.lifetracker.core.designsystem.ThemePreference
import com.lifetracker.core.designsystem.ToastHost
import com.lifetracker.core.designsystem.rememberToastState
import com.lifetracker.core.i18n.I18n
import com.lifetracker.domain.profile.DEFAULT_BACKUP_FILENAME
import kotlinx.coroutines.delay

/**
 * Port of `app/(app)/profile.tsx` plus `lib/data-backup.ts` flows —
 * ProfileCommon provides `t`/`toastText`, ScreenActions the ActivityResult
 * wiring + [AvatarImage], ProfileViewModel owns the state machine.
 */
@Composable
fun ProfileScreen(onLogout: () -> Unit, onNavigate: (String) -> Unit) {
    val viewModel: ProfileViewModel = hiltViewModel()
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val toast = rememberToastState()
    val colors = LocalAppColors.current

    LaunchedEffect(Unit) { viewModel.refreshProfile() }
    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is ProfileEvent.Toast -> toast.show(event.text, event.isError)
            }
        }
    }

    val actions = rememberProfileActivityResultActions(viewModel)
    var showApiUrlModal by rememberSaveable { mutableStateOf(false) }
    var showPasswordModal by rememberSaveable { mutableStateOf(false) }
    var showEmailModal by rememberSaveable { mutableStateOf(false) }

    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        ) {
            Text(I18n.t("profile.title"), fontSize = 24.sp, fontWeight = FontWeight.SemiBold, color = colors.foreground)
            Text(I18n.t("profile.description"), fontSize = 12.sp, color = colors.textMuted)
            Spacer(Modifier.height(24.dp))

            // --- profile picture ---
            CardShell {
                Column(Modifier.padding(16.dp)) {
                    val user = state.user
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        AvatarImage(
                            url = user?.thumbnailUrl ?: user?.profilePicUrl,
                            firstName = user?.firstName ?: "?",
                        )
                        Spacer(Modifier.width(16.dp))
                        Column {
                            Text(
                                I18n.t("profile.changePicture"),
                                fontSize = 14.sp,
                                color = colors.primary,
                                modifier = Modifier.clickable { actions.pickAvatar() },
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                I18n.t("common.delete"),
                                fontSize = 14.sp,
                                color = colors.danger,
                                modifier = Modifier.clickable { viewModel.removeImage() },
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(24.dp))

            // --- settings rows (RN account card) ---
            Column(
                Modifier
                    .fillMaxWidth()
                    .border(1.dp, colors.border, RoundedCornerShape(12.dp)),
            ) {
                val privacyLabel = when (state.user?.privacyStatus) {
                    "public" -> I18n.t("privacy.public")
                    else -> I18n.t("privacy.private")
                }
                SettingsRow(
                    label = I18n.t("privacy.profilePrivacy"),
                    value = privacyLabel,
                    onClick = { viewModel.togglePrivacy() },
                    icon = Icons.Outlined.Lock,
                )
                val themePref = ThemeController.preference
                SettingsRow(
                    label = t("theme"),
                    value = if (themePref == ThemePreference.DARK) t("dark") else t("light"),
                    onClick = {
                        viewModel.setTheme(
                            if (themePref == ThemePreference.DARK) ThemePreference.LIGHT else ThemePreference.DARK,
                        )
                    },
                )
                SettingsRow(
                    label = t("language"),
                    value = if (I18n.current == I18n.Language.SPANISH) t("spanish") else t("english"),
                    onClick = {
                        viewModel.setLanguage(if (I18n.current == I18n.Language.SPANISH) "en" else "es")
                    },
                )
                SettingsRow(
                    label = t("apiUrl"),
                    value = state.apiUrl.ifBlank { "—" },
                    onClick = { showApiUrlModal = true },
                )
            }

            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                Box(Modifier.weight(1f)) {
                    LbButton(
                        text = I18n.t("profile.changePassword"),
                        onClick = { showPasswordModal = true },
                        variant = LbButtonVariant.SECONDARY,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                Box(Modifier.weight(1f)) {
                    LbButton(
                        text = I18n.t("profile.changeEmail"),
                        onClick = { showEmailModal = true },
                        variant = LbButtonVariant.SECONDARY,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }

            Spacer(Modifier.height(24.dp))
            Text(I18n.t("dataBackup.title"), fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = colors.foreground)
            Text(I18n.t("dataBackup.description"), fontSize = 12.sp, color = colors.textMuted)
            Spacer(Modifier.height(8.dp))
            CardShell {
                Column(Modifier.padding(16.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                        Box(Modifier.weight(1f)) {
                            LbButton(
                                text = if (state.isExporting) I18n.t("dataBackup.exporting") else I18n.t("dataBackup.exportButton"),
                                onClick = { actions.launchExport(DEFAULT_BACKUP_FILENAME) },
                                variant = LbButtonVariant.SECONDARY,
                                enabled = !state.isExporting && !state.isImporting,
                                loading = state.isExporting,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                        Box(Modifier.weight(1f)) {
                            LbButton(
                                text = if (state.isImporting) I18n.t("dataBackup.importing") else I18n.t("dataBackup.importButton"),
                                onClick = { actions.launchImport() },
                                variant = LbButtonVariant.SECONDARY,
                                enabled = !state.isExporting && !state.isImporting,
                                loading = state.isImporting,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(I18n.t("dataBackup.backupHint"), fontSize = 11.sp, color = colors.textMuted)
                }
            }

            Spacer(Modifier.height(24.dp))
            LbButton(
                text = I18n.t("profile.signOut"),
                onClick = { viewModel.logout(onLogout) },
                variant = LbButtonVariant.DANGER,
                enabled = !state.isLoggingOut,
                loading = state.isLoggingOut,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        ToastHost(toast)
    }

    // --- modals ---
    if (showApiUrlModal) {
        val context = LocalContext.current
        val isDebug = (context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0
        ApiUrlModal(
            visible = true,
            current = state.apiUrl,
            isDebug = isDebug,
            onSave = { input, onResult -> viewModel.saveApiUrl(input, isDebug, onResult) },
            onDismiss = { showApiUrlModal = false },
        )
    }
    if (showPasswordModal) {
        UpdatePasswordModal(
            visible = true,
            viewModel = viewModel,
            onDismiss = { showPasswordModal = false },
        )
    }
    if (showEmailModal) {
        UpdateEmailModal(
            visible = true,
            currentEmail = state.user?.email ?: "",
            viewModel = viewModel,
            onDismiss = { showEmailModal = false },
        )
    }
}

/** RN route shim: the backup card gets its own focused screen (same VM). */
@Composable
fun BackupScreen(onBack: () -> Unit) {
    val viewModel: ProfileViewModel = hiltViewModel()
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val toast = rememberToastState()
    val colors = LocalAppColors.current
    val actions = rememberProfileActivityResultActions(viewModel)

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is ProfileEvent.Toast -> toast.show(event.text, event.isError)
            }
        }
    }

    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Text(I18n.t("dataBackup.title"), fontSize = 22.sp, fontWeight = FontWeight.SemiBold, color = colors.foreground)
            Text(I18n.t("dataBackup.description"), fontSize = 12.sp, color = colors.textMuted)
            Spacer(Modifier.height(16.dp))
            LbButton(
                text = if (state.isExporting) I18n.t("dataBackup.exporting") else I18n.t("dataBackup.exportButton"),
                onClick = { actions.launchExport(DEFAULT_BACKUP_FILENAME) },
                enabled = !state.isExporting && !state.isImporting,
                loading = state.isExporting,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(12.dp))
            LbButton(
                text = if (state.isImporting) I18n.t("dataBackup.importing") else I18n.t("dataBackup.importButton"),
                onClick = { actions.launchImport() },
                variant = LbButtonVariant.SECONDARY,
                enabled = !state.isExporting && !state.isImporting,
                loading = state.isImporting,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(16.dp))
            Text(I18n.t("dataBackup.backupHint"), fontSize = 11.sp, color = colors.textMuted)
        }
        ToastHost(toast)
    }

    state.pendingImport?.let { pending ->
        com.lifetracker.core.designsystem.LbDeleteConfirm(
            visible = true,
            name = pending.name,
            onDismiss = { viewModel.dismissImport() },
            onConfirm = { viewModel.confirmImport() },
            title = I18n.t("dataBackup.importWarningTitle"),
            message = I18n.t("dataBackup.importWarningDescription").replace("{filename}", pending.name),
            deleteLabel = I18n.t("dataBackup.importConfirm"),
        )
    }
}

@Composable
internal fun CardShell(content: @Composable () -> Unit) {
    val colors = LocalAppColors.current
    Column(
        Modifier
            .fillMaxWidth()
            .border(1.dp, colors.border, RoundedCornerShape(12.dp))
            .background(colors.surface),
    ) {
        content()
    }
}

@Composable
private fun SettingsRow(
    label: String,
    value: String,
    onClick: () -> Unit,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null,
) {
    val colors = LocalAppColors.current
    Column(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp)
            .background(MaterialTheme.colorScheme.background),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            icon?.let {
                Icon(it, null, tint = colors.textMuted, modifier = Modifier.height(18.dp))
                Spacer(Modifier.width(8.dp))
            }
            Text(label, Modifier.weight(1f), fontSize = 14.sp, color = colors.foreground)
            Spacer(Modifier.width(8.dp))
            Text(value, fontSize = 14.sp, color = colors.textMuted)
            Spacer(Modifier.width(4.dp))
            Icon(Icons.Outlined.ChevronRight, null, tint = colors.textMuted, modifier = Modifier.height(18.dp))
        }
    }
}

@Composable
internal fun ApiUrlModal(
    visible: Boolean,
    current: String,
    isDebug: Boolean,
    onSave: (input: String, onResult: (Boolean) -> Unit) -> Unit,
    onDismiss: () -> Unit,
) {
    var input by rememberSaveable { mutableStateOf(current) }
    var saving by rememberSaveable { mutableStateOf(false) }
    val colors = LocalAppColors.current

    LbModalSheet(visible = visible, onDismiss = onDismiss, title = t("apiUrl")) {
        Text(
            I18n.t("profile.pictureSizeHint").let { hint -> hint }, // muted helper line (RN used a paragraph under the field)
            fontSize = 12.sp,
            color = colors.textMuted,
        )
        Spacer(Modifier.height(12.dp))
        LbTextField(value = input, onValueChange = { input = it }, label = t("apiUrl"))
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            Box(Modifier.weight(1f)) {
                LbButton(
                    text = I18n.t("common.cancel"),
                    onClick = onDismiss,
                    variant = LbButtonVariant.SECONDARY,
                    enabled = !saving,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            Box(Modifier.weight(1f)) {
                LbButton(
                    text = I18n.t("common.save"),
                    onClick = {
                        saving = true
                        onSave(input) { applied ->
                            saving = false
                            if (applied) onDismiss()
                        }
                    },
                    enabled = !saving,
                    loading = saving,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
internal fun UpdatePasswordModal(
    visible: Boolean,
    viewModel: ProfileViewModel,
    onDismiss: () -> Unit,
) {
    val toast = rememberToastState()
    val colors = LocalAppColors.current
    var currentPassword by rememberSaveable { mutableStateOf("") }
    var newPassword by rememberSaveable { mutableStateOf("") }
    var confirmNewPassword by rememberSaveable { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }

    LbModalSheet(visible = visible, onDismiss = onDismiss, title = I18n.t("updatePassword.title")) {
        Text(I18n.t("updatePassword.description"), fontSize = 12.sp, color = colors.textMuted)
        Spacer(Modifier.height(12.dp))
        LbTextField(value = currentPassword, onValueChange = { currentPassword = it }, label = I18n.t("updatePassword.currentPassword"), secure = true)
        Spacer(Modifier.height(8.dp))
        LbTextField(value = newPassword, onValueChange = { newPassword = it }, label = I18n.t("updatePassword.newPassword"), secure = true)
        Spacer(Modifier.height(8.dp))
        LbTextField(value = confirmNewPassword, onValueChange = { confirmNewPassword = it }, label = I18n.t("updatePassword.confirmNewPassword"), secure = true)
        if (confirmNewPassword.isNotEmpty() && confirmNewPassword != newPassword) {
            Spacer(Modifier.height(4.dp))
            Text(I18n.t("updatePassword.passwordsDoNotMatch"), fontSize = 12.sp, color = colors.danger)
        }
        Spacer(Modifier.height(16.dp))
        LbButton(
            text = if (submitting) I18n.t("updatePassword.updating") else I18n.t("updatePassword.updatePassword"),
            onClick = {
                when {
                    confirmNewPassword != newPassword -> toast.show(
                        toastText(I18n.t("updatePassword.passwordsDoNotMatch"), I18n.t("updatePassword.passwordsDoNotMatchDescription")),
                        isError = true,
                    )
                    newPassword.length < 8 -> toast.show(
                        toastText(I18n.t("updatePassword.passwordTooShort"), I18n.t("updatePassword.passwordTooShortDescription")),
                        isError = true,
                    )
                    else -> {
                        submitting = true
                        viewModel.changePassword(currentPassword, newPassword) { ok ->
                            submitting = false
                            if (ok) onDismiss()
                        }
                    }
                }
            },
            enabled = !submitting &&
                currentPassword.isNotBlank() && newPassword.isNotBlank() && confirmNewPassword.isNotBlank(),
            loading = submitting,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
internal fun UpdateEmailModal(
    visible: Boolean,
    currentEmail: String,
    viewModel: ProfileViewModel,
    onDismiss: () -> Unit,
) {
    val toast = rememberToastState()
    val colors = LocalAppColors.current
    var newEmail by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }
    var available by remember { mutableStateOf<Boolean?>(null) }
    val sameEmail = newEmail.isNotBlank() && newEmail == currentEmail

    LaunchedEffect(newEmail) {
        if (newEmail.isBlank() || sameEmail) {
            available = null
            return@LaunchedEffect
        }
        delay(500)
        available = viewModel.checkEmail(newEmail)
    }

    LbModalSheet(visible = visible, onDismiss = onDismiss, title = I18n.t("updateEmail.title")) {
        Text(I18n.t("updateEmail.description"), fontSize = 12.sp, color = colors.textMuted)
        Spacer(Modifier.height(12.dp))
        Text(I18n.t("updateEmail.currentEmail"), fontSize = 14.sp, color = colors.foreground)
        Text(currentEmail, fontSize = 13.sp, color = colors.textMuted)
        Spacer(Modifier.height(12.dp))
        LbTextField(value = newEmail, onValueChange = { newEmail = it }, label = I18n.t("updateEmail.newEmail"), placeholder = I18n.t("updateEmail.newEmailPlaceholder"))
        when (available) {
            true -> Text(I18n.t("updateEmail.emailAvailable"), fontSize = 12.sp, color = colors.success)
            false -> Text(I18n.t("updateEmail.emailTaken"), fontSize = 12.sp, color = colors.danger)
            null -> {}
        }
        if (sameEmail) {
            Text(
                toastText(I18n.t("updateEmail.sameEmail"), I18n.t("updateEmail.sameEmailDescription")),
                fontSize = 12.sp,
                color = colors.danger,
            )
        }
        Spacer(Modifier.height(12.dp))
        LbTextField(value = password, onValueChange = { password = it }, label = I18n.t("updateEmail.password"), placeholder = I18n.t("updateEmail.passwordPlaceholder"), secure = true)
        Spacer(Modifier.height(8.dp))
        Text(I18n.t("updateEmail.passwordHint"), fontSize = 11.sp, color = colors.textMuted)
        Spacer(Modifier.height(16.dp))
        LbButton(
            text = if (submitting) I18n.t("updateEmail.updating") else I18n.t("updateEmail.updateEmail"),
            onClick = {
                submitting = true
                viewModel.changeEmail(password, newEmail) { ok ->
                    submitting = false
                    if (ok) onDismiss()
                }
            },
            enabled = !submitting && newEmail.isNotBlank() && password.isNotBlank() && !sameEmail && (available ?: true),
            loading = submitting,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
