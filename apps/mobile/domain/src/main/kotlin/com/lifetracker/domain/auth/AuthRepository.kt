package com.lifetracker.domain.auth

import com.lifetracker.core.network.TokenRefresher
import com.lifetracker.core.storage.SessionStore
import com.lifetracker.core.storage.SessionUser
import com.lifetracker.core.storage.TokenProvider
import com.lifetracker.core.network.endpoints.AuthApi
import com.lifetracker.core.network.model.AuthData
import com.lifetracker.core.network.model.ApiErrorBody
import com.lifetracker.core.network.model.LoginRequest
import com.lifetracker.core.network.model.LogoutRequest
import com.lifetracker.core.network.model.RefreshRequest
import com.lifetracker.core.network.model.RegisterRequest
import com.lifetracker.core.network.model.TokenEnvelope
import com.lifetracker.core.network.model.TokenResponse
import com.lifetracker.core.network.model.UpdateEmailRequest
import com.lifetracker.core.network.model.UpdatePasswordRequest
import com.lifetracker.core.network.model.UserResponse
import kotlinx.serialization.json.Json
import kotlinx.coroutines.runBlocking
import retrofit2.Response
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

/**
 * Port of the RN `packages/shared/src/services/auth-service.ts`:
 * session bootstrap from encrypted storage, login/register/logout,
 * single-flight refresh (drives the OkHttp `SessionAuthenticator`),
 * change password/email returning fresh token pairs that MUST be persisted,
 * best-effort server logout.
 */
@Singleton
class AuthRepository @Inject constructor(
    private val auth: AuthApi,
    @Named("bootstrap") private val bootstrapAuth: AuthApi,
    private val tokens: TokenProvider,
    private val sessions: SessionStore,
) : TokenRefresher {

    // ---- session state (bootstrap) ----

    val isAuthenticated: Boolean get() = tokens.accessToken() != null

    val currentUser: SessionUser? get() = sessions.currentUser()

    // ---- login / register / logout ----

    suspend fun login(identifier: String, password: String): Result<UserResponse> = runCatching {
        applyAuth(auth.login(LoginRequest(identifier, password)).successOrThrow().data)
    }

    suspend fun register(
        email: String,
        password: String,
        firstName: String,
        lastName: String,
        username: String,
    ): Result<UserResponse> = runCatching {
        applyAuth(bootstrapAuth.register(
            RegisterRequest(email, password, firstName, lastName, username)
        ).successOrThrow().data)
    }

    /** Best-effort server logout; the local side (tokens + user) is cleared first. */
    suspend fun logout() {
        val refresh = tokens.refreshToken()
        clearSession()
        if (refresh != null) {
            runCatching { auth.logout(LogoutRequest(refresh)).successOrThrow() }
        }
    }

    // ---- account changes (both return fresh token pairs that must be persisted) ----

    suspend fun changePassword(currentPassword: String, newPassword: String): Result<TokenResponse> =
        runCatching { stash(auth.updatePassword(UpdatePasswordRequest(currentPassword, newPassword)).successOrThrow().data
            ?: error("Password change returned no token payload")) }

    suspend fun changeEmail(password: String, newEmail: String): Result<TokenResponse> =
        runCatching { stash(auth.updateEmail(UpdateEmailRequest(password, newEmail)).successOrThrow().data
            ?: error("Email change returned no token payload")) }

    // ---- TokenRefresher (called by the OkHttp SessionAuthenticator) ----

    override fun refreshBlocking(refreshToken: String): Boolean {
        val response = runBlocking {
            runCatching { bootstrapAuth.refresh(RefreshRequest(refreshToken)) }
        }.getOrNull() ?: return false
        val t = response.body()?.data ?: return false
        tokens.storeTokens(t.accessToken, t.refreshToken)
        return true
    }

    // ---- internals ----

    private fun applyAuth(data: AuthData?): UserResponse {
        val t = data?.tokens ?: throw ApiError("Login succeeded but the token payload was missing")
        val u = data.user ?: throw ApiError("Logged in but the user profile is currently unavailable")
        tokens.storeTokens(t.accessToken, t.refreshToken)
        sessions.setCurrentUser(
            SessionUser(
                id = u.id,
                username = u.username,
                firstName = u.firstName,
                lastName = u.lastName,
                email = u.email,
                profilePicUrl = u.profilePicUrl,
                thumbnailUrl = u.thumbnailUrl,
            )
        )
        return u
    }

    private fun stash(token: TokenResponse): TokenResponse {
        tokens.storeTokens(token.accessToken, token.refreshToken)
        return token
    }

    private fun clearSession() {
        tokens.clearTokens()
        sessions.setCurrentUser(null)
    }
}

/** One network/API failure, message drawn from the backend error envelope. */
class ApiError(
    override val message: String,
    val status: Int? = null,
    val details: String? = null,
) : Exception(message)

/** Response helpers: parse the backend error envelope on failure. */
private val errorJson = Json { ignoreUnknownKeys = true }

fun <T> Response<T>.successOrThrow(): T {
    if (isSuccessful) return body() ?: throw ApiError("Empty response body", code())
    val raw = errorBody()?.string()
    val parsed = raw?.let { body -> runCatching { errorJson.decodeFromString<ApiErrorBody>(body) }.getOrNull() }
    throw ApiError(
        message = parsed?.error ?: "Request failed (${code()})",
        status = code(),
        details = parsed?.details,
    )
}
