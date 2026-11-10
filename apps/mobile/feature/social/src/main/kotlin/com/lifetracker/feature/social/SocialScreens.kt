package com.lifetracker.feature.social

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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.HowToReg
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.MonitorHeart
import androidx.compose.material.icons.outlined.PieChart
import androidx.compose.material.icons.outlined.StickyNote2
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material.icons.outlined.Wallet
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.lifetracker.core.designsystem.AppHeader
import com.lifetracker.core.designsystem.LbButton
import com.lifetracker.core.designsystem.LbButtonVariant
import com.lifetracker.core.designsystem.LbCard
import com.lifetracker.core.designsystem.LbSegmentedTabs
import com.lifetracker.core.designsystem.LbStreakBadge
import com.lifetracker.core.designsystem.LbTextField
import com.lifetracker.core.designsystem.LocalAppColors
import com.lifetracker.core.designsystem.LocalToast
import com.lifetracker.core.designsystem.NavEntry
import com.lifetracker.core.designsystem.ToastHost
import com.lifetracker.core.i18n.I18n
import com.lifetracker.core.network.model.FollowStatus
import com.lifetracker.core.network.model.FollowerItem
import com.lifetracker.core.network.model.DayTime
import com.lifetracker.core.network.model.Frequency
import com.lifetracker.core.network.model.PrivacyStatus
import com.lifetracker.core.network.model.PublicActivityCard
import com.lifetracker.core.network.model.PublicRoutineCard
import com.lifetracker.core.network.model.PublicUserCard
import com.lifetracker.core.network.model.SubscriptionSourceType
import kotlinx.coroutines.launch

/*
 * Port of `app/(app)/social.tsx` and `app/user/[username].tsx`.
 */

/** The six drawer destinations of RN `components/navigation.tsx`. */
private val socialNavItems = listOf(
    NavEntry("activities", I18n.t("nav.activities"), Icons.Outlined.MonitorHeart),
    NavEntry("time", I18n.t("nav.timeTracker"), Icons.Outlined.Timer),
    NavEntry("notes", I18n.t("nav.notes"), Icons.Outlined.StickyNote2),
    NavEntry("finance/transactions", I18n.t("nav.financeTransactions"), Icons.Outlined.Wallet),
    NavEntry("finance/dashboard", I18n.t("nav.financeDashboard"), Icons.Outlined.PieChart),
    NavEntry("social", I18n.t("nav.social"), Icons.Outlined.People),
)

