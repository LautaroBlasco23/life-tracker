package com.lifetracker.core.storage

import kotlinx.serialization.Serializable

/**
 * Minimal identity snapshot cached alongside the tokens (port of the RN
 * auth-service `currentUser` cache). Full user payloads live in
 * `com.lifetracker.core.network.model.auth.User`.
 */
@Serializable
data class SessionUser(
    val id: Long,
    val username: String? = null,
    val firstName: String,
    val lastName: String,
    val email: String,
    val profilePicUrl: String? = null,
    val thumbnailUrl: String? = null,
)
