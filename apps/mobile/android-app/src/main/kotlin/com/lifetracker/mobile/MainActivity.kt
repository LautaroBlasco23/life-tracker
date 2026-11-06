package com.lifetracker.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.lifetracker.core.designsystem.LifeTrackerTheme
import com.lifetracker.core.designsystem.ThemeController
import com.lifetracker.core.designsystem.ThemePreference
import com.lifetracker.core.i18n.I18n
import com.lifetracker.core.storage.SettingsRepository
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

/**
 * Bridges persisted settings (DataStore) into the theme/i18n singletons, so
 * the Phase 1 toggles and Phase 2 persistence cooperate.
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var settings: SettingsRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        installSplashScreen()
        enableEdgeToEdge()
        setContent { SettingsBridge() }
    }

    @Composable
    private fun SettingsBridge() {
        val themePref by settings.theme.collectAsState(initial = "system")
        val lang by settings.language.collectAsState(initial = "en")

        LaunchedEffect(themePref) {
            ThemeController.preference = when (themePref) {
                "light" -> ThemePreference.LIGHT
                "dark" -> ThemePreference.DARK
                else -> ThemePreference.SYSTEM
            }
        }
        LaunchedEffect(lang) {
            I18n.Language.entries.firstOrNull { it.code == lang }?.let { I18n.setLanguage(it) }
        }

        LifeTrackerTheme { AppHost() }
    }
}
