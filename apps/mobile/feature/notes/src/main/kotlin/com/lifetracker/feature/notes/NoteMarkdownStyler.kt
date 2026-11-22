package com.lifetracker.feature.notes

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.sp

/**
 * Live markdown styling for the note editor — the mobile analog of the web
 * PR's `live-markdown-decorations.ts`: headings scale, bold/italic/code/
 * quotes style while typing, and syntax markers dim. The Compose-safe
 * simplification: markers are NEVER removed (identity offset mapping), so
 * the caret, selection and IME keep working on the raw text.
 *
 * [styleNoteMarkdown] is a pure String → AnnotatedString function so the
 * styling rules are unit-testable without Compose; [NoteMarkdownTransformation]
 * is its [VisualTransformation] wrapper.
 */

/** Heading level → fontSize (the field's base is 16sp). */
private fun headingSize(level: Int) = when (level) {
    1 -> 20.sp
    2 -> 18.sp
    3 -> 16.sp
    else -> 15.sp
}

/**
 * Styles a note's markdown in place. `ink` is the field's base color,
 * `muted` dims syntax markers, `primary` tints links, `codeBackground`
 * highlights inline code spans.
 */
fun styleNoteMarkdown(
    text: String,
    ink: Color,
    muted: Color,
    primary: Color,
    codeBackground: Color,
): AnnotatedString {
    if (text.isEmpty()) return AnnotatedString(text)
    return buildAnnotatedString {
        append(text)
        var start = 0
        while (start < text.length) {
            val end = text.indexOf('\n', start).let { if (it == -1) text.length else it }
            styleLine(text, start, end, ink, muted, primary, codeBackground)
            start = end + 1
        }
    }
}

/** Span styles for one logical line (`[start, end)` of `text`). */
private fun AnnotatedString.Builder.styleLine(
    text: String,
    start: Int,
    end: Int,
    ink: Color,
    muted: Color,
    primary: Color,
    codeBackground: Color,
) {
    val line = text.substring(start, end)

    // ATX heading: "#… " markers dim, content scales with the level.
    headingRegex.matchEntire(line)?.let { match ->
        val level = match.groupValues[1].length
        val markerRange = match.groups[1]!!.range
        val contentStart = start + match.groups[2]!!.range.first
        addStyle(SpanStyle(color = muted), start, start + markerRange.last + 1)
        addStyle(
            SpanStyle(color = ink, fontWeight = FontWeight.SemiBold, fontSize = headingSize(level)),
            contentStart,
            end,
        )
        return
    }

    // Block quote: "> " marker dim, content italic + muted.
    quoteRegex.matchEntire(line)?.let { match ->
        val markerEnd = start + match.groups[1]!!.range.last + 1
        addStyle(SpanStyle(color = muted), start, markerEnd)
        if (markerEnd < end) {
            addStyle(
                SpanStyle(color = muted, fontStyle = FontStyle.Italic),
                markerEnd,
                end,
            )
        }
        return
    }

    // List marker (bullet or ordered): the marker itself dims, content keeps
    // the base style — no character replacement, so the offset map stays identity.
    listMarkerRegex.matchAt(line, 0)?.let { match ->
        addStyle(SpanStyle(color = muted), start, start + match.value.length)
    }

    // Inline code: backticks dim, the span turns monospace on a chip.
    codeRegex.findAll(line).forEach { match ->
        val range = match.range
        addStyle(SpanStyle(color = muted), start + range.first, start + range.first + 1)
        addStyle(SpanStyle(color = muted), start + range.last, start + range.last + 1)
        addStyle(
            SpanStyle(fontFamily = FontFamily.Monospace, background = codeBackground),
            start + range.first + 1,
            start + range.last,
        )
    }

    // Bold: "**" markers dim, the span turns bold.
    boldRegex.findAll(line).forEach { match ->
        val range = match.range
        addStyle(SpanStyle(color = muted), start + range.first, start + range.first + 2)
        addStyle(SpanStyle(color = muted), start + range.last - 1, start + range.last + 1)
        addStyle(
            SpanStyle(fontWeight = FontWeight.Bold),
            start + range.first + 2,
            start + range.last - 1,
        )
    }

    // Italic: single "*" not part of a bold pair; markers dim, span italic.
    italicRegex.findAll(line).forEach { match ->
        val range = match.range
        addStyle(SpanStyle(color = muted), start + range.first, start + range.first + 1)
        addStyle(SpanStyle(color = muted), start + range.last, start + range.last + 1)
        addStyle(
            SpanStyle(fontStyle = FontStyle.Italic),
            start + range.first + 1,
            start + range.last,
        )
    }

    // Link: "[text](url)" — markers dim, the visible text tints primary.
    linkRegex.findAll(line).forEach { match ->
        val range = match.range
        val textRange = match.groups[1]!!.range
        addStyle(
            SpanStyle(color = primary),
            start + range.first + 1,
            start + textRange.last + 1,
        )
        addStyle(SpanStyle(color = muted), start + range.first, start + range.first + 1)
        addStyle(
            SpanStyle(color = muted),
            start + textRange.last + 1,
            start + range.last + 1,
        )
    }
}

// Per-line markdown grammar (line-scoped on purpose: multi-line constructs
// would need the full commonmark parse — that is what the Preview is for).
private val headingRegex = Regex("^(#{1,6})([ \\t]+.*)$")
private val quoteRegex = Regex("^(>)([ \\t]?.*)$")
private val listMarkerRegex = Regex("^([ \\t]*(?:[-*+]|\\d{1,9}[.)])[ \\t]+)")
private val codeRegex = Regex("`([^`\\n]+)`")
private val boldRegex = Regex("\\*\\*([^*\\n]+)\\*\\*")
private val italicRegex = Regex("(?<!\\*)\\*([^*\\n]+)\\*(?!\\*)")
private val linkRegex = Regex("\\[([^\\]\\n]*)]\\(([^)\\n]*)\\)")

/**
 * [VisualTransformation] wrapper of [styleNoteMarkdown] with an identity
 * offset map: no characters are added or removed, so caret position, text
 * selection and IME composition keep operating on the raw markdown.
 */
class NoteMarkdownTransformation(
    private val ink: Color,
    private val muted: Color,
    private val primary: Color,
    private val codeBackground: Color,
) : VisualTransformation {
    override fun filter(text: AnnotatedString): TransformedText =
        TransformedText(
            styleNoteMarkdown(text.text, ink, muted, primary, codeBackground),
            OffsetMapping.Identity,
        )
}
