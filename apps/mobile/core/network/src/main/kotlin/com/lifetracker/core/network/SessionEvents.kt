package com.lifetracker.core.network

import kotlinx.coroutines.flow.MutableSharedFlow
import javax.inject.Inject
import javax.inject.Singleton

/** Fired by the authenticator when the refresh chain gives up (force-logout). */
@Singleton
class SessionEvents @Inject constructor() {
    val loggedOut = MutableSharedFlow<Unit>(extraBufferCapacity = 8)
    fun fire() { loggedOut.tryEmit(Unit) }
}
