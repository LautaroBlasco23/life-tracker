package com.lifetracker.core.network.model

import kotlinx.serialization.Serializable

/**
 * One entry of the external Argentine dollar-rate API
 * (`GET https://dolarapi.com/v1/dolares`, returns a plain JSON array, no
 * envelope). Shape verified against `apps/mobile/lib/dolarapi.ts`.
 *
 * The endpoint is third-party and may add fields (`moneda`, `mayorista`); the
 * Json parser must therefore be configured with `ignoreUnknownKeys = true`.
 */
@Serializable
data class DolarRate(
    /** Rate "casa": e.g. `oficial`, `blue`. */
    val casa: String,
    /** Human-readable name, e.g. `Oficial`, `Blue`. */
    val nombre: String,
    /** Buy rate. */
    val compra: Double,
    /** Sell rate. */
    val venta: Double,
    /** Last-update timestamp (string as emitted by the API). */
    val fechaActualizacion: String,
)
