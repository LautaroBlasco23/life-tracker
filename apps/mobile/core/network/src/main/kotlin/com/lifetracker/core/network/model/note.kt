package com.lifetracker.core.network.model

import kotlinx.serialization.Serializable

/**
 * Wire models for `/notes`, `/note-groups` and `/sticky-notes`.
 *
 * Field names are camelCase on the wire and match Kotlin identifiers exactly,
 * so no [kotlinx.serialization.SerialName] annotations are required.
 *
 * Error-shape exception (verified in Go controllers): the `notes`, `note-groups`
 * AND `sticky-notes` controllers return `{ "message": … }` — not
 * `{ "error": … }` — for their 4xx/5xx bodies. Parse defensively.
 */

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

/** Body of `POST /notes`. */
@Serializable
data class CreateNoteRequest(
    val title: String,
    val content: String,
)

/** Body of `PUT /notes/{id}` — all fields optional; omit unchanged fields. */
@Serializable
data class UpdateNoteRequest(
    val title: String? = null,
    val content: String? = null,
)

/** One element of the reorder payload. `groupId` may be `null` (ungrouped). */
@Serializable
data class NotePositionItem(
    val id: Int,
    val groupId: Int? = null,
    val position: Int,
)

/** Body of `POST /notes/reorder`. */
@Serializable
data class ReorderNotesRequest(
    val items: List<NotePositionItem>,
)

/** Item of `GET /notes` (list envelope) and `GET /notes/{id}` (single). */
@Serializable
data class NoteResponse(
    val id: Int,
    val userId: Int,
    val title: String,
    val content: String,
    val groupId: Int? = null,
    val position: Int,
    /** RFC3339 timestamp. */
    val createdAt: String,
    /** RFC3339 timestamp (backend maps it to the record's updatedAt). */
    val editedAt: String,
)

// ---------------------------------------------------------------------------
// Note groups
// ---------------------------------------------------------------------------

/** Body of `POST /note-groups`. */
@Serializable
data class CreateNoteGroupRequest(
    val name: String,
)

/** Body of `PUT /note-groups/{id}`. */
@Serializable
data class UpdateNoteGroupRequest(
    val name: String? = null,
)

/** One element of the reorder payload (no groups here). */
@Serializable
data class NoteGroupPositionItem(
    val id: Int,
    val position: Int,
)

/** Body of `POST /note-groups/reorder`. */
@Serializable
data class ReorderNoteGroupsRequest(
    val items: List<NoteGroupPositionItem>,
)

/** Item of `GET /note-groups` (list envelope) and `GET /note-groups/{id}`. */
@Serializable
data class NoteGroupResponse(
    val id: Int,
    val userId: Int,
    val name: String,
    val position: Int,
    /** RFC3339 timestamp. */
    val createdAt: String,
    /** RFC3339 timestamp. */
    val editedAt: String,
)

// ---------------------------------------------------------------------------
// Sticky notes
// ---------------------------------------------------------------------------

/**
 * Body of `POST /sticky-notes`. Both fields optional: a sticky note may carry
 * only a title, only a description, or both.
 */
@Serializable
data class CreateStickyNoteRequest(
    val title: String? = null,
    val description: String? = null,
)

/** Body of `PUT /sticky-notes/{id}` — same shape as create, all optional. */
@Serializable
data class UpdateStickyNoteRequest(
    val title: String? = null,
    val description: String? = null,
)

/** Item of `GET /sticky-notes` (list envelope) and `GET /sticky-notes/{id}`. */
@Serializable
data class StickyNoteResponse(
    val id: Int,
    val userId: Int,
    val title: String,
    val description: String,
    /** RFC3339 timestamp. */
    val createdAt: String,
    /** RFC3339 timestamp. */
    val editedAt: String,
)
