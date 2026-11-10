package com.lifetracker.feature.profile

import com.lifetracker.core.i18n.I18n

/**
 * `t(key, param = value)`: dot-path string lookup with `{name}` interpolation
 * (the shared messages JSON uses react-intl style placeholders that the
 * flattened-string `I18n.t` does not interpolate). Same helper as feature/time.
 * Bare keys resolve inside the feature's message group — `t("theme")` →
 * `profile.theme` — while dotted keys ("privacy.public") pass through unchanged.
 */
private const val GROUP = "profile"

internal fun t(key: String, vararg params: Pair<String, Any?>): String =
    params.fold(I18n.t(if (key.contains('.')) key else "$GROUP.$key")) { acc, (name, value) ->
        acc.replace("{$name}", value?.toString() ?: "")
    }

/** Joiner for toast titles + optional descriptions (`showToast({title, description})`). */
internal fun toastText(title: String, description: String? = null): String =
    if (description.isNullOrEmpty()) title else "$title — $description"
