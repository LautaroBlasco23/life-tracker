package com.lifetracker.domain.social

import com.lifetracker.core.network.endpoints.SubscriptionsApi
import com.lifetracker.core.network.model.SubscriptionResponse
import com.lifetracker.core.network.model.SubscriptionSourceType
import com.lifetracker.domain.auth.ApiError
import com.lifetracker.domain.auth.successOrThrow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Port of the subscription half of the RN
 * `packages/shared/src/services/social-service.ts`: cloning public
 * activities/routines ("subscribing") and abandoning the clone.
 */
@Singleton
class SubscriptionsRepository @Inject constructor(
    private val api: SubscriptionsApi,
) {

    /** POST /subscriptions — clone a public activity or routine (HTTP 201). */
    suspend fun subscribe(sourceType: SubscriptionSourceType, sourceId: Int): Result<SubscriptionResponse> =
        runCatching {
            api.subscribe(
                com.lifetracker.core.network.model.SubscribeRequest(sourceType, sourceId)
            ).successOrThrow().data
                ?: throw ApiError("Subscription payload was missing")
        }

    /** GET /subscriptions — the user's clones. */
    suspend fun mySubscriptions(): Result<List<SubscriptionResponse>> = runCatching {
        api.mySubscriptions().successOrThrow().data ?: emptyList()
    }

    /** DELETE /subscriptions/{id} — removes the clone. */
    suspend fun unsubscribe(id: Int): Result<Unit> = runCatching {
        api.unsubscribe(id).successOrThrow()
    }
}
