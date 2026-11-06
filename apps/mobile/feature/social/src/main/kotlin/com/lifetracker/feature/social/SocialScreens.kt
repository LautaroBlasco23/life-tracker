package com.lifetracker.feature.social

import androidx.compose.runtime.Composable

/** Replaced in Phase 3.6. */
@Composable
fun SocialPlaceholder() = com.lifetracker.core.designsystem.PlaceholderScreen("Social")

@Composable
fun PublicProfilePlaceholder(username: String) =
    com.lifetracker.core.designsystem.PlaceholderScreen("Public profile · @$username")
