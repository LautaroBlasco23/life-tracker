package com.lifetracker.core.network.endpoints

import com.lifetracker.core.network.model.ApiEnvelope
import com.lifetracker.core.network.model.MessageOnly
import com.lifetracker.core.network.model.ApiList
import com.lifetracker.core.network.model.CreateNoteGroupRequest
import com.lifetracker.core.network.model.CreateNoteRequest
import com.lifetracker.core.network.model.CreateStickyNoteRequest
import com.lifetracker.core.network.model.NoteGroupResponse
import com.lifetracker.core.network.model.NoteResponse
import com.lifetracker.core.network.model.ReorderNoteGroupsRequest
import com.lifetracker.core.network.model.ReorderNotesRequest
import com.lifetracker.core.network.model.StickyNoteResponse
import com.lifetracker.core.network.model.UpdateNoteGroupRequest
import com.lifetracker.core.network.model.UpdateNoteRequest
import com.lifetracker.core.network.model.UpdateStickyNoteRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Notes, note-groups and sticky-notes endpoints (contract §8), kept in one
 * Retrofit interface: the three controllers are small, share the same
 * envelope/style conventions, and rhyme enough to stay together.
 *
 * Envelope exception to remember (verified in the Go controllers): error bodies
 * of `notes`, `note-groups` AND `sticky-notes` are `{ "message": … }`, not the
 * usual `{ "error": … }` — parse defensively. Message-only successes
 * (reorder / delete) are modeled with [MessageOnly].
 */
interface NotesApi {

    // -----------------------------------------------------------------------
    // Notes
    // -----------------------------------------------------------------------

    /** Creates a note; responds HTTP 201. */
    @POST("notes")
    suspend fun createNote(@Body body: CreateNoteRequest): Response<ApiEnvelope<NoteResponse>>

    /** Lists the user's notes; `"q"` is the full-text filter. */
    @GET("notes")
    suspend fun listNotes(@Query("q") query: String? = null): Response<ApiList<NoteResponse>>

    /** Fetches a single note. */
    @GET("notes/{id}")
    suspend fun getNote(@Path("id") id: Int): Response<ApiEnvelope<NoteResponse>>

    /** Partially updates a note (omit unchanged fields). */
    @PUT("notes/{id}")
    suspend fun updateNote(@Path("id") id: Int, @Body body: UpdateNoteRequest): Response<ApiEnvelope<NoteResponse>>

    /** Writes the new ordering of notes in one shot (`groupId` may be null). */
    @POST("notes/reorder")
    suspend fun reorderNotes(@Body body: ReorderNotesRequest): Response<MessageOnly>

    /** Deletes a note. */
    @DELETE("notes/{id}")
    suspend fun deleteNote(@Path("id") id: Int): Response<MessageOnly>

    // -----------------------------------------------------------------------
    // Note groups
    // -----------------------------------------------------------------------

    /** Creates a note group; responds HTTP 201. */
    @POST("note-groups")
    suspend fun createNoteGroup(@Body body: CreateNoteGroupRequest): Response<ApiEnvelope<NoteGroupResponse>>

    /** Lists the user's note groups. */
    @GET("note-groups")
    suspend fun listNoteGroups(): Response<ApiList<NoteGroupResponse>>

    /** Fetches a single note group. */
    @GET("note-groups/{id}")
    suspend fun getNoteGroup(@Path("id") id: Int): Response<ApiEnvelope<NoteGroupResponse>>

    /** Renames a note group. */
    @PUT("note-groups/{id}")
    suspend fun updateNoteGroup(@Path("id") id: Int, @Body body: UpdateNoteGroupRequest): Response<ApiEnvelope<NoteGroupResponse>>

    /** Writes the new ordering of note groups in one shot. */
    @POST("note-groups/reorder")
    suspend fun reorderNoteGroups(@Body body: ReorderNoteGroupsRequest): Response<MessageOnly>

    /** Deletes a note group (its notes continue to exist ungrouped). */
    @DELETE("note-groups/{id}")
    suspend fun deleteNoteGroup(@Path("id") id: Int): Response<MessageOnly>

    // -----------------------------------------------------------------------
    // Sticky notes
    // -----------------------------------------------------------------------

    /** Creates a sticky note (title and/or description); responds HTTP 201. */
    @POST("sticky-notes")
    suspend fun createStickyNote(@Body body: CreateStickyNoteRequest): Response<ApiEnvelope<StickyNoteResponse>>

    /** Lists the user's sticky notes. */
    @GET("sticky-notes")
    suspend fun listStickyNotes(): Response<ApiList<StickyNoteResponse>>

    /** Fetches a single sticky note. */
    @GET("sticky-notes/{id}")
    suspend fun getStickyNote(@Path("id") id: Int): Response<ApiEnvelope<StickyNoteResponse>>

    /** Partially updates a sticky note. */
    @PUT("sticky-notes/{id}")
    suspend fun updateStickyNote(@Path("id") id: Int, @Body body: UpdateStickyNoteRequest): Response<ApiEnvelope<StickyNoteResponse>>

    /** Deletes a sticky note. */
    @DELETE("sticky-notes/{id}")
    suspend fun deleteStickyNote(@Path("id") id: Int): Response<MessageOnly>
}
