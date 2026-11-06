package com.lifetracker.mobile

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.lifetracker.feature.activities.ActivitiesPlaceholder
import com.lifetracker.feature.auth.LoginPlaceholder
import com.lifetracker.feature.auth.RegisterPlaceholder
import com.lifetracker.feature.finance.FinanceDashboardPlaceholder
import com.lifetracker.feature.finance.FinanceTransactionsPlaceholder
import com.lifetracker.feature.notes.NotesPlaceholder
import com.lifetracker.feature.profile.BackupPlaceholder
import com.lifetracker.feature.profile.ProfilePlaceholder
import com.lifetracker.feature.social.PublicProfilePlaceholder
import com.lifetracker.feature.social.SocialPlaceholder
import com.lifetracker.feature.time.TimePlaceholder

object Routes {
    const val LOGIN = "login"
    const val REGISTER = "register"
    const val ACTIVITIES = "activities"
    const val TIME = "time"
    const val NOTES = "notes"
    const val FINANCE_DASHBOARD = "finance/dashboard"
    const val FINANCE_TRANSACTIONS = "finance/transactions"
    const val SOCIAL = "social"
    const val PROFILE = "profile"
    const val BACKUP = "profile/backup"
    const val PUBLIC_PROFILE = "user/{username}"
}

/**
 * One nav graph mirroring today's expo-router structure: Stack-only with the
 * custom header/hamburger nav inked in Phase 3 as a shared scaffold.
 */
@Composable
fun AppHost() {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = Routes.LOGIN) {
        composable(Routes.LOGIN) { LoginPlaceholder() }
        composable(Routes.REGISTER) { RegisterPlaceholder() }
        composable(Routes.ACTIVITIES) { ActivitiesPlaceholder() }
        composable(Routes.TIME) { TimePlaceholder() }
        composable(Routes.NOTES) { NotesPlaceholder() }
        composable(Routes.FINANCE_DASHBOARD) { FinanceDashboardPlaceholder() }
        composable(Routes.FINANCE_TRANSACTIONS) { FinanceTransactionsPlaceholder() }
        composable(Routes.SOCIAL) { SocialPlaceholder() }
        composable(Routes.PROFILE) { ProfilePlaceholder() }
        composable(Routes.BACKUP) { BackupPlaceholder() }
        composable(
            route = Routes.PUBLIC_PROFILE,
            arguments = listOf(navArgument("username") { type = NavType.StringType }),
        ) { entry ->
            PublicProfilePlaceholder(username = entry.arguments?.getString("username").orEmpty())
        }
    }
}
