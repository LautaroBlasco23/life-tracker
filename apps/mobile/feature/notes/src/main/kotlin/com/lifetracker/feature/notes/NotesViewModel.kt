@file:OptIn(kotlinx.coroutines.FlowPreview::class)

package com.lifetracker.feature.notes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lifetracker.core.network.model.NoteGroupPositionItem
import com.lifetracker.core.network.model.NoteGroupResponse
import com.lifetracker.core.network.model.NotePositionItem
import com.lifetracker.core.network.model.NoteResponse
import com.lifetracker.domain.notes.NoteDraftStore
import com.lifetracker.domain.notes.NotesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Screen state keyed off the RN `notes.tsx` useState family. */
data class NotesUiState(
    val notes: List<NoteResponse> = emptyList(),
    val groups: List<NoteGroupResponse> = emptyList(),
    val isLoading: Boolean = true,
    val query: String = "",
    /** Note ids with a persisted draft (the card "•" indicator). */
    val draftIds: Set<Int> = emptySet(),
) {
    val isSearching: Boolean get() = query.isNotBlank()
}

/** One-shot feedback from async effects (load failures + reverted reorders). */
sealed interface NotesEvent {
    data class NotesLoadFailed(val error: String?) : NotesEvent
    data class GroupsLoadFailed(val error: String?) : NotesEvent
    data class ReorderFailed(val error: String) : NotesEvent
}

/**
 * Port of the RN notes screen state holders (`app/(app)/notes.tsx`): notes +
 * groups lists fetched on focus, the 400 ms-debounced server search, drafts
 * (persisted through [NoteDraftStore], same as the RN kv adapter) and the
 * drag reorder semantics of `handleDragEnd`.
 */
