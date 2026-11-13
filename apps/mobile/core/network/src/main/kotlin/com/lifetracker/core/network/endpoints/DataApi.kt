package com.lifetracker.core.network.endpoints

import com.lifetracker.core.network.model.ApiEnvelope
import com.lifetracker.core.network.model.RestoreCounts
import okhttp3.MultipartBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Streaming

/**
 * Data backup endpoints (contract §11): `/users/me/data/＊`.
 *
 * Import is **destructive** — the backend wipes the user's current data before
 * restoring — and rejects files larger than 32 MB with
 * `400 { "error": "File is too large" }`.
 */
interface DataApi {

    /**
     * Downloads the full backup as an XLSX binary.
     *
     * Declared `@Streaming` so the workbook is not buffered entirely in memory.
     * The response is `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
     * and carries `Content-Disposition: attachment; filename="life-tracker-backup-YYYY-MM-DD.xlsx"`
     * (pointer to the date the file was generated). The client never parses the
     * workbook — save the bytes and, ideally, [okhttp3.Response.header] of
     * `Content-Disposition` so the file can be re-uploaded unmodified.
     */
    @Streaming
    @GET("users/me/data/export")
    suspend fun exportData(): Response<ResponseBody>

    /** Uploads a previously exported backup (part `file`, XLSX ≤ 32 MB). Destructive. */
    @Multipart
    @POST("users/me/data/import")
    suspend fun importData(@Part file: MultipartBody.Part): Response<ApiEnvelope<RestoreCounts>>
}
