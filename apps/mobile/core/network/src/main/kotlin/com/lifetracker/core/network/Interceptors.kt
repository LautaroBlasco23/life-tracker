package com.lifetracker.core.network

import com.lifetracker.core.storage.TokenProvider
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Interceptor
import okhttp3.Response
import java.util.TimeZone

/** Adds `X-Timezone` (backend middleware drives streaks/day boundaries) + Bearer token. */
internal class AuthInterceptor(private val tokens: TokenProvider) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request().newBuilder()
            .header("X-Timezone", TimeZone.getDefault().getID())
            .apply { tokens.accessToken()?.let { header("Authorization", "Bearer $it") } }
            .build()
        return chain.proceed(request)
    }
}

/**
 * Runtime base-url override (Profile > API URL in the RN app). Empty value
 * keeps the build-time default. The resolved effective base is applied once
 * per request; endpoint-relative paths and the query are preserved.
 */
internal class DynamicUrlInterceptor(private val apiSettings: com.lifetracker.core.storage.SettingsRepository) :
    Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val effective = apiSettings.currentApiUrlBlocking().takeIf { it.isNotBlank() } ?: return chain.proceed(request)
        val relative = relativePath(request.url) ?: return chain.proceed(request)
        val target = normalize(effective) + "/" + relative.trim('/') +
            (request.url.query?.let { "?$it" } ?: "")
        return chain.proceed(request.newBuilder().url(target.toHttpUrl()).build())
    }

    /** Segments after the `/api` prefix, e.g. "activities" or "users/me/image". */
    private fun relativePath(url: HttpUrl): String? {
        val segments = url.pathSegments.dropLastWhile { it.isEmpty() }
        val api = segments.indexOfFirst { it == "api" }
        return segments.drop(api + 1).joinToString("/").takeIf { it.isNotEmpty() }
    }

    /** Guarantees a single trailing slash-free prefix + "/api" present (or just a bare host path). */
    private fun normalize(base: String): String {
        val trimmed = base.trimEnd('/')
        return if (trimmed.endsWith("/api")) trimmed else "$trimmed/api"
    }
}
