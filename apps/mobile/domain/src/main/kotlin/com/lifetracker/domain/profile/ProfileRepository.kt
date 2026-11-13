package com.lifetracker.domain.profile

import com.lifetracker.core.network.BuildConfigBaseUrlProvider
import com.lifetracker.core.network.endpoints.UsersApi
import com.lifetracker.core.network.model.PrivacyStatus
import com.lifetracker.core.network.model.UpdateUserRequest
import com.lifetracker.core.network.model.UserResponse
import com.lifetracker.core.storage.SessionStore
import com.lifetracker.core.storage.SessionUser
import com.lifetracker.domain.auth.ApiError
import com.lifetracker.domain.auth.successOrThrow
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Port of the RN `packages/shared/src/services/user-service.ts` (own-profile
 * surface): profile fetch with write-through of the cached session user,
 * privacy toggle, and the multipart avatar upload/delete.
 *
 * `effectiveApiUrl` feeds the Profile screen's API URL row (port of
 * `getConfig().apiUrl`, incl. the DataStore override from storage-init).
 */
@Singleton
class ProfileRepository @Inject constructor(
    private val users: UsersApi,
    private val sessions: SessionStore,
    private val baseUrlProvider: BuildConfigBaseUrlProvider,
) {

    /** GET /users/me — also refreshes the cached session user (RN parity). */
    suspend fun getMyProfile(): UserResponse {
        val user = users.myProfile().successOrThrow().data
            ?: throw ApiError("Failed to fetch profile")
        sessions.setCurrentUser(user.toSessionUser())
        return user
    }

    /** PUT /users/me with the privacy field only (RN `togglePrivacy`). */
    suspend fun updatePrivacyStatus(status: PrivacyStatus): UserResponse =
        users.updateProfile(UpdateUserRequest(profilePrivacyStatus = status))
            .successOrThrow().data ?: throw ApiError("Failed to update user")

    /**
     * POST /users/me/image — multipart part `image` (contract §11).
     * Bytes are produced by the screen (ContentResolver); the repo only sees
     * raw bytes + the picked MIME type.
     */
    suspend fun uploadImage(bytes: ByteArray, contentType: String): UserResponse {
        val mediaType = contentType.ifBlank { "image/jpeg" }.toMediaType()
        val part = MultipartBody.Part.createFormData(
            name = "image",
            filename = imageFileName(contentType),
            body = bytes.toRequestBody(mediaType),
        )
        return users.uploadProfileImage(part).successOrThrow().data
            ?: throw ApiError("Failed to upload profile picture")
    }

    /** DELETE /users/me/image; RN then re-fetches the profile (user-service parity). */
    suspend fun deleteImage(): UserResponse {
        users.deleteProfileImage().successOrThrow()
        return getMyProfile()
    }

    /** Current API URL for the Profile row display (override, else build default). */
    fun effectiveApiUrl(): String = baseUrlProvider.get()

    private fun imageFileName(contentType: String): String {
        val extension = when {
            contentType.contains("png") -> "png"
            contentType.contains("webp") -> "webp"
            else -> "jpg"
        }
        return "profile.$extension"
    }
}

/** Fresh profile payloads replace the cached session snapshot (user-service parity). */
internal fun UserResponse.toSessionUser() = SessionUser(
    id = id,
    username = username,
    firstName = firstName,
    lastName = lastName,
    email = email,
    profilePicUrl = profilePicUrl,
    thumbnailUrl = thumbnailUrl,
)
