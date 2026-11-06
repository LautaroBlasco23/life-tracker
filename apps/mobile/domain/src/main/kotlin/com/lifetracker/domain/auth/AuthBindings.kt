package com.lifetracker.domain.auth

import com.lifetracker.core.network.TokenRefresher
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Global DI wiring note (app graph was only fully validated once
 * `@HiltAndroidApp` landed): [AuthRepository] implements the OkHttp single-
 * flight refresh hook, but Dagger never auto-binds the supertypes of an
 * `@Inject`-constructed class, so the `TokenRefresher` binding must live here.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class AuthBindings {

    @Binds
    @Singleton
    abstract fun tokenRefresher(impl: AuthRepository): TokenRefresher
}