@Composable
fun SocialScreen(
    onNavigate: (String) -> Unit = {},
    onOpenProfile: (username: String) -> Unit,
) {
    val viewModel: SocialViewModel = hiltViewModel()
    val state by viewModel.uiState.collectAsState()
    val scope = rememberCoroutineScope()
    val toast = LocalToast.current
    val colors = LocalAppColors.current

    // RN `view` component state: 0 = search tab, 1 = requests tab.
    var view by rememberSaveable { mutableStateOf(0) }

    // Focus-refetch (RN useFocusEffect): pending requests reload on re-entry.
    LaunchedEffect(viewModel) {
        viewModel.refresh()
    }
    LaunchedEffect(viewModel) {
        viewModel.messages.collect { toast.show(it.text, it.isError) }
    }
    I18n.current

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background),
    ) {
        Column(Modifier.fillMaxSize()) {
            AppHeader(
            title = "LifeTracker",
            items = socialNavItems,
            currentKey = "social",
            onNavigate = onNavigate,
        )

        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 96.dp),
        ) {
            item {
                Column(Modifier.padding(horizontal = 16.dp).padding(top = 16.dp)) {
                    Text(
                        text = I18n.t("social.title"),
                        fontSize = 24.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = colors.foreground,
                    )
                    Text(
                        text = I18n.t("social.description"),
                        fontSize = 14.sp,
                        color = colors.textMuted,
                        modifier = Modifier.padding(top = 4.dp),
                    )

                    val requestsLabel = I18n.t("social.requests") +
                        (state.pendingRequests.takeIf { it.isNotEmpty() }
                            ?.let { " (${it.size})" } ?: "")
                    LbSegmentedTabs(
                        items = listOf(I18n.t("social.findFriends"), requestsLabel),
                        selectedIndex = view,
                        onSelect = { view = it },
                        modifier = Modifier.padding(top = 16.dp),
                    )

                    if (view == 0) {
                        LbTextField(
                            value = state.searchQuery,
                            onValueChange = viewModel::onSearchQueryChange,
                            placeholder = I18n.t("social.searchPlaceholder"),
                            modifier = Modifier.padding(bottom = 16.dp),
                        )
                    }
                }
            }

            if (view == 0) {
                items(state.results.size, key = { index -> "u${state.results[index].id}" }) { index ->
                    val user = state.results[index]
                    SearchResultCard(
                        user = user,
                        processing = user.id in state.processingIds,
                        onOpenProfile = { onOpenProfile(user.username) },
                        onFollow = { scope.launch { viewModel.follow(user) } },
                        onUnfollow = { scope.launch { viewModel.unfollow(user) } },
                    )
                }
                if (state.isSearching && state.results.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(top = 40.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            CircularProgressIndicator(color = colors.primary)
                        }
                    }
                } else {
                    item {
                        socialEmptyState(
                            when {
                                state.hasSearched -> SocialEmptyKind.NoResults
                                else -> SocialEmptyKind.SearchHint
                            }
                        )
                    }
                }
            } else {
                items(state.pendingRequests.size, key = { i -> "r${state.pendingRequests[i].userId}" }) { i ->
                    val follower = state.pendingRequests[i]
                    FollowerRequestCard(
                        follower = follower,
                        onAccept = { scope.launch { viewModel.accept(follower) } },
                        onReject = { scope.launch { viewModel.reject(follower) } },
                        accepting = follower.userId in state.processingIds,
                    )
                }
                if (state.isLoadingRequests) {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(top = 40.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            CircularProgressIndicator(color = colors.primary)
                        }
                    }
                } else if (state.pendingRequests.isEmpty()) {
                    item {
                        socialEmptyState(SocialEmptyKind.NoRequests)
                    }
                }
            }
        }
        }

        // Toast overlay (per-screen until the AppHost hosts it globally).
        ToastHost(state = toast)
    }
}

/** RN empty-state variants of the social screen. */
private enum class SocialEmptyKind { NoResults, SearchHint, NoRequests }

@Composable
private fun socialEmptyState(kind: SocialEmptyKind) {
    val colors = LocalAppColors.current
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 40.dp),
    ) {
        val icon = when (kind) {
            SocialEmptyKind.NoResults -> Icons.Outlined.Search
            SocialEmptyKind.SearchHint -> Icons.Outlined.PersonAdd
            SocialEmptyKind.NoRequests -> Icons.Outlined.HowToReg
        }
        Icon(imageVector = icon, contentDescription = null, tint = colors.primary, modifier = Modifier.size(32.dp))
        when (kind) {
            SocialEmptyKind.NoResults -> {
                EmptyText(I18n.t("social.noResults"), 18.sp, colors.foreground, FontWeight.Medium)
                EmptyText(I18n.t("social.tryDifferentSearch"), 14.sp, colors.textMuted)
            }
            SocialEmptyKind.SearchHint -> {
                EmptyText(I18n.t("social.searchPlaceholder"), 14.sp, colors.textMuted)
            }
            SocialEmptyKind.NoRequests -> {
                EmptyText(I18n.t("social.noPendingRequests"), 18.sp, colors.foreground, FontWeight.Medium)
                EmptyText(I18n.t("social.requestsAppearHere"), 14.sp, colors.textMuted)
            }
        }
    }
}

@Composable
private fun EmptyText(
    text: String,
    size: androidx.compose.ui.unit.TextUnit,
    color: androidx.compose.ui.graphics.Color,
    weight: FontWeight? = null,
) {
    Text(
        text = text,
        fontSize = size,
        fontWeight = weight,
        color = color,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = 8.dp),
    )
}

