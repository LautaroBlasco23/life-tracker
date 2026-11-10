package com.lifetracker.feature.social

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lifetracker.core.i18n.I18n
import com.lifetracker.core.network.model.FollowStatus
import com.lifetracker.core.network.model.PublicActivityCard
import com.lifetracker.core.network.model.PublicProfileResponse
import com.lifetracker.core.network.model.PublicRoutineCard
import com.lifetracker.core.network.model.SubscriptionSourceType
import com.lifetracker.domain.social.FollowsRepository
import com.lifetracker.domain.social.SubscriptionsRepository
import com.lifetracker.domain.social.UsersRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** All render state of the public profile screen. */
data class PublicProfileUiState(
    val profile: PublicProfileResponse? = null,
    /** Viewer == profile owner (RN `isSelf`); hides follow + subscribe buttons. */
    val isSelf: Boolean = false,
    /** Full-screen spinner on first load only (RN parity). */
    val isLoading: Boolean = true,
    val notFound: Boolean = false,
    /** Follow while a follow/unfollow round-trip is running. */
    val isProcessing: Boolean = false,
)

/** One-shot toast payload standing in for the RN `Alert.alert` + toasts. */
data class PublicProfileMessage(val text: String, val isError: Boolean = false)

/**
 * Port of the state of `app/user/[username].tsx`: public profile fetch
 * (reloaded on screen focus), follow/unfollow toggle with the pending
 * "request sent" feedback, subscribe/unsubscribe on public activity/routine
 * cards, and the private-profile lock (content hidden server-side too).
 */
@HiltViewModel
class PublicProfileViewModel @Inject constructor(
    private val users: UsersRepository,
    private val follows: FollowsRepository,
    private val subscriptions: SubscriptionsRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(PublicProfileUiState())
    val uiState: StateFlow<PublicProfileUiState> = _uiState.asStateFlow()

    private val _messages = MutableSharedFlow<PublicProfileMessage>(extraBufferCapacity = 16)
    val messages: SharedFlow<PublicProfileMessage> = _messages.asSharedFlow()

    /** Focus-refetch (RN `useFocusEffect`): keep prior content while loading. */
    fun refresh(username: String) {
        viewModelScope.launch {
            loadProfile(username)
        }
    }

    private suspend fun loadProfile(username: String) {
        users.publicProfile(username)
            .onSuccess { profile ->
                _uiState.update {
                    it.copy(
                        profile = profile,
                        isSelf = users.cachedUsername() == profile.username,
                        notFound = false,
                        isLoading = false,
                    )
                }
            }
            .onFailure {
                _uiState.update { it.copy(notFound = true, isLoading = false) }
            }
    }

    // ---- follow / unfollow ----

    /**
     * RN `handleFollowToggle`: following/pending → unfollow; otherwise follow
     * and surface the pending-request feedback. Reloads the profile after.
     */
    fun followToggle() {
        val profile = _uiState.value.profile ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isProcessing = true) }
            if (profile.isFollowing || profile.followStatus == FollowStatus.PENDING) {
                follows.unfollow(profile.username)
                    .onSuccess { }
                    .onFailure { emitMessage(I18n.t("common.error"), isError = true) }
            } else {
                follows.follow(profile.username)
                    .onSuccess { status ->
                        if (status == FollowStatus.PENDING) {
                            emitMessage(I18n.t("profilePublic.pendingLabel"))
                        }
                    }
                    .onFailure { emitMessage(I18n.t("common.error"), isError = true) }
            }
            loadProfile(profile.username)
            _uiState.update { it.copy(isProcessing = false) }
        }
    }

    // ---- subscribe / unsubscribe on public cards ----

    /**
     * RN card action (QA checklist reads it as a toggle): subscribes when not
     * subscribed; on subscribed cards it locates the clone in
     * `GET /subscriptions` (`sourceType` + `sourceId` match) and unsubscribes.
     * Always reloads the profile; failures surface the matching alert text.
     */
    fun subscribe(sourceType: SubscriptionSourceType, item: PublicActivityCard) {
        toggleSubscription(sourceType, item.id, item.subscribed)
    }

    /** Same toggle for routine cards. */
    fun subscribe(sourceType: SubscriptionSourceType, item: PublicRoutineCard) {
        toggleSubscription(sourceType, item.id, item.subscribed)
    }

    private fun toggleSubscription(
        sourceType: SubscriptionSourceType,
        sourceId: Int,
        subscribed: Boolean,
    ) {
        val username = _uiState.value.profile?.username ?: return
        viewModelScope.launch {
            if (subscribed) {
                val clone = subscriptions.mySubscriptions().getOrNull()
                    ?.firstOrNull { it.sourceType == sourceType && it.sourceId == sourceId }
                if (clone != null) {
                    subscriptions.unsubscribe(clone.id)
                        .onSuccess { emitMessage(I18n.t("profilePublic.unsubscribedToast", "name" to username)) }
                        .onFailure { emitMessage(I18n.t("profilePublic.unsubscribeFailed"), isError = true) }
                }
            } else {
                subscriptions.subscribe(sourceType, sourceId)
                    .onSuccess { emitMessage(I18n.t("profilePublic.subscribedToast", "name" to username)) }
                    .onFailure { emitMessage(I18n.t("profilePublic.subscribeFailed"), isError = true) }
            }
            loadProfile(username)
        }
    }

    private fun emitMessage(text: String, isError: Boolean = false) {
        _messages.tryEmit(PublicProfileMessage(text, isError))
    }

    /** `I18n.t(key)` with `{name}` interpolation (RN `t(key, { name })`). */
}
