package com.lifetracker.core.network.endpoints

import com.lifetracker.core.network.model.AuthEnvelope
import com.lifetracker.core.network.model.LoginRequest
import com.lifetracker.core.network.model.LogoutRequest
import com.lifetracker.core.network.model.MessageOnly
import com.lifetracker.core.network.model.RefreshRequest
import com.lifetracker.core.network.model.RegisterRequest
import com.lifetracker.core.network.model.TokenEnvelope
import com.lifetracker.core.network.model.UpdateEmailRequest
import com.lifetracker.core.network.model.UpdatePasswordRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.PUT

/**
 * Auth surface (`/auth/＊`). Bearer auth + `X-Timezone` are attached by an
 * interceptor elsewhere; no `@Header` here.
 */
interface AuthApi {

    /** POST /auth/register — create account; 201 with tokens + user. */
    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthEnvelope>

    /** POST /auth/login — login with email or username in `identifier`. */
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthEnvelope>

    /** POST /auth/refresh — exchange the refresh token for a new pair. */
    @POST("auth/refresh")
    suspend fun refresh(@Body request: RefreshRequest): Response<TokenEnvelope>

    /** PUT /auth/password — change password; returns a fresh token pair. */
    @PUT("auth/password")
    suspend fun updatePassword(@Body request: UpdatePasswordRequest): Response<TokenEnvelope>

    /** PUT /auth/email — change email (password-confirmed); returns a fresh token pair. */
    @PUT("auth/email")
    suspend fun updateEmail(@Body request: UpdateEmailRequest): Response<TokenEnvelope>

    /** POST /auth/logout — revoke the given refresh token, or all sessions. */
    @POST("auth/logout")
    suspend fun logout(@Body request: LogoutRequest): Response<MessageOnly>
}
