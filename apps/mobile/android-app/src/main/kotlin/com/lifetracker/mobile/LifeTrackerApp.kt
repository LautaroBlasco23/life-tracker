package com.lifetracker.mobile

import android.app.Application
import android.util.Log
import com.lifetracker.core.i18n.I18n
import com.lifetracker.core.storage.SecureStore
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.android.HiltAndroidApp
import dagger.hilt.components.SingletonComponent
import kotlin.system.measureTimeMillis

/**
 * Application start lifecycle:
 * - `I18n.init` stays on the main thread (tiny asset parse, needed before the
 *   first frame).
 * - The graph heavyweights (EncryptedSharedPreferences -> Android Keystore,
 *   Retrofit, DataStore) are PREWARMED on a worker thread: main-thread
 *   construction was observed as "failed to complete startup" ANRs on
 *   emulators without hardware acceleration (TCG). Subsequent injection is
 *   instant (already-created @Singleton, Dagger's double-checked laziness
 *   makes the race safe).
 */
@HiltAndroidApp
class LifeTrackerApp : Application() {

    override fun onCreate() {
        super.onCreate()
        val onMain = measureTimeMillis { I18n.init(this) }
        Log.i(LOG_TAG, "main-thread onCreate (i18n) took ${onMain}ms")
        Thread {
            val prewarm = measureTimeMillis {
                try {
                    EntryPointAccessors.fromApplication(applicationContext, StartupEntryPoint::class.java)
                        .secureStore().accessToken() // constructs prefs (keystore) + tokens
                } catch (e: Exception) {
                    Log.e(LOG_TAG, "prewarm failed", e)
                }
            }
            Log.i(LOG_TAG, "prewarm (keystore + prefs) took ${prewarm}ms")
        }.apply { name = "lifetracker-prewarm" }.start()
    }

    @EntryPoint
    @InstallIn(SingletonComponent::class)
    interface StartupEntryPoint {
        fun secureStore(): SecureStore
    }

    private companion object {
        const val LOG_TAG = "LifeTrackerStartup"
    }
}