@HiltViewModel
class NotesViewModel @Inject constructor(
    private val repo: NotesRepository,
    val drafts: NoteDraftStore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(NotesUiState())
    val uiState: StateFlow<NotesUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<NotesEvent>(extraBufferCapacity = 16)
    val events: SharedFlow<NotesEvent> = _events.asSharedFlow()

    /** RN's `query` state; changes drive the debounced reload. */
    private val queryFlow = MutableStateFlow("")

    init {
        _uiState.update { it.copy(draftIds = drafts.ids()) }
        viewModelScope.launch {
            queryFlow.drop(1).distinctUntilChanged().debounce(400).collect { q ->
                loadNotes(q.trim().ifBlank { null })
            }
        }
    }

    /// ---- loads ----

    /** RN `useFocusEffect` on entering the screen. */
    fun load() {
        viewModelScope.launch {
            loadNotes()
            loadGroups()
        }
    }

    fun setQuery(value: String) {
        queryFlow.value = value
        _uiState.update { it.copy(query = value) }
    }

    private suspend fun loadNotes(query: String? = null) {
        try {
            _uiState.update { it.copy(isLoading = true) }
            val data = repo.getNotes(query)
            _uiState.update { it.copy(notes = data, isLoading = false) }
        } catch (error: Exception) {
            _uiState.update { it.copy(isLoading = false) }
            _events.tryEmit(NotesEvent.NotesLoadFailed(error.message))
        }
    }

    private suspend fun loadGroups() {
        try {
            val data = repo.getNoteGroups()
            _uiState.update { it.copy(groups = data) }
        } catch (error: Exception) {
            _events.tryEmit(NotesEvent.GroupsLoadFailed(error.message))
        }
    }

    /// ---- drafts (persisted, RN `notes_drafts`) ----

    /**
     * The RN editor effect: while the editor is open with unsaved changes the
     * current title/content persist as the note's draft; matching the saved
     * state again removes it.
     */
    fun syncEditorDraft(noteId: Int, savedTitle: String, savedContent: String, title: String, content: String) {
        val unsaved = title != savedTitle || content != savedContent
        if (unsaved) drafts.save(noteId, title, content) else drafts.remove(noteId)
        refreshDraftIds()
    }

    /** RN `handleDiscard`: removes the draft (the screen resets its fields). */
    fun discardDraft(noteId: Int) {
        drafts.remove(noteId)
        refreshDraftIds()
    }

    private fun refreshDraftIds() {
        _uiState.update { it.copy(draftIds = drafts.ids()) }
    }

    /// ---- note CRUD ----

    /** `null` = success; otherwise the error text for the destructive toast. */
    suspend fun saveNote(id: Int?, title: String, content: String): String? =
        runCatching {
            if (id != null) repo.updateNote(id, title, content) else repo.createNote(title, content)
        }.fold(
            onSuccess = { saved ->
                _uiState.update { state ->
                    val exists = state.notes.any { it.id == saved.id }
                    state.copy(
                        notes = if (exists) {
                            state.notes.map { if (it.id == saved.id) saved else it }
                        } else {
                            // RN: new notes prepend; existing ones replace in place.
                            listOf(saved) + state.notes
                        },
                    )
                }
                // A saved note no longer needs its draft (RN `removeDraft`).
                if (id != null) discardDraft(id)
                null
            },
            onFailure = { it.message ?: "An error occurred" },
        )

    /** RN deletes after the call succeeds (not optimistically). */
    suspend fun deleteNote(note: NoteResponse): String? =
        runCatching { repo.deleteNote(note.id) }.fold(
            onSuccess = {
                discardDraft(note.id)
                _uiState.update { state ->
                    state.copy(notes = state.notes.filterNot { it.id == note.id })
                }
                null
            },
            onFailure = { it.message ?: "An error occurred" },
        )

    /// ---- groups CRUD ----

    /**
     * Create prepends the new group (`[created, ...gs]`); rename is optimistic
     * with a revert on failure (same as the RN page).
     */
    suspend fun saveGroup(id: Int?, name: String): String? {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) return null
        val prevGroups = _uiState.value.groups
        if (id != null) {
            _uiState.update { state ->
                state.copy(groups = state.groups.map { if (it.id == id) it.copy(name = trimmed) else it })
            }
            return runCatching {
                val saved = repo.updateNoteGroup(id, trimmed)
                _uiState.update { state ->
                    state.copy(groups = state.groups.map { if (it.id == saved.id) saved else it })
                }
            }.fold(
                onSuccess = { null },
                onFailure = { error ->
                    _uiState.update { it.copy(groups = prevGroups) }
                    error.message ?: "An error occurred"
                },
            )
        }
        return runCatching { repo.createNoteGroup(trimmed) }.fold(
            onSuccess = { created ->
                _uiState.update { state -> state.copy(groups = listOf(created) + state.groups) }
                null
            },
            onFailure = { it.message ?: "An error occurred" },
        )
    }

    /**
     * Deleting a group keeps its notes and moves them back to the ungrouped
     * section; both lists refetch afterwards (RN parity). The screen clears
     * the group's collapsed entry itself once this returns `null`.
     */
    suspend fun deleteGroup(group: NoteGroupResponse): String? =
        runCatching { repo.deleteNoteGroup(group.id) }.fold(
            onSuccess = {
                loadNotes()
                loadGroups()
                null
            },
            onFailure = { it.message ?: "An error occurred" },
        )

    /// ---- drag & drop (RN `handleDragEnd`) ----

    /**
     * Called when a drag gesture ends. `data` is the full flattened row list
     * as it stands after the drag (the RN `DragEndParams.data`), `movedIndex`
     * the index the dragged item was dropped at.
     */
    internal fun onDragEnd(data: List<NoteListRow>, movedIndex: Int) {
        val moved = data.getOrNull(movedIndex) ?: return
        when (moved) {
            is NoteListRow.GroupRow -> reorderGroups(data)
            is NoteListRow.NoteRow -> reorderNotes(data, moved.note)
        }
    }

    /**
     * Group drag: reindex the whole group list 0..n-1 and persist it. A drag
     * that did not change the order is a no-op; a failed call reverts the
     * optimistic positions and fires the error toast event.
     */
    private fun reorderGroups(data: List<NoteListRow>) {
        val prevGroups = _uiState.value.groups
        val groupRows = data.filterIsInstance<NoteListRow.GroupRow>()
        val prevOrder = prevGroups.sortedBy { it.position }.map { it.id }
        val nextOrder = groupRows.map { it.group.id }
        if (prevOrder == nextOrder) return

        val nextGroups = groupRows.mapIndexed { index, row -> row.group.copy(position = index) }
        _uiState.update { it.copy(groups = nextGroups) }

        val items = nextGroups.map { NoteGroupPositionItem(id = it.id, position = it.position) }
        viewModelScope.launch {
            try {
                repo.reorderNoteGroups(items)
            } catch (error: Exception) {
                _uiState.update { it.copy(groups = prevGroups) }
                _events.tryEmit(NotesEvent.ReorderFailed(error.message ?: "An error occurred"))
            }
        }
    }

    /**
     * Note drag: possibly a reorder and/or a cross-group move. Untouched
     * notes keep their stored order; the dragged note is anchored between its
     * visible neighbours; only the touched sections are reindexed and sent.
     */
    private fun reorderNotes(data: List<NoteListRow>, dragged: NoteResponse) {
        val prevNotes = _uiState.value.notes
        // membership is derived from the final row order (see `walkSections`).
        val (membership, sectionOrder) = walkSections(data)
        val draggedNote = prevNotes.find { it.id == dragged.id } ?: return
        val oldGroup = draggedNote.groupId
        val newGroup = membership[draggedNote.id]

        // Stored per-section note order (position asc, editedAt desc).
        val prevSections = prevNotes.byGroupSorted()

        // Rebuild the destination section: the dragged note anchored between
        // its visible neighbours.
        val destSiblings = sectionOrder.firstOrNull { it.section == newGroup }?.noteIds
            ?: emptyList()
        val others = (prevSections[newGroup] ?: emptyList()).filterNot { it.id == draggedNote.id }
        val at = destSiblings.indexOf(draggedNote.id)
        val prevSiblingId = if (at > 0) destSiblings[at - 1] else null
        val prevSiblingIdx = prevSiblingId?.let { id -> others.indexOfFirst { it.id == id } } ?: -1
        val nextSiblingIdx = destSiblings.getOrNull(at + 1)
            ?.let { id -> others.indexOfFirst { it.id == id } } ?: -1
        val destOrder = when {
            prevSiblingIdx >= 0 ->
                others.subList(0, prevSiblingIdx + 1) + draggedNote + others.drop(prevSiblingIdx + 1)
            nextSiblingIdx >= 0 ->
                others.subList(0, nextSiblingIdx) + draggedNote + others.drop(nextSiblingIdx)
            // No visible sibling in the section (e.g. dropped right after a
            // collapsed group header): becomes the first note of the group.
            else -> listOf(draggedNote) + others
        }

        val changedSections = buildList {
            add(newGroup to destOrder)
            if (oldGroup != newGroup) {
                add(oldGroup to (prevSections[oldGroup] ?: emptyList()).filterNot { it.id == draggedNote.id })
            }
        }

        // Reindex only the touched sections (0..n-1), skipping unchanged notes.
        val updates = mutableMapOf<Int, Pair<Int?, Int>>() // id -> (groupId, position)
        val items = mutableListOf<NotePositionItem>()
        for ((section, order) in changedSections) {
            order.forEachIndexed { position, note ->
                if (note.groupId != section || note.position != position) {
                    updates[note.id] = section to position
                }
                items.add(NotePositionItem(id = note.id, groupId = section, position = position))
            }
        }
        if (updates.isEmpty()) return

        _uiState.update { state ->
            state.copy(
                notes = state.notes.map { note ->
                    updates[note.id]?.let { (groupId, position) ->
                        note.copy(groupId = groupId, position = position)
                    } ?: note
                },
            )
        }

        viewModelScope.launch {
            try {
                repo.reorderNotes(items)
            } catch (error: Exception) {
                _uiState.update { it.copy(notes = prevNotes) }
                _events.tryEmit(NotesEvent.ReorderFailed(error.message ?: "An error occurred"))
            }
        }
    }

    /**
     * Walk of the flattened rows: notes before the first group header are
     * ungrouped; a note belongs to the group header above it.
     */
    private fun walkSections(data: List<NoteListRow>): Pair<Map<Int, Int?>, List<Section>> {
        val membership = mutableMapOf<Int, Int?>()
        val sections = mutableListOf(Section(section = null, noteIds = mutableListOf()))
        var currentGroup: Int? = null
        for (row in data) {
            when (row) {
                is NoteListRow.GroupRow -> {
                    currentGroup = row.group.id
                    sections.add(Section(section = currentGroup, noteIds = mutableListOf()))
                }
                is NoteListRow.NoteRow -> {
                    sections.last().noteIds.add(row.note.id)
                    membership[row.note.id] = currentGroup
                }
            }
        }
        return membership to sections
    }

    /** Class used only inside the drag walk (RN's anonymous section objects). */
    private data class Section(val section: Int?, val noteIds: MutableList<Int>)
}

/** RN's map-then-sort of per-section note order (position asc, editedAt desc). */
internal fun List<NoteResponse>.byGroupSorted(): Map<Int?, List<NoteResponse>> =
    groupBy { it.groupId }
        .mapValues { (_, sectionNotes) ->
            sectionNotes.sortedWith(
                compareBy<NoteResponse> { it.position }.thenByDescending { it.editedAt }
            )
        }
