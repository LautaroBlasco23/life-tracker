package com.lifetracker.mobile

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.lifetracker.domain.auth.AuthRepository
import com.lifetracker.core.network.SessionEvents
import com.lifetracker.feature.activities.ActivitiesScreen
import com.lifetracker.feature.auth.LoginScreen
import com.lifetracker.feature.auth.RegisterScreen
import com.lifetracker.feature.time.TimeScreen
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

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

/** RN hamburger entry keys (screens call `onNavigate("<key>")`) → nav routes. */
private fun mapNavKey(key: String): String = when (key) {
    "activities" -> Routes.ACTIVITIES
    "time" -> Routes.TIME
    "notes" -> Routes.NOTES
    "finance/dashboard" -> Routes.FINANCE_DASHBOARD
    "finance/transactions" -> Routes.FINANCE_TRANSACTIONS
    "social" -> Routes.SOCIAL
    "profile" -> Routes.PROFILE
    else -> Routes.ACTIVITIES
}

/**
 * Port of the RN app routing (`index.tsx` gate + expo-router structure):
 * Stack-only nav; start at /activities when authenticated, /login otherwise;
 * force-logout events (refresh chain exhausted) snap the user back to login.
 */
@Composable
fun AppHost(auth: AuthRepository, sessionEvents: SessionEvents) {
    val navController = rememberNavController()

    LaunchedEffect(Unit) {
        sessionEvents.loggedOut.collect {
            navController.navigate(Routes.LOGIN) {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    NavHost(
        navController = navController,
        startDestination = if (auth.isAuthenticated) Routes.ACTIVITIES else Routes.LOGIN,
    ) {
        composable(Routes.LOGIN) {
            LoginScreen(
                onLoginSuccess = { navigateMain(navController) },
                onNavigateToRegister = { navController.navigate(Routes.REGISTER) },
            )
        }
        composable(Routes.REGISTER) {
            RegisterScreen(
                onRegisterSuccess = { navigateMain(navController) },
                onBack = { navController.popBackStack() },
            )
        }
        composable(Routes.ACTIVITIES) { ActivitiesScreen(onNavigate = { mapNavKey(it).let(navController::navigate) }) }
        composable(Routes.TIME) { TimeScreen(onNavigate = { mapNavKey(it).let(navController::navigate) }) }
        composable(
            route = Routes.PUBLIC_PROFILE,
            arguments = listOf(navArgument("username") { type = NavType.StringType }),
        ) { entry ->
            // Wired in Wave 3 (social feature).
        }
    }
}

private fun navigateMain(navController: NavHostController) {
    navController.navigate(Routes.ACTIVITIES) {
        popUpTo(0) { inclusive = true }
    }
}
