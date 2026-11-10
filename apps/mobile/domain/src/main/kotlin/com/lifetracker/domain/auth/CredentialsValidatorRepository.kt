package com.lifetracker.domain.auth

import com.lifetracker.core.network.endpoints.UsersApi
import javax.inject.Inject
import javax.inject.Singleton

/** Outcome of a pre-register availability probe (port of the RN screen's
 * `available | taken | checking | null` status; `Unknown` covers the http /
 * network failure case the RN code swallows to "no status shown"). */
enum class Availability { Available, Taken, Unknown }

/**
 * Port of the RN public availability probes used by the register screen:
 * `authService.checkUsernameAvailability` (auth-service.ts) and
 * `userService.checkEmailAvailability` (user-service.ts).
 *
 * Both hit the rate-limited, auth-free `UsersApi.checkUsername/checkEmail`
 * endpoints. Failures are swallowed to [Availability.Unknown] — matching the
 * RN catch blocks that clear the status instead of surfacing an error.
 */
@Singleton
class CredentialsValidatorRepository @Inject constructor(
    private val users: UsersApi,
) {

    suspend fun checkUsername(username: String): Availability = runCatching {
        val body = users.checkUsername(username).successOrThrow()
        if (body.available) Availability.Available else Availability.Taken
    }.getOrDefault(Availability.Unknown)

    suspend fun checkEmail(email: String): Availability = runCatching {
        val body = users.checkEmail(email).successOrThrow()
        if (body.available) Availability.Available else Availability.Taken
    }.getOrDefault(Availability.Unknown)
}
