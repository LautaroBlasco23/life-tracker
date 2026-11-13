package com.lifetracker.core.network.model

import kotlinx.serialization.Serializable

/** Request body of `POST /auth/login`. */
@Serializable
data class LoginRequest(
    val identifier: String,
    val password: String,
)

/**
 * Request body of `POST /auth/register`.
 *
 * `timezone` is sent by the mobile client but ignored by the backend (unknown
 * field); the authoritative timezone channel is the `X-Timezone` header.
 */
@Serializable
data class RegisterRequest(
    val email: String,
    val password: String,
    val firstName: String,
    val lastName: String,
    val username: String,
    val timezone: String? = null,
)

/** Request body of `POST /auth/refresh`. */
@Serializable
data class RefreshRequest(
    val refreshToken: String,
)

/** Request body of `PUT /auth/password` (auth). */
@Serializable
data class UpdatePasswordRequest(
    val currentPassword: String,
    val newPassword: String,
)

/** Request body of `PUT /auth/email` (auth). */
@Serializable
data class UpdateEmailRequest(
    val password: String,
    val newEmail: String,
)

/**
 * Request body of `POST /auth/logout` (auth). Omitting `refreshToken` (or the
 * body entirely) revokes every session for the user.
 */
@Serializable
data class LogoutRequest(
    val refreshToken: String? = null,
)

/** Auth token pair as returned by login/register/refresh/password/email. */
@Serializable
data class TokenResponse(
    val accessToken: String,
    val refreshToken: String,
    val tokenType: String,
    val expiresIn: Long,
)

/**
 * `data` payload of the login/register auth envelope. On the backend's
 * degraded path (user fetch fails) login/register return
 * `data = TokenResponse` directly, so both fields are nullable and tolerate
 * unknown keys (decode `data` as [TokenResponse] when [tokens] is null).
 */
@Serializable
data class AuthData(
    val tokens: TokenResponse? = null,
    val user: UserResponse? = null,
)

/** Auth envelope: `{ "message": string, "data": { tokens, user } }`. */
@Serializable
data class AuthEnvelope(
    val message: String? = null,
    val data: AuthData? = null,
)

/**
 * Refresh/token envelope: `{ "message": string, "data": TokenResponse }`.
 * Used by refresh, password and email update.
 */
@Serializable
data class TokenEnvelope(
    val message: String? = null,
    val data: TokenResponse? = null,
)

/**
 * User profile as returned inside auth envelopes (and by the `/users/me`
 * surface). Wire tags verified against
 * `backend/internal/domain/user/dto/user_dto.go`.
 */
@Serializable
data class UserResponse(
    val id: Long,
    val username: String,
    val firstName: String,
    val lastName: String,
    val email: String,
    val profilePicUrl: String? = null,
    val thumbnailUrl: String? = null,
    val timezone: String? = null,
    val profilePrivacyStatus: String? = null,
    val createdAt: String,
    val updatedAt: String,
)
