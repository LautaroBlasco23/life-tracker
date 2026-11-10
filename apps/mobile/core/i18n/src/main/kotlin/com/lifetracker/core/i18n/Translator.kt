package com.lifetracker.core.i18n

import android.content.Context
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/**
 * Runtime-switchable translator, port of the shared LanguageProvider +
 * `messages/{en,es}.json`. Strings ship as assets and are flattened to
 * dot-paths ("common.cancel"), matching the existing key conventions.
 * Persistence of the selected language arrives with Phase 2 (DataStore).
 */
object I18n {
    enum class Language(val code: String, val label: String) {
        ENGLISH("en", "English"),
        SPANISH("es", "Español"),
    }

    private val json = Json { ignoreUnknownKeys = true }

    private val caches = mutableMapOf<Language, Map<String, String>>()
    private var strings: Map<String, String> = emptyMap()

    private var _current by mutableStateOf(Language.ENGLISH)
    val current: Language get() = _current

    /** Loads the message assets; call once from `Application.onCreate`. */
    fun init(context: Context, language: Language = Language.ENGLISH) {
        caches.clear()
        Language.entries.forEach { caches[it] = load(context, it) }
        strings = caches[language] ?: emptyMap()
        _current = language
    }

    fun setLanguage(language: Language) {
        strings = caches[language] ?: return
        _current = language
    }

    /** Dot-path lookup, e.g. `t("common.cancel")`; returns the raw key when missing. */
    fun t(key: String): String = strings[key] ?: key

    private fun load(context: Context, language: Language): Map<String, String> {
        val raw = context.assets.open("messages/${language.code}.json").bufferedReader().use { it.readText() }
        return flatten(json.parseToJsonElement(raw))
    }

    private fun flatten(element: JsonElement, prefix: String = ""): Map<String, String> {
        val out = mutableMapOf<String, String>()
        when (element) {
            is JsonObject -> element.forEach { (key, value) ->
                val path = if (prefix.isEmpty()) key else "$prefix.$key"
                out.putAll(flatten(value, path))
            }
            is JsonPrimitive -> if (element.isString) out[prefix] = element.content
            else -> {}
        }
        return out
    }
}
