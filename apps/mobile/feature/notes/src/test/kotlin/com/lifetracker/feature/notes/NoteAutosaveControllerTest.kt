package com.lifetracker.feature.notes

import com.lifetracker.core.network.model.NoteResponse
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Unit contract of the debounced autosave (web PR parity, commit 6a419d1):
 * edits coalesce behind a 1.5 s debounce, a FAILED save is never retried
 * automatically (only the next edit/flush retries), an in-flight PUT makes
 * further flushes queue instead of racing, and a restored draft flushes on
 * dismiss without a keystroke.
 */
class NoteAutosaveControllerTest {

    private fun note(id: Int = 1, title: String = "T", content: String = "C") = NoteResponse(
        id = id,
        userId = 1,
        title = title,
        content = content,
        groupId = null,
        position = 0,
        createdAt = "2025-01-01T00:00:00.000Z",
        editedAt = "2025-01-01T00:00:00.000Z",
    )

    @Test
    fun `rapid edits coalesce into one save after the debounce window`() = runTest {
        val calls = mutableListOf<Pair<String, String>>()
        val controller = NoteAutosaveController(
            scope = backgroundScope,
            save = { id, title, content -> calls.add(title to content); note(id, title, content) },
        )
        controller.begin(note(), note().title, note().content) // clean open

        controller.onEdit("T2", "C")
        controller.onEdit("T3", "C")
        advanceTimeBy(NoteAutosaveController.AUTOSAVE_DEBOUNCE_MS - 1)
        runCurrent()
        assertEquals(0, calls.size) // still inside the debounce window

        advanceTimeBy(1)
        runCurrent()
        assertEquals(1, calls.size)
        assertEquals("T3" to "C", calls.single())
        assertEquals(NoteSaveStatus.SAVED, controller.status.value)
    }

    @Test
    fun `a failed save is never auto retried, the next edit retries it`() = runTest {
        val calls = mutableListOf<Pair<String, String>>()
        var fail = true
        val controller = NoteAutosaveController(
            scope = backgroundScope,
            save = { id, title, content ->
                calls.add(title to content)
                if (fail) throw RuntimeException("network down")
                note(id, title, content)
            },
        )
        controller.begin(note(), note().title, note().content)

        controller.onEdit("T2", "C")
        advanceTimeBy(NoteAutosaveController.AUTOSAVE_DEBOUNCE_MS)
        runCurrent()
        assertEquals(1, calls.size)
        // Failure → the indicator is truthful (unsaved), not stuck "Saving…".
        assertEquals(NoteSaveStatus.UNSAVED, controller.status.value)

        // No retry loop: time passes, nothing re-sends the failed values.
        advanceTimeBy(60_000)
        runCurrent()
        assertEquals(1, calls.size)

        // The next keystroke retries (and now succeeds).
        fail = false
        controller.onEdit("T3", "C")
        advanceTimeBy(NoteAutosaveController.AUTOSAVE_DEBOUNCE_MS)
        runCurrent()
        assertEquals(2, calls.size)
        assertEquals(NoteSaveStatus.SAVED, controller.status.value)
    }

    @Test
    fun `edits during an in-flight save queue a follow-up instead of racing it`() = runTest {
        val calls = mutableListOf<Pair<String, String>>()
        val gate = CompletableDeferred<Unit>()
        val controller = NoteAutosaveController(
            scope = backgroundScope,
            save = { id, title, content ->
                calls.add(title to content)
                gate.await()
                note(id, title, content)
            },
        )
        controller.begin(note(), note().title, note().content)

        controller.onEdit("T2", "C")
        advanceTimeBy(NoteAutosaveController.AUTOSAVE_DEBOUNCE_MS)
        runCurrent()
        assertEquals(1, calls.size) // first PUT in flight (suspended)
        assertEquals(NoteSaveStatus.SAVING, controller.status.value)

        controller.onEdit("T3", "C") // typed during the flight
        runCurrent()
        assertEquals(1, calls.size) // no concurrent PUT started

        controller.flush() // explicit trigger — must queue, not double-send
        runCurrent()
        assertEquals(1, calls.size)

        gate.complete(Unit)
        runCurrent()
        assertEquals(2, calls.size) // follow-up ran with the latest values
        assertEquals("T3" to "C", calls[1])
        assertEquals(NoteSaveStatus.SAVED, controller.status.value)
    }

    @Test
    fun `flush on a clean editor is a no-op`() = runTest {
        val calls = mutableListOf<Pair<String, String>>()
        val controller = NoteAutosaveController(
            scope = backgroundScope,
            save = { id, title, content -> calls.add(title to content); note(id, title, content) },
        )
        controller.begin(note(), note().title, note().content) // values match server
        controller.flush()
        runCurrent()
        assertEquals(0, calls.size)
        assertEquals(NoteSaveStatus.IDLE, controller.status.value)

        controller.reset() // create flow (no note behind the editor)
        controller.flush()
        runCurrent()
        assertEquals(0, calls.size)
    }

    @Test
    fun `a restored draft begins UNSAVED and flushes on dismiss without a keystroke`() = runTest {
        val calls = mutableListOf<Pair<String, String>>()
        val controller = NoteAutosaveController(
            scope = backgroundScope,
            save = { id, title, content -> calls.add(title to content); note(id, title, content) },
        )
        controller.begin(note(title = "Server title"), "Draft title", "C")
        assertEquals(NoteSaveStatus.UNSAVED, controller.status.value)

        controller.flush() // the editor dismiss trigger
        runCurrent()
        assertEquals(1, calls.size)
        assertEquals("Draft title" to "C", calls.single())
        assertEquals(NoteSaveStatus.SAVED, controller.status.value)
    }

    @Test
    fun `reverting edits back to the server values clears the dirty state`() = runTest {
        val calls = mutableListOf<Pair<String, String>>()
        val controller = NoteAutosaveController(
            scope = backgroundScope,
            save = { id, title, content -> calls.add(title to content); note(id, title, content) },
        )
        controller.begin(note(), note().title, note().content)

        controller.onEdit("T2", "C")
        assertEquals(NoteSaveStatus.UNSAVED, controller.status.value)
        controller.onEdit(note().title, note().content) // back to the server values
        assertEquals(NoteSaveStatus.IDLE, controller.status.value)

        advanceTimeBy(60_000)
        runCurrent()
        assertEquals(0, calls.size) // nothing to save
    }
}
