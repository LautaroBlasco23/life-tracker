package com.lifetracker.core.network.model

import kotlinx.serialization.Serializable

/** Per-entity count returned by `POST /users/me/data/import`. */
@Serializable
data class RestoreCounts(
    val activities: Int,
    val timeRecords: Int,
    val calendarEvents: Int,
    val notes: Int,
    val routines: Int,
    val routineActivities: Int,
    val activityRecords: Int,
    val transactions: Int,
    val payments: Int,
)
