package com.lifetracker.domain.notes

import com.lifetracker.core.network.endpoints.NotesApi
import com.lifetracker.core.network.model.CreateNoteGroupRequest
import com.lifetracker.core.network.model.CreateNoteRequest
import com.lifetracker.core.network.model.CreateStickyNoteRequest
import com.lifetracker.core.network.model.NoteGroupPositionItem
import com.lifetracker.core.network.model.NoteGroupResponse
import com.lifetracker.core.network.model.NotePositionItem
import com.lifetracker.core.network.model.NoteResponse
import com.lifetracker.core.network.model.ReorderNoteGroupsRequest
import com.lifetracker.core.network.model.ReorderNotesRequest
import com.lifetracker.core.network.model.StickyNoteResponse
import com.lifetracker.core.network.model.UpdateNoteGroupRequest
import com.lifetracker.core.network.model.UpdateNoteRequest
import com.lifetracker.core.network.model.UpdateStickyNoteRequest
import com.lifetracker.domain.auth.ApiError
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import retrofit2.Response

/**
 * Port of `packages/shared/src/services/{note-service,note-group-service,
 * sticky-note-service}.ts`: CRUD + the one-shot reorder payloads for notes,
 * note-groups and sticky-notes.
 *
 * Sticky-note methods mirror the service parity-wise (the RN mobile app and
 * this port's screen do not render them anywhere — the endpoints exist for
 * the shared contract only).
 */
@Singleton
class NotesRepository @Inject constructor(
    private val api: NotesApi,
) {
    // ---- notes ----

    /** GET /notes — list; `query` is the full-text filter (`q=…`). */
    suspend fun getNotes(query: String? = null): List<NoteResponse> =
        api.listNotes(query).successOrThrow().data.orEmpty()

    /** POST /notes — create (201). */
    suspend fun createNote(title: String, content: String): NoteResponse =
        api.createNote(CreateNoteRequest(title, content))
            .successOrThrow().data
            ?: throw ApiError("Failed to create note")

    /** PUT /notes/:id — the screen always sends title + content (same as the RN page). */
    suspend fun updateNote(id: Int, title: String, content: String): NoteResponse =
        api.updateNote(id, UpdateNoteRequest(title = title, content = content))
            .successOrThrow().data
            ?: throw ApiError("Failed to save note")

    /** POST /notes/reorder — one-shot ordering write of the touched sections. */
    suspend fun reorderNotes(items: List<NotePositionItem>) {
        api.reorderNotes(ReorderNotesRequest(items)).successOrThrow()
    }

    /** DELETE /notes/:id. */
    suspend fun deleteNote(id: Int) {
        api.deleteNote(id).successOrThrow()
    }

    // ---- note groups ----

    /** GET /note-groups. */
    suspend fun getNoteGroups(): List<NoteGroupResponse> =
        api.listNoteGroups().successOrThrow().data.orEmpty()

    /** POST /note-groups — create (201). */
    suspend fun createNoteGroup(name: String): NoteGroupResponse =
        api.createNoteGroup(CreateNoteGroupRequest(name)).successOrThrow().data
            ?: throw ApiError("Failed to create group")

    /** PUT /note-groups/:id — rename. */
    suspend fun updateNoteGroup(id: Int, name: String): NoteGroupResponse =
        api.updateNoteGroup(id, UpdateNoteGroupRequest(name = name)).successOrThrow().data
            ?: throw ApiError("Failed to save group")

    /** POST /note-groups/reorder — full list, positions 0..n-1. */
    suspend fun reorderNoteGroups(items: List<NoteGroupPositionItem>) {
        api.reorderNoteGroups(ReorderNoteGroupsRequest(items)).successOrThrow()
    }

    /** DELETE /note-groups/:id — its notes stay, ungrouped. */
    suspend fun deleteNoteGroup(id: Int) {
        api.deleteNoteGroup(id).successOrThrow()
    }

    // ---- sticky notes ----

    /** GET /sticky-notes. */
    suspend fun getStickyNotes(): List<StickyNoteResponse> =
        api.listStickyNotes().successOrThrow().data.orEmpty()

    /** POST /sticky-notes — both fields optional (201). */
    suspend fun createStickyNote(title: String? = null, description: String? = null): StickyNoteResponse =
        api.createStickyNote(CreateStickyNoteRequest(title = title, description = description))
            .successOrThrow().data
            ?: throw ApiError("Failed to create sticky note")

    /** PUT /sticky-notes/:id — same shape as create, all optional. */
    suspend fun updateStickyNote(id: Int, title: String?, description: String?): StickyNoteResponse =
        api.updateStickyNote(id, UpdateStickyNoteRequest(title = title, description = description))
            .successOrThrow().data
            ?: throw ApiError("Failed to update sticky note")

    /** DELETE /sticky-notes/:id. */
    suspend fun deleteStickyNote(id: Int) {
        api.deleteStickyNote(id).successOrThrow()
    }
}

/**
 * Error-envelope exception of the `notes` / `note-groups` / `sticky-notes`
 * controllers (verified against the Go controllers, contract §1.6): their 4xx
 * bodies are `{ "message": … }`, not the usual `{ "error": … }`. Parse both
 * keys defensively so user-facing toasts keep the backend text.
 */
private val notesErrorJson = Json { ignoreUnknownKeys = true }

private fun errorBodyMessage(raw: String?): String? {
    val obj = raw?.let { body ->
        runCatching { notesErrorJson.decodeFromString<JsonObject>(body) }.getOrNull()
    } ?: return null
    val value = obj["error"] ?: obj["message"]
    return (value as? JsonPrimitive)?.takeIf { it.isString }?.content
}

/** Same contract as `domain/auth`'s `successOrThrow`, but `message`-aware. */
private fun <T> Response<T>.successOrThrow(): T {
    if (isSuccessful) return body() ?: throw ApiError("Empty response body", code())
    val message = errorBodyMessage(errorBody()?.string()) ?: "Request failed (${code()})"
    throw ApiError(message = message, status = code())
}
