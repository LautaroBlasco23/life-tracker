package com.lifetracker.feature.profile

import com.lifetracker.core.i18n.I18n

/**
 * `t(key, param = value)`: dot-path lookup with group sugar — bare keys
 * resolve inside the feature's message group (`t("theme")` → `profile.theme`),
 * dotted keys ("privacy.public") pass through. Interpolation is `I18n.t`'s.
 */
private const val GROUP = "profile"

internal fun t(key: String, vararg params: Pair<String, Any?>): String =
    I18n.t(if (key.contains('.')) key else "$GROUP.$key", *params)

/** Joiner for toast titles + optional descriptions (`showToast({title, description})`). */
internal fun toastText(title: String, description: String? = null): String =
    if (description.isNullOrEmpty()) title else "$title — $description"
