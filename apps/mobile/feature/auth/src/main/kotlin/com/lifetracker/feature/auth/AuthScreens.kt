package com.lifetracker.feature.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.lifetracker.core.designsystem.ThemeController
import com.lifetracker.core.designsystem.ThemePreference
import com.lifetracker.core.i18n.I18n

/**
 * Phase 1 gate: login stub that proves both themes (light/dark/system) and
 * both languages (es/en) switch correctly at runtime. Replaced in Phase 3.1
 * with the real login form (port of `app/login.tsx`).
 */
@Composable
fun LoginPlaceholder() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(32.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "Life Tracker",
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground,
        )
        // Proves the runtime i18n switcher re-resolves strings.
        Text(
            text = I18n.t("common.cancel"),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onBackground,
        )
        TextButton(onClick = {
            ThemeController.preference = when (ThemeController.preference) {
                ThemePreference.SYSTEM -> ThemePreference.LIGHT
                ThemePreference.LIGHT -> ThemePreference.DARK
                ThemePreference.DARK -> ThemePreference.SYSTEM
            }
        }) {
            Text("theme: ${ThemeController.preference.name.lowercase()}")
        }
        TextButton(onClick = {
            I18n.setLanguage(when (I18n.current) {
                I18n.Language.ENGLISH -> I18n.Language.SPANISH
                I18n.Language.SPANISH -> I18n.Language.ENGLISH
            })
        }) {
            Text("language: ${I18n.current.code}")
        }
        Button(onClick = {}) {
            Text("register →")
        }
    }
}

@Composable
fun RegisterPlaceholder() {
    Column {}
}
