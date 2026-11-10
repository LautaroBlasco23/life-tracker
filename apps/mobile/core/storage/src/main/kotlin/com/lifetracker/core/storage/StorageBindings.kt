package com.lifetracker.core.storage

import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class StorageBindings {

    @Binds
    @Singleton
    abstract fun tokenProvider(impl: SecureStore): TokenProvider

    @Binds
    @Singleton
    abstract fun sessionStore(impl: SecureStore): SessionStore
}
