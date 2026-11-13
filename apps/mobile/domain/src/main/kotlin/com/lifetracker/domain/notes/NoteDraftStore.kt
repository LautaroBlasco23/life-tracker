package com.lifetracker.domain.notes

import android.content.Context
import androidx.core.content.edit
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.json.Json

/**
 * Porter of the RN notes screen draft persistence (`DRAFT_STORAGE_KEY =
 * "notes_drafts"` in `app/(app)/notes.tsx`): unsaved editor contents are kept
 * per note id through the kv storage and restored on reopen.
 *
 * Decision: the RN app PERSISTS drafts, so this port persists them too — via
 * a dedicated `SharedPreferences` file (same name as the RN kv key) because
 * `core.storage.SettingsRepository` only exposes its three typed settings and
 * adding a generic kv there is out of this port's scope.
 */
@Singleton
class NoteDraftStore @Inject constructor(
    @ApplicationContext context: Context,
) {
    @Serializable
    data class NoteDraft(val title: String, val content: String)

    private val prefs = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }
    private val serializer = MapSerializer(kotlinx.serialization.serializer<String>(), NoteDraft.serializer())

    /** Full set of note ids that currently have a draft (the "•" indicator). */
    fun ids(): Set<Int> = drafts().keys

    fun load(noteId: Int): NoteDraft? = drafts()[noteId]

    fun save(noteId: Int, title: String, content: String) {
        val next = drafts().toMutableMap()
        next[noteId] = NoteDraft(title, content)
        write(next)
    }

    fun remove(noteId: Int) {
        val next = drafts().toMutableMap()
        if (next.remove(noteId) != null) write(next)
    }

    private fun drafts(): Map<Int, NoteDraft> {
        val stored = prefs.getString(FILE_KEY, null) ?: return emptyMap()
        return runCatching { json.decodeFromString(serializer, stored) }
            .getOrDefault(emptyMap())
            .mapKeys { (key, _) -> key.toInt() }
    }

    private fun write(next: Map<Int, NoteDraft>) {
        // On-disk shape mirrors the RN JSON payload: `{ "<noteId>": {...} }`.
        val asStrings = next.entries.associate { (id, draft) -> id.toString() to draft }
        prefs.edit { putString(FILE_KEY, json.encodeToString(serializer, asStrings)) }
    }

    private companion object {
        const val FILE_NAME = "notes_drafts"
        const val FILE_KEY = "drafts"
    }
}