/** Search result card: name (+ Private badge), @username, follow control. */
@Composable
private fun SearchResultCard(
    user: PublicUserCard,
    processing: Boolean,
    onOpenProfile: () -> Unit,
    onFollow: () -> Unit,
    onUnfollow: () -> Unit,
) {
    val colors = LocalAppColors.current
    LbCard(
        modifier = Modifier
            .padding(horizontal = 16.dp)
            .padding(bottom = 8.dp)
            .fillMaxWidth(),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(end = 12.dp)
                    .clickable(onClick = onOpenProfile),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "${user.firstName} ${user.lastName}",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium,
                        color = colors.foreground,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (user.profilePrivacyStatus == PrivacyStatus.PRIVATE) {
                        Spacer(Modifier.width(8.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(colors.primary.copy(alpha = 0.1f))
                                .padding(horizontal = 8.dp, vertical = 2.dp),
                        ) {
                            Text(
                                text = I18n.t("social.private"),
                                fontSize = 12.sp,
                                color = colors.textMuted,
                            )
                        }
                    }
                }
                Text(
                    text = "@${user.username}",
                    fontSize = 14.sp,
                    color = colors.textMuted,
                    modifier = Modifier.padding(top = 2.dp),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            when {
                processing -> CircularProgressIndicator(color = colors.primary, modifier = Modifier.size(24.dp))
                user.followStatus == FollowStatus.PENDING -> Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(colors.background)
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                ) {
                    Text(
                        text = I18n.t("social.pending"),
                        fontSize = 12.sp,
                        color = colors.textMuted,
                    )
                }
                user.isFollowing -> CompactButton(
                    text = I18n.t("social.following"),
                    outline = true,
                    onClick = onUnfollow,
                )
                else -> CompactButton(
                    text = I18n.t("social.follow"),
                    onClick = onFollow,
                )
            }
        }
    }
}

