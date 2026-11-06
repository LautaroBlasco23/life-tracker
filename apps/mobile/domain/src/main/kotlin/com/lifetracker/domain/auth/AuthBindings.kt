package com.lifetracker.domain.auth

import com.lifetracker.core.network.TokenRefresher
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
abstract class AuthBindings {

    @Binds
    abstract fun tokenRefresher(impl: AuthRepository): TokenRefresher
}
