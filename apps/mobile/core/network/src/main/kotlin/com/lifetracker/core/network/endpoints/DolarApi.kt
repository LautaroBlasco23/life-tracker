package com.lifetracker.core.network.endpoints

import com.lifetracker.core.network.model.DolarRate
import retrofit2.Response
import retrofit2.http.GET

/**
 * External Argentine dollar-rate API — a plain third-party REST endpoint with
 * no **envelope**: `GET https://dolarapi.com/v1/dolares` returns a bare JSON
 * array of [DolarRate] values (shape verified against
 * `apps/mobile/lib/dolarapi.ts`).
 *
 * Note for the Retrofit/Json wiring: this API needs its own base URL
 * (`https://dolarapi.com`) and a Json instance with `ignoreUnknownKeys = true`
 * (the provider adds fields over time, e.g. `moneda`/`mayorista`). It also does
 * not use the app's auth headers or 401-refresh flow — a plain client applies.
 */
interface DolarApi {

    /** Lists the published dollar cabinet rates. */
    @GET("v1/dolares")
    suspend fun dolares(): Response<List<DolarRate>>
}
