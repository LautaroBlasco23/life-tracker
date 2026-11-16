package com.lifetracker.feature.notes

import com.lifetracker.core.network.model.NoteResponse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Save lifecycle of the open editor (web `SaveStatus` machine parity). */
enum class NoteSaveStatus {
    /** Values match the server (or the editor is a create — no autosave). */
    IDLE,

    /** Values differ from the server; waiting for the debounce or a flush. */
    UNSAVED,

    /** A PUT is in flight. */
    SAVING,

    /** Last PUT succeeded and nothing changed since. */
    SAVED,
}

/**
 * Debounced autosave of the open note — the mobile analog of the web PR's
 * `flushSave` machine in `notesView.tsx`.
 *
 * Contract (ported lesson by lesson):
 * - A debounce (1.5 s after the last keystroke) arms the save; rapid edits
 *   coalesce into a single PUT.
 * - Saves are single-flight: a new flush while a PUT is in flight queues a
 *   follow-up instead of racing it.
 * - A FAILED save is never auto-retried: the retry trigger is the next
 *   keystroke or an explicit flush. The "did we just attempt these values?"
 *   comparison is against the values last ATTEMPTED, not the server state —
 *   otherwise a failure arms an infinite ~debounce retry loop (the bug fixed
 *   on web in commit 6a419d1).
 * - A blank title never blocks the save: the repository omits it from the PUT
 *   ("keep the server title"), so untitled notes save content-only.
 *
 * All state is confined to the caller's thread (the screen calls in from the
 * main thread and the scope runs on `Dispatchers.Main.immediate`), so no
 * cross-thread coordination is needed.
 *
 * @param scope the saves/debounce live here. Production passes an app-level
 *   scope ([NotesAppScope.save]) because a tab switch pops this nav entry and
 *   clears its ViewModel — an in-flight PUT must survive that.
 * @param save performs the PUT; returns the server's saved note.
 * @param onSaved invoked after every successful PUT (list refresh, draft
 *   cleanup).
 */
class NoteAutosaveController(
    private val scope: CoroutineScope,
    private val debounceMs: Long = AUTOSAVE_DEBOUNCE_MS,
    private val save: suspend (noteId: Int, title: String, content: String) -> NoteResponse,
    private val onSaved: (NoteResponse) -> Unit = {},
) {
    private val _status = MutableStateFlow(NoteSaveStatus.IDLE)
    val status: StateFlow<NoteSaveStatus> = _status.asStateFlow()

    /** Server state of the open note; `null` while the editor is a create. */
    private var note: NoteResponse? = null

    private var title = ""
    private var content = ""

    /** Values of the last PUT attempt (`title` already blank-stripped). */
    private var lastAttempted: Pair<String?, String>? = null

    private var debounceJob: Job? = null
    private val saveMutex = Mutex()

    /** Current values differ from the server state (mirrored blank-title rule). */
    private fun isDirty(): Boolean {
        val n = note ?: return false
        return (title.isNotBlank() && title != n.title) || content != n.content
    }

    /** Editor opened on `note`; `title`/`content` may hold a restored draft. */
    fun begin(note: NoteResponse, title: String, content: String) {
        debounceJob?.cancel()
        this.note = note
        this.title = title
        this.content = content
        lastAttempted = null
        _status.value = if (isDirty()) NoteSaveStatus.UNSAVED else NoteSaveStatus.IDLE
    }

    /** Editor closed without a note behind it (create flow). */
    fun reset() {
        debounceJob?.cancel()
        note = null
        title = ""
        content = ""
        lastAttempted = null
        _status.value = NoteSaveStatus.IDLE
    }

    /**
     * A keystroke: re-arms the debounce (or clears the dirty state when the
     * user reverted back to the server values).
     */
    fun onEdit(title: String, content: String) {
        if (note == null) return
        this.title = title
        this.content = content
        debounceJob?.cancel()
        if (isDirty()) {
            if (_status.value != NoteSaveStatus.SAVING) _status.value = NoteSaveStatus.UNSAVED
            debounceJob = scope.launch {
                delay(debounceMs)
                flush()
            }
        } else if (_status.value != NoteSaveStatus.SAVING) {
            _status.value = NoteSaveStatus.IDLE
        }
    }

    /**
     * Save now if dirty: the debounce expiry, the editor dismiss and the
     * app going to background all funnel here. Concurrent flushes coalesce
     * behind [saveMutex]; each one re-evaluates the current values.
     */
    fun flush() {
        debounceJob?.cancel()
        scope.launch {
            saveMutex.withLock {
                val current = note ?: return@launch
                val attemptTitle = title.takeIf { it.isNotBlank() }
                if (!isDirty() || lastAttempted == (attemptTitle to content)) return@launch
                lastAttempted = attemptTitle to content
                _status.value = NoteSaveStatus.SAVING
                try {
                    val saved = save(current.id, title, content)
                    note = saved
                    onSaved(saved)
                    _status.value = if (isDirty()) NoteSaveStatus.UNSAVED else NoteSaveStatus.SAVED
                } catch (error: Exception) {
                    // Failed saves are never retried automatically; the next
                    // keystroke or flush trigger retries (the draft holds the
                    // data and the indicator stays truthful).
                    _status.value = NoteSaveStatus.UNSAVED
                }
            }
        }
    }

    companion object {
        const val AUTOSAVE_DEBOUNCE_MS = 1_500L
    }
}

/**
 * Process-level scope for note autosaves: a tab switch pops the notes entry
 * (`saveState = true`) and clears its ViewModel, and a save that outlives the
 * editor must not die with it. Confined to the main dispatcher — the controller's
 * state stays on one thread and Retrofit suspend calls are main-safe.
 */
object NotesAppScope {
    val save: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
}