/** Pending request card: name, @username + "wants to follow", Accept/Reject. */
@Composable
private fun FollowerRequestCard(
    follower: FollowerItem,
    accepting: Boolean,
    onAccept: () -> Unit,
    onReject: () -> Unit,
) {
    val colors = LocalAppColors.current
    LbCard(
        modifier = Modifier
            .padding(horizontal = 16.dp)
            .padding(bottom = 8.dp)
            .fillMaxWidth(),
    ) {
        Text(
            text = "${follower.firstName} ${follower.lastName}",
            fontSize = 16.sp,
            fontWeight = FontWeight.Medium,
            color = colors.foreground,
        )
        Text(
            text = "@${follower.username} · ${I18n.t("social.wantsToFollow")}",
            fontSize = 14.sp,
            color = colors.textMuted,
            modifier = Modifier.padding(top = 2.dp, bottom = 12.dp),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            LbButton(
                text = I18n.t("social.accept"),
                onClick = onAccept,
                loading = accepting,
                modifier = Modifier.weight(1f),
            )
            LbButton(
                text = I18n.t("social.reject"),
                variant = LbButtonVariant.SECONDARY,
                onClick = onReject,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

/** 36 px compact follow button (RN `h-9 px-3` Button variants). */
@Composable
private fun CompactButton(
    text: String,
    onClick: () -> Unit,
    outline: Boolean = false,
) {
    val colors = LocalAppColors.current
    Box(
        modifier = Modifier
            .height(36.dp)
            .clip(RoundedCornerShape(8.dp))
            .then(
                if (outline) {
                    // RN `variant="outline"`: transparent bg + 1px border.
                    Modifier.border(1.dp, colors.border, RoundedCornerShape(8.dp))
                } else {
                    Modifier.background(colors.primary)
                }
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = if (outline) colors.foreground else colors.primaryForeground,
        )
    }
}

// ---------------------------------------------------------------------------
// Public profile (app/user/[username].tsx)
// ---------------------------------------------------------------------------

@Composable
fun PublicProfileScreen(
    username: String,
    onBack: () -> Unit,
    onNavigate: (String) -> Unit = {},
) {
    val viewModel: PublicProfileViewModel = hiltViewModel()
    val state by viewModel.uiState.collectAsState()
    val toast = LocalToast.current
    val colors = LocalAppColors.current

    // Focus-refetch (RN useFocusEffect re-runs loadProfile on re-entry).
    LaunchedEffect(username) {
        viewModel.refresh(username)
    }
    LaunchedEffect(viewModel) {
        viewModel.messages.collect { toast.show(it.text, it.isError) }
    }
    I18n.current

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background),
    ) {
        ToastHost(state = toast)
        when {
            state.isLoading -> Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(color = colors.primary)
            }

            state.notFound || state.profile == null -> Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
            ) {
                Text(
                    text = I18n.t("profilePublic.notFound"),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Medium,
                    color = colors.foreground,
                )
                LbButton(
                    text = I18n.t("profilePublic.backToSocial"),
                    variant = LbButtonVariant.SECONDARY,
                    onClick = onBack,
                    modifier = Modifier.padding(top = 16.dp),
                )
            }

            else -> {
                val profile = state.profile ?: return@Box
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                ) {
                    // Header row: back chevron + @username.
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Outlined.ArrowBack,
                            contentDescription = I18n.t("common.back"),
                            tint = colors.primary,
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .clickable(onClick = onBack)
                                .padding(8.dp),
                        )
                        Text(
                            text = "@${profile.username}",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = colors.foreground,
                            modifier = Modifier.padding(start = 4.dp),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }

                    Text(
                        text = "${profile.firstName} ${profile.lastName}",
                        fontSize = 24.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = colors.foreground,
                        modifier = Modifier.padding(top = 16.dp),
                    )

                    // Counts: "N Followers  M Following".
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(24.dp),
                        modifier = Modifier.padding(top = 12.dp),
                    ) {
                        CountText(profile.followersCount.toString(), I18n.t("profilePublic.followers"))
                        CountText(profile.followingCount.toString(), I18n.t("profilePublic.following"))
                    }

                    if (state.isSelf) {
                        Text(
                            text = I18n.t("profilePublic.thisIsYou"),
                            fontSize = 14.sp,
                            color = colors.primary,
                            modifier = Modifier.padding(top = 12.dp),
                        )
                    } else {
                        LbButton(
                            text = when {
                                profile.followStatus == FollowStatus.PENDING ->
                                    I18n.t("profilePublic.pendingLabel")
                                profile.isFollowing -> I18n.t("profilePublic.followingLabel")
                                else -> I18n.t("profilePublic.follow")
                            },
                            variant = if (profile.isFollowing || profile.followStatus == FollowStatus.PENDING) {
                                LbButtonVariant.SECONDARY
                            } else {
                                LbButtonVariant.PRIMARY
                            },
                            loading = state.isProcessing,
                            onClick = viewModel::followToggle,
                            modifier = Modifier.padding(top = 16.dp).fillMaxWidth(),
                        )
                    }

                    if (profile.profilePrivacyStatus == PrivacyStatus.PRIVATE && !profile.canViewContent) {
                        LbCard(modifier = Modifier.padding(top = 40.dp).fillMaxWidth()) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.Lock,
                                    contentDescription = null,
                                    tint = colors.primary,
                                    modifier = Modifier.size(32.dp),
                                )
                                Text(
                                    text = I18n.t("profilePublic.privateProfile"),
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = colors.foreground,
                                    modifier = Modifier.padding(top = 12.dp),
                                )
                                Text(
                                    text = I18n.t(
                                        "profilePublic.lockedMessage",
                                        "name" to profile.firstName,
                                    ),
                                    fontSize = 14.sp,
                                    color = colors.textMuted,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.padding(top = 8.dp),
                                )
                            }
                        }
                    } else {
                        val activities = profile.activities.orEmpty()
                        SectionTitle(
                            text = "${I18n.t("profilePublic.publicActivities")} (${profile.publicActivitiesCount})",
                            modifier = Modifier.padding(top = 32.dp),
                        )
                        if (activities.isEmpty()) {
                            MutedText(I18n.t("profilePublic.noPublicActivities"))
                        } else {
                            activities.forEach { activity ->
                                PublicActivityCardItem(
                                    activity = activity,
                                    showSubscribe = !state.isSelf,
                                    onSubscribe = {
                                        viewModel.subscribe(SubscriptionSourceType.ACTIVITY, activity)
                                    },
                                )
                            }
                        }

                        SectionTitle(
                            text = "${I18n.t("profilePublic.publicRoutines")} (${profile.publicRoutinesCount})",
                            modifier = Modifier.padding(top = 32.dp),
                        )
                        val routines = profile.routines.orEmpty()
                        if (routines.isEmpty()) {
                            MutedText(I18n.t("profilePublic.noPublicRoutines"))
                        } else {
                            routines.forEach { routine ->
                                PublicRoutineCardItem(
                                    routine = routine,
                                    showSubscribe = !state.isSelf,
                                    onSubscribe = {
                                        viewModel.subscribe(SubscriptionSourceType.ROUTINE, routine)
                                    },
                                )
                            }
                        }
                    }

                    Spacer(Modifier.height(24.dp))
                }
            }
        }
    }
}

