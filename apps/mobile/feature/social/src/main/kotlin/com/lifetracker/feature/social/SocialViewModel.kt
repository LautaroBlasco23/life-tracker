package com.lifetracker.feature.social

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lifetracker.core.i18n.I18n
import com.lifetracker.core.network.model.FollowStatus
import com.lifetracker.core.network.model.FollowerItem
import com.lifetracker.core.network.model.PublicUserCard
import com.lifetracker.domain.social.FollowsRepository
import com.lifetracker.domain.social.UsersRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** All render state of the Social screen. */
data class SocialUiState(
    val searchQuery: String = "",
    val results: List<PublicUserCard> = emptyList(),
    /** Spinner under the search tab (RN `isSearching`). */
    val isSearching: Boolean = false,
    /** Whether a real (non-blank) query has run — picks the empty-state variant. */
    val hasSearched: Boolean = false,
    val pendingRequests: List<FollowerItem> = emptyList(),
    /** Spinner for the requests list until the first load settles. */
    val isLoadingRequests: Boolean = true,
    /** Result user ids and follower `userId`s mid-action (spinners + disabled buttons). */
    val processingIds: Set<Int> = emptySet(),
)

/** One-shot toast payload; RN `showToast({ title, description?, variant })`. */
data class SocialMessage(val text: String, val isError: Boolean = false)

/**
 * Port of the state of `app/(app)/social.tsx`: debounced user search (300 ms,
 * 20 results), pending follow requests reloaded on every screen focus, and
 * the follow/unfollow/accept/reject flows with per-row processing ids.
 *
 * Toast texts are emitted here (a search failure happens inside the debounce
 * coroutine, invisible to the composition); the screen collects [messages]
 * into the design-system toast.
 */
@HiltViewModel
class SocialViewModel @Inject constructor(
    private val follows: FollowsRepository,
    private val users: UsersRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SocialUiState())
    val uiState: StateFlow<SocialUiState> = _uiState.asStateFlow()

    private val _messages = MutableSharedFlow<SocialMessage>(extraBufferCapacity = 16)
    val messages: SharedFlow<SocialMessage> = _messages.asSharedFlow()

    /** Same 300 ms debounce as web's social page (RN setTimeout + cleanup). */
    private var searchJob: Job? = null

    init {
        loadPendingRequests()
    }

    /** Focus-refetch (RN `useFocusEffect`): only the pending requests reload. */
    fun refresh() {
        loadPendingRequests()
    }

    // ---- search (300 ms debounce) ----

    /** RN `onChangeText`; schedules the debounced search. */
    fun onSearchQueryChange(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(300)
            search(query)
        }
    }

    private suspend fun search(query: String) {
        if (query.isBlank()) {
            _uiState.update {
                it.copy(results = emptyList(), hasSearched = false, isSearching = false)
            }
            return
        }
        _uiState.update { it.copy(isSearching = true, hasSearched = true) }
        users.searchUsers(query.trim(), 20)
            .onSuccess { list ->
                _uiState.update { it.copy(results = list, isSearching = false) }
            }
            .onFailure { e ->
                _uiState.update { it.copy(results = emptyList(), isSearching = false) }
                emitError("social.searchFailed", e)
            }
    }

    // ---- follow / unfollow from search results ----

    suspend fun follow(user: PublicUserCard) {
        setProcessing(user.id, true)
        follows.follow(user.username)
            .onSuccess { status ->
                _uiState.update { s ->
                    s.copy(
                        results = s.results.map {
                            if (it.id == user.id) {
                                it.copy(
                                    isFollowing = status == FollowStatus.ACCEPTED,
                                    followStatus = status,
                                )
                            } else {
                                it
                            }
                        }
                    )
                }
                if (status == FollowStatus.ACCEPTED) {
                    emitSuccessPair("social.followed", "social.nowFollowing", user.firstName)
                } else {
                    emitSuccessPair("social.requestSent", "social.followRequestPending", user.firstName)
                }
            }
            .onFailure { emitError("social.followFailed", it) }
            .also { setProcessing(user.id, false) }
    }

    suspend fun unfollow(user: PublicUserCard) {
        setProcessing(user.id, true)
        follows.unfollow(user.username)
            .onSuccess {
                _uiState.update { s ->
                    s.copy(
                        results = s.results.map {
                            if (it.id == user.id) {
                                it.copy(isFollowing = false, followStatus = FollowStatus.NONE)
                            } else {
                                it
                            }
                        }
                    )
                }
                emitSuccessPair("social.unfollowed", "social.noLongerFollowing", user.firstName)
            }
            .onFailure { emitError("social.unfollowFailed", it) }
            .also { setProcessing(user.id, false) }
    }

    // ---- pending requests ----

    private fun loadPendingRequests() {
        viewModelScope.launch {
            follows.pendingRequests()
                .onSuccess { list -> _uiState.update { it.copy(pendingRequests = list) } }
                // RN shows the destructive toast with the searchFailed title only.
                .onFailure { emitMessage(I18n.t("social.searchFailed"), isError = true) }
                .also { complete ->
                    _uiState.update { it.copy(isLoadingRequests = false) }
                }
        }
    }

    /** Accepts and drops the row at once (RN removes the request on success only). */
    suspend fun accept(follower: FollowerItem) {
        setProcessing(follower.userId, true)
        follows.acceptFollow(follower.userId)
            .onSuccess {
                removeRequest(follower.userId)
                emitSuccessPair("social.requestAccepted", "social.followRequestAccepted")
            }
            .onFailure { emitError("social.acceptFailed", it) }
            .also { setProcessing(follower.userId, false) }
    }

    /** Rejects and drops the row at once (RN removes the request on success only). */
    suspend fun reject(follower: FollowerItem) {
        setProcessing(follower.userId, true)
        follows.rejectFollow(follower.userId)
            .onSuccess {
                removeRequest(follower.userId)
                emitSuccessPair("social.requestRejected", "social.followRequestRejected")
            }
            .onFailure { emitError("social.rejectFailed", it) }
            .also { setProcessing(follower.userId, false) }
    }

    private fun removeRequest(userId: Int) {
        _uiState.update { s ->
            s.copy(pendingRequests = s.pendingRequests.filterNot { it.userId == userId })
        }
    }

    private fun setProcessing(id: Int, processing: Boolean) {
        _uiState.update { s ->
            s.copy(processingIds = if (processing) s.processingIds + id else s.processingIds - id)
        }
    }

    // ---- toast emission ----

    private fun emitMessage(text: String, isError: Boolean = false) {
        _messages.tryEmit(SocialMessage(text, isError))
    }

    /** RN toast: title bold line + parameterized description, joined for the port. */
    private fun emitSuccessPair(titleKey: String, descriptionKey: String, name: String? = null) {
        val description = name?.let { tf(descriptionKey, "name" to it) } ?: I18n.t(descriptionKey)
        emitMessage("${I18n.t(titleKey)} — $description")
    }

    /** Destructive toast carrying the server message (QA checklist parity). */
    private fun emitError(titleKey: String, error: Throwable) {
        emitMessage("${I18n.t(titleKey)}: ${error.message ?: I18n.t("common.error")}", isError = true)
    }

    // ---- local helpers ----

    /**
     * Duplicated from `feature/activities`' `ScreenHelpers.kt`: `I18n.t(key)`
     * with `{name}` interpolation (the RN screens call `t(key, { name })`).
     */
    private fun tf(key: String, vararg params: Pair<String, Any>): String {
        var text = I18n.t(key)
        params.forEach { (name, value) -> text = text.replace("{$name}", value.toString()) }
        return text
    }
}
