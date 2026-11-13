package com.lifetracker.mobile

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.lifetracker.core.designsystem.LbBottomNav
import com.lifetracker.core.designsystem.LocalToast
import com.lifetracker.core.designsystem.ToastHost
import com.lifetracker.core.designsystem.mainNavTabs
import com.lifetracker.core.designsystem.rememberToastState
import com.lifetracker.core.i18n.I18n
import com.lifetracker.core.network.SessionEvents
import com.lifetracker.domain.auth.AuthRepository
import com.lifetracker.feature.activities.ActivitiesScreen
import com.lifetracker.feature.auth.LoginScreen
import com.lifetracker.feature.auth.RegisterScreen
import com.lifetracker.feature.finance.FinanceDashboardScreen
import com.lifetracker.feature.finance.FinanceTransactionsScreen
import com.lifetracker.feature.notes.NotesScreen
import com.lifetracker.feature.profile.BackupScreen
import com.lifetracker.feature.profile.ProfileScreen
import com.lifetracker.feature.social.PublicProfileScreen
import com.lifetracker.feature.social.SocialScreen
import com.lifetracker.feature.time.TimeScreen

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
    // One app-root toast host (design-system intent): features show via
    // `LocalToast.current.show(...)`; no per-screen hosting or state.
    val toast = rememberToastState()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    LaunchedEffect(Unit) {
        sessionEvents.loggedOut.collect {
            navController.navigate(Routes.LOGIN) {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    // Re-resolve labels on runtime language switches.
    I18n.current
    val bottomNavItems = mainNavTabs()

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            CompositionLocalProvider(LocalToast provides toast) {
                NavHost(
                    navController = navController,
                    modifier = Modifier.weight(1f),
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
                    composable(Routes.ACTIVITIES) {
                        ActivitiesScreen(onNavigate = { navController.navigate(mapNavKey(it)) })
                    }
                    composable(Routes.TIME) {
                        TimeScreen(onNavigate = { navController.navigate(mapNavKey(it)) })
                    }
                    composable(Routes.NOTES) {
                        NotesScreen(onNavigate = { navController.navigate(mapNavKey(it)) })
                    }
                    composable(Routes.FINANCE_DASHBOARD) {
                        FinanceDashboardScreen(onNavigate = { navController.navigate(mapNavKey(it)) })
                    }
                    composable(Routes.FINANCE_TRANSACTIONS) {
                        FinanceTransactionsScreen(onNavigate = { navController.navigate(mapNavKey(it)) })
                    }
                    composable(Routes.SOCIAL) {
                        SocialScreen(
                            onNavigate = { navController.navigate(mapNavKey(it)) },
                            onOpenProfile = { username ->
                                navController.navigate("user/$username")
                            },
                        )
                    }
                    composable(Routes.PROFILE) {
                        ProfileScreen(
                            onLogout = { navController.navigate(Routes.LOGIN) { popUpTo(0) { inclusive = true } } },
                            onNavigate = { navController.navigate(mapNavKey(it)) },
                        )
                    }
                    composable(Routes.BACKUP) {
                        BackupScreen(onBack = { navController.popBackStack() })
                    }
                    composable(
                        route = Routes.PUBLIC_PROFILE,
                        arguments = listOf(navArgument("username") { type = NavType.StringType }),
                    ) { entry ->
                        PublicProfileScreen(
                            username = entry.arguments?.getString("username").orEmpty(),
                            onBack = { navController.popBackStack() },
                            onNavigate = { navController.navigate(mapNavKey(it)) },
                        )
                    }
                }
            }
            // Bottom navigation on the five main destinations only
            // (login/register/profile/backup/public profile are excluded).
            val selectedTab = tabKeyForRoute(currentRoute)
            if (selectedTab != null) {
                LbBottomNav(
                    items = bottomNavItems,
                    currentKey = selectedTab,
                    onSelect = { key ->
                        navController.navigate(mapNavKey(key)) {
                            popUpTo(navController.graph.startDestinationId) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }
        }
        ToastHost(state = toast)
    }
}

/** Route → selected bottom-nav tab key; null when the route has no tab bar. */
private fun tabKeyForRoute(route: String?): String? = when (route) {
    null -> null
    Routes.ACTIVITIES, Routes.TIME, Routes.NOTES, Routes.SOCIAL -> route
    Routes.FINANCE_TRANSACTIONS, Routes.FINANCE_DASHBOARD -> Routes.FINANCE_TRANSACTIONS
    else -> null
}

private fun navigateMain(navController: NavHostController) {
    navController.navigate(Routes.ACTIVITIES) {
        popUpTo(0) { inclusive = true }
    }
}
