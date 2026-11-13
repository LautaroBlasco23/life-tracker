package com.lifetracker.core.network.model

import kotlinx.serialization.Serializable

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** What is being cloned; raw values lowercase (contract §12). */
@Serializable
enum class SubscriptionSourceType {
    @kotlinx.serialization.SerialName("activity") ACTIVITY,
    @kotlinx.serialization.SerialName("routine") ROUTINE,
}

// ---------------------------------------------------------------------------
// Requests / responses
// ---------------------------------------------------------------------------

/** Body of `POST /subscriptions`. */
@Serializable
data class SubscribeRequest(
    val sourceType: SubscriptionSourceType,
    val sourceId: Int,
)

/**
 * Response of `POST /subscriptions` / `GET /subscriptions`. [clonedId] is the
 * local copy's id — the app must use that copy from then on, not [sourceId].
 */
@Serializable
data class SubscriptionResponse(
    val id: Int,
    val sourceType: SubscriptionSourceType,
    val sourceId: Int,
    val clonedId: Int,
)
