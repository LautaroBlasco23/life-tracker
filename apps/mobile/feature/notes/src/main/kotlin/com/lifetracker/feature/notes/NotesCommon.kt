package com.lifetracker.feature.notes

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.MonitorHeart
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.PieChart
import androidx.compose.material.icons.outlined.StickyNote2
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material.icons.outlined.Wallet
import androidx.compose.ui.graphics.vector.ImageVector
import com.lifetracker.core.designsystem.NavEntry
import com.lifetracker.core.i18n.I18n
import com.lifetracker.core.network.model.NoteGroupResponse
import com.lifetracker.core.network.model.NoteResponse
import com.lifetracker.domain.time.parseInstant
import java.time.format.DateTimeFormatter
import java.util.Locale

/// Shared helpers for the notes screen (port of `app/(app)/notes.tsx`).

/**
 * `t(key, param = value)`: dot-path lookup with `{name}` interpolation
 * (same convention as the time feature's translator shim). Bare keys resolve
 * inside the feature's message group — `t("title")` → `notes.title` — while
 * dotted keys ("common.cancel") pass through unchanged.
 */
private const val GROUP = "notes"

internal fun t(key: String, vararg params: Pair<String, Any?>): String =
    params.fold(I18n.t(if (key.contains('.')) key else "$GROUP.$key")) { acc, (name, value) ->
        acc.replace("{$name}", value?.toString() ?: "")
    }

/** Joiner for toast titles + optional descriptions (`showToast({title, description})`). */
internal fun toastText(title: String, description: String? = null): String =
    if (description.isNullOrBlank()) title else "$title — $description"

/** Hamburger drawer entries (same nav list the other screens render). */
internal fun navItems(): List<Pair<String, ImageVector>> = listOf(
    "activities" to Icons.Outlined.MonitorHeart,
    "time" to Icons.Outlined.Timer,
    "notes" to Icons.Outlined.StickyNote2,
    "finance/transactions" to Icons.Outlined.Wallet,
    "finance/dashboard" to Icons.Outlined.PieChart,
    "social" to Icons.Outlined.People,
)

/**
 * RN `formatEditedAt`: `toLocaleDateString(undefined, { month: 'short', day: 'numeric' })`.
 */
internal fun formatEditedAt(iso: String): String {
    val date = parseInstant(iso) ?: return ""
    val locale = when (I18n.current) {
        I18n.Language.SPANISH -> Locale.forLanguageTag("es-ES")
        else -> Locale.US
    }
    val pattern = if (locale.language == "es") "d MMM" else "MMM d"
    return DateTimeFormatter.ofPattern(pattern, locale).format(date)
}

/**
 * Flattened rows rendered by the draggable list: ungrouped notes first, then
 * one group header row per group (position order) followed by that group's
 * notes (hidden while the group is collapsed).
 */
internal sealed interface NoteListRow {
    val key: String

    data class NoteRow(val note: NoteResponse, val indented: Boolean) : NoteListRow {
        override val key: String = "note-${note.id}"
    }

    data class GroupRow(val group: NoteGroupResponse, val noteCount: Int) : NoteListRow {
        override val key: String = "group-${group.id}"
    }
}

/**
 * RN `rows` useMemo — rendering order mirrors the backend: groups position
 * asc; within a section, notes position asc then editedAt desc. While
 * searching, groups with no matches are hidden and matching groups are
 * temporarily expanded.
 */
internal fun buildRows(
    notes: List<NoteResponse>,
    groups: List<NoteGroupResponse>,
    query: String,
    collapsed: Set<Int>,
): List<NoteListRow> {
    val q = query.trim().lowercase()
    fun matches(note: NoteResponse) =
        q.isEmpty() ||
            note.title.lowercase().contains(q) ||
            note.content.lowercase().contains(q)

    val sortedNotes = notes.sortedWith(
        compareBy<NoteResponse> { it.position }.thenByDescending { it.editedAt }
    )
    val sortedGroups = groups.sortedBy { it.position }

    val out = mutableListOf<NoteListRow>()

    // Ungrouped notes first; hidden while searching if nothing matches.
    val ungrouped = sortedNotes.filter { it.groupId == null }.filter(::matches)
    if (q.isEmpty() || ungrouped.isNotEmpty()) {
        out.addAll(ungrouped.map { NoteListRow.NoteRow(it, indented = false) })
    }

    for (group in sortedGroups) {
        val all = sortedNotes.filter { it.groupId == group.id }
        val visible = if (q.isEmpty()) all else all.filter(::matches)
        if (q.isNotEmpty() && visible.isEmpty()) continue
        out.add(NoteListRow.GroupRow(group, visible.size))
        val expanded = q.isNotEmpty() || group.id !in collapsed
        if (expanded) {
            out.addAll(visible.map { NoteListRow.NoteRow(it, indented = true) })
        }
    }

    return out
}