@Composable
private fun CountText(count: String, label: String) {
    val colors = LocalAppColors.current
    Row {
        Text(
            text = count,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = colors.foreground,
        )
        Spacer(Modifier.width(4.dp))
        Text(text = label, fontSize = 14.sp, color = colors.textMuted)
    }
}

@Composable
private fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        fontSize = 18.sp,
        fontWeight = FontWeight.SemiBold,
        color = LocalAppColors.current.foreground,
        modifier = modifier.padding(bottom = 12.dp),
    )
}

@Composable
private fun MutedText(text: String) {
    Text(text = text, fontSize = 14.sp, color = LocalAppColors.current.textMuted)
}

/** Public activity card: title, description, "frequency · dayTime", streak, subscribe. */
@Composable
private fun PublicActivityCardItem(
    activity: PublicActivityCard,
    showSubscribe: Boolean,
    onSubscribe: () -> Unit,
) {
    val colors = LocalAppColors.current
    LbCard(modifier = Modifier.padding(bottom = 8.dp).fillMaxWidth()) {
        Text(
            text = activity.title,
            fontSize = 16.sp,
            fontWeight = FontWeight.Medium,
            color = colors.foreground,
        )
        if (activity.description.isNotBlank()) {
            Text(
                text = activity.description,
                fontSize = 14.sp,
                color = colors.textMuted,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(top = 8.dp),
        ) {
            Text(
                text = "${activity.frequency.wireLabel} · ${activity.dayTime.wireLabel}",
                fontSize = 12.sp,
                color = colors.textMuted,
                modifier = Modifier.weight(1f),
            )
            LbStreakBadge(streak = activity.streak, modifier = Modifier.padding(end = 8.dp))
            if (showSubscribe) {
                SubscribeButton(subscribed = activity.subscribed, onClick = onSubscribe)
            }
        }
    }
}

/** Public routine card: title, description, activity count, streak, subscribe. */
@Composable
private fun PublicRoutineCardItem(
    routine: PublicRoutineCard,
    showSubscribe: Boolean,
    onSubscribe: () -> Unit,
) {
    val colors = LocalAppColors.current
    LbCard(modifier = Modifier.padding(bottom = 8.dp).fillMaxWidth()) {
        Text(
            text = routine.title,
            fontSize = 16.sp,
            fontWeight = FontWeight.Medium,
            color = colors.foreground,
        )
        if (routine.description.isNotBlank()) {
            Text(
                text = routine.description,
                fontSize = 14.sp,
                color = colors.textMuted,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(top = 8.dp),
        ) {
            Text(
                text = "${routine.activities?.size ?: 0}",
                fontSize = 12.sp,
                color = colors.textMuted,
                modifier = Modifier.weight(1f),
            )
            LbStreakBadge(streak = routine.streak, modifier = Modifier.padding(end = 8.dp))
            if (showSubscribe) {
                SubscribeButton(subscribed = routine.subscribed, onClick = onSubscribe)
            }
        }
    }
}

/** RN `variant={subscribed ? 'outline' : 'default'}` h-8 button. */
@Composable
private fun SubscribeButton(subscribed: Boolean, onClick: () -> Unit) {
    val colors = LocalAppColors.current
    Box(
        modifier = Modifier
            .height(32.dp)
            .clip(RoundedCornerShape(8.dp))
            .then(
                if (subscribed) {
                    Modifier.background(colors.background)
                } else {
                    Modifier.background(colors.primary)
                }
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = I18n.t(
                if (subscribed) "profilePublic.subscribed" else "profilePublic.subscribe"
            ),
            fontSize = 12.sp,
            color = if (subscribed) colors.foreground else colors.primaryForeground,
            maxLines = 1,
        )
    }
}

// ---- local helpers ----

/** Wire/raw value of an enum (`DAILY` → "daily"), matching the RN render. */
private val Enum<*>.wireLabel: String
    get() = when (this) {
        Frequency.DAILY -> "daily"
        Frequency.WEEKLY -> "weekly"
        Frequency.MONTHLY -> "monthly"
        DayTime.NOT_SPECIFIED -> "notSpecified"
        DayTime.MORNING -> "morning"
        DayTime.AFTERNOON -> "afternoon"
        DayTime.EVENING -> "evening"
        else -> name.lowercase()
    }

/** `I18n.t(key)` with `{name}` interpolation (RN `t(key, { name })`). */
