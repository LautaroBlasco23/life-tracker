package com.lifetracker.core.network

import com.lifetracker.core.network.endpoints.ActivitiesApi
import com.lifetracker.core.network.endpoints.AuthApi
import com.lifetracker.core.network.endpoints.CalendarEventsApi
import com.lifetracker.core.network.endpoints.DataApi
import com.lifetracker.core.network.endpoints.DolarApi
import com.lifetracker.core.network.endpoints.FinancesApi
import com.lifetracker.core.network.endpoints.FollowsApi
import com.lifetracker.core.network.endpoints.NotesApi
import com.lifetracker.core.network.endpoints.RemindersApi
import com.lifetracker.core.network.endpoints.RoutinesApi
import com.lifetracker.core.network.endpoints.SubscriptionsApi
import com.lifetracker.core.network.endpoints.TimeRecordsApi
import com.lifetracker.core.network.endpoints.UsersApi
import com.lifetracker.core.storage.SettingsRepository
import com.lifetracker.core.storage.TokenProvider
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import javax.inject.Named
import javax.inject.Provider
import javax.inject.Qualifier
import javax.inject.Singleton
import javax.inject.Inject

@Qualifier annotation class BootstrapRetrofit
@Qualifier annotation class MainRetrofit
@Qualifier annotation class DolarRetrofit

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun json(): Json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
    }

    @Provides
    @Singleton
    fun authenticator(tokens: TokenProvider, refresher: Provider<TokenRefresher>, events: SessionEvents): SessionAuthenticator =
        SessionAuthenticator(tokens, refresher) { events.fire() }

    @Provides
    @Named("bootstrap")
    fun bootstrapClient(settings: SettingsRepository): OkHttpClient =
        OkHttpClient.Builder()
            .addInterceptor(DynamicUrlInterceptor(settings))
            .build()

    @Provides
    @Singleton
    fun client(
        settings: SettingsRepository,
        tokens: TokenProvider,
        refresher: Provider<TokenRefresher>,
        events: SessionEvents,
    ): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(DynamicUrlInterceptor(settings))
        .addInterceptor(AuthInterceptor(tokens))
        .authenticator(SessionAuthenticator(tokens, refresher) { events.fire() })
        .build()

    @Provides
    @BootstrapRetrofit
    fun bootstrapRetrofit(base: BuildConfigBaseUrlProvider, json: Json, @Named("bootstrap") client: OkHttpClient): Retrofit =
        Retrofit.Builder()
            .baseUrl(base.get())
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()

    @Provides
    @MainRetrofit
    fun retrofit(base: BuildConfigBaseUrlProvider, json: Json, client: OkHttpClient): Retrofit =
        Retrofit.Builder()
            .baseUrl(base.get())
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()

    // ---- API creation (main = authenticated OkHttp) ----

    @Provides
    @Singleton
    fun authApi(@MainRetrofit retrofit: Retrofit): AuthApi = retrofit.create(AuthApi::class.java)

    @Provides
    @Named("bootstrap")
    fun bootstrapAuthApi(@BootstrapRetrofit retrofit: Retrofit): AuthApi = retrofit.create(AuthApi::class.java)

    @Provides @Singleton fun activitiesApi(@MainRetrofit retrofit: Retrofit): ActivitiesApi = retrofit.create(ActivitiesApi::class.java)
    @Provides @Singleton fun routinesApi(@MainRetrofit retrofit: Retrofit): RoutinesApi = retrofit.create(RoutinesApi::class.java)
    @Provides @Singleton fun remindersApi(@MainRetrofit retrofit: Retrofit): RemindersApi = retrofit.create(RemindersApi::class.java)
    @Provides @Singleton fun timeRecordsApi(@MainRetrofit retrofit: Retrofit): TimeRecordsApi = retrofit.create(TimeRecordsApi::class.java)
    @Provides @Singleton fun calendarEventsApi(@MainRetrofit retrofit: Retrofit): CalendarEventsApi = retrofit.create(CalendarEventsApi::class.java)
    @Provides @Singleton fun notesApi(@MainRetrofit retrofit: Retrofit): NotesApi = retrofit.create(NotesApi::class.java)
    @Provides @Singleton fun financesApi(@MainRetrofit retrofit: Retrofit): FinancesApi = retrofit.create(FinancesApi::class.java)
    @Provides @Singleton fun followsApi(@MainRetrofit retrofit: Retrofit): FollowsApi = retrofit.create(FollowsApi::class.java)
    @Provides @Singleton fun usersApi(@MainRetrofit retrofit: Retrofit): UsersApi = retrofit.create(UsersApi::class.java)
    @Provides @Singleton fun subscriptionsApi(@MainRetrofit retrofit: Retrofit): SubscriptionsApi = retrofit.create(SubscriptionsApi::class.java)
    @Provides @Singleton fun dataApi(@MainRetrofit retrofit: Retrofit): DataApi = retrofit.create(DataApi::class.java)

    /** Third-party dollar-rate API: separate base URL, no auth, plain client. */
    @Provides
    @Singleton
    fun dolarApi(json: Json): DolarApi = Retrofit.Builder()
        .baseUrl("https://dolarapi.com/")
        .client(OkHttpClient())
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(DolarApi::class.java)
}

/** Bridge for the build-time default base URL (network BuildConfig). */
@Singleton
class BuildConfigBaseUrlProvider @Inject constructor(private val settings: SettingsRepository) {
    fun get(): String {
        val override = settings.currentApiUrlBlocking().takeIf { it.isNotBlank() }
        val fallback = com.lifetracker.core.network.BuildConfig.API_BASE_URL.trimEnd('/')
        return (override ?: fallback).let { if (it.endsWith("/")) it else "$it/" }
    }
}
