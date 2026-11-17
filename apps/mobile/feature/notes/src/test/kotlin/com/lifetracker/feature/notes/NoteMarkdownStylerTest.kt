package com.lifetracker.feature.notes

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.unit.sp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit contract of the live markdown styling (the mobile analog of the web
 * PR's `live-markdown-decorations.test.ts`): content spans style, syntax
 * markers dim, and — critically for Compose — no character is ever added or
 * removed (identity offset mapping).
 */
class NoteMarkdownStylerTest {

    private val ink = Color.Black
    private val muted = Color.Gray
    private val primary = Color.Blue
    private val codeBackground = Color.White

    private fun styled(text: String): AnnotatedString =
        styleNoteMarkdown(text, ink, muted, primary, codeBackground)

    /** Span styles overlapping [index]. */
    private fun stylesAt(text: AnnotatedString, index: Int) =
        text.spanStyles.filter { index >= it.start && index < it.end }.map { it.item }

    @Test
    fun `plain text gets no spans`() {
        val result = styled("just a plain line")
        assertTrue(result.spanStyles.isEmpty())
    }

    @Test
    fun `heading scales its content and dims the marker`() {
        val result = styled("# Title")
        // "# " marker dimmed.
        assertTrue(stylesAt(result, 0).any { it.color == muted })
        // Content (index 2..) is semibold at the h1 size.
        val contentStyles = stylesAt(result, 3)
        assertTrue(contentStyles.any { it.fontWeight == FontWeight.SemiBold })
        assertTrue(contentStyles.any { it.fontSize == 20.sp })
        // The heading content keeps the base ink.
        assertTrue(contentStyles.any { it.color == ink })
    }

    @Test
    fun `bold styles its content and dims its markers`() {
        val result = styled("**loud**")
        assertTrue(stylesAt(result, 0).any { it.color == muted })
        assertTrue(stylesAt(result, 1).any { it.color == muted })
        assertTrue(stylesAt(result, 3).any { it.fontWeight == FontWeight.Bold })
        assertTrue(stylesAt(result, 6).any { it.color == muted })
    }

    @Test
    fun `italic styles its content and dims its markers`() {
        val result = styled("say *soft* now")
        assertTrue(stylesAt(result, 4).any { it.color == muted })
        assertTrue(stylesAt(result, 5).any { it.fontStyle == FontStyle.Italic })
    }

    @Test
    fun `inline code turns monospace on a chip and dims the backticks`() {
        val result = styled("a `code` b")
        assertTrue(stylesAt(result, 2).any { it.color == muted }) // opening backtick
        val inner = stylesAt(result, 4)
        assertTrue(inner.any { it.fontFamily == FontFamily.Monospace })
        assertTrue(inner.any { it.background == codeBackground })
        assertTrue(stylesAt(result, 7).any { it.color == muted }) // closing backtick
    }

    @Test
    fun `list marker dims without replacing the character`() {
        val result = styled("- item")
        assertEquals("-", result.text[0].toString())
        assertTrue(stylesAt(result, 0).any { it.color == muted })
        assertTrue(result.spanStyles.none { it.start == 2 }) // content unstyled
    }

    @Test
    fun `quote mutes and italicizes its content and dims the marker`() {
        val result = styled("> quoted")
        assertTrue(stylesAt(result, 0).any { it.color == muted })
        val content = stylesAt(result, 3)
        assertTrue(content.any { it.fontStyle == FontStyle.Italic })
        assertTrue(content.any { it.color == muted })
    }

    @Test
    fun `link tints its text and dims its markup`() {
        val result = styled("see [docs](https://x) here")
        // "docs" tinted primary.
        assertTrue(stylesAt(result, 5).any { it.color == primary })
        // Bracket/paren markup dimmed.
        assertTrue(stylesAt(result, 4).any { it.color == muted })
        assertTrue(stylesAt(result, 9).any { it.color == muted })
    }

    @Test
    fun `styling never changes the character offsets`() {
        val raw = "# Head\n\n**bold** *i* `c` [l](u)\n- x"
        val result = styled(raw)
        assertEquals(raw, result.text)
    }

    @Test
    fun `the transformation keeps an identity offset map`() {
        val transformation = NoteMarkdownTransformation(ink, muted, primary, codeBackground)
        val raw = "# Head and **bold**"
        val transformed = transformation.filter(AnnotatedString(raw))
        assertEquals(raw, transformed.text.text)
        assertEquals(OffsetMapping.Identity, transformed.offsetMapping)
    }
}
