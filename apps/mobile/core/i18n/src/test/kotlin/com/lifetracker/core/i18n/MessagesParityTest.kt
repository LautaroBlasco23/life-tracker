package com.lifetracker.core.i18n

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Port of the RN `packages/shared/src/messages/messages.test.ts` — the en/es
 * assets must expose the same flattened dot key set (+ lightweight enum check).
 */
class MessagesParityTest {

    private fun flatten(element: kotlinx.serialization.json.JsonElement, prefix: String = ""): Map<String, String> =
        buildMap {
            when (element) {
                is kotlinx.serialization.json.JsonObject -> element.forEach { (key, value) ->
                    val path = if (prefix.isEmpty()) key else "$prefix.$key"
                    putAll(flatten(value, path))
                }
                is kotlinx.serialization.json.JsonPrimitive -> if (element.isString) {
                    put(prefix, element.content)
                } else if (element.content.isNotBlank()) {
                    put(prefix, element.content)
                }
                else -> {}
            }
        }

    private fun load(path: String): Map<String, String> {
        // Unit tests run from the module dir; read the asset files directly
        // (assets are not merged into the JVM unit-test classpath).
        val file = java.io.File("src/main/assets/$path")
        val raw = if (file.exists()) {
            file.readText()
        } else {
            java.io.File("apps/mobile/core/i18n/src/main/assets/$path").readText()
        }
        return flatten(Json.parseToJsonElement(raw))
    }

    @Test
    fun `en and es expose the same key set`() {
        val en = load("messages/en.json")
        val es = load("messages/es.json")
        assertEquals(en.keys, es.keys)
        assertEquals(en.size, es.size)
    }

    @Test
    fun `known anchors exist`() {
        val en = load("messages/en.json")
        assertEquals("Cancel", en["common.cancel"])
        assertEquals("Sign out", en["profile.signOut"])
        org.junit.Assert.assertNotNull(en["auth.signIn"])
        org.junit.Assert.assertNotNull(en["notes.title"])
    }
}
