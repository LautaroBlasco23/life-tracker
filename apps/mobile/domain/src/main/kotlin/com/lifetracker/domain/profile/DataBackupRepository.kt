package com.lifetracker.domain.profile

import com.lifetracker.core.network.endpoints.DataApi
import com.lifetracker.core.network.model.RestoreCounts
import com.lifetracker.domain.auth.ApiError
import com.lifetracker.domain.auth.successOrThrow
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.io.OutputStream
import javax.inject.Inject
import javax.inject.Singleton

/** XLSX MIME shared by export (CreateDocument suggestions) and import filters. */
const val BACKUP_MIME =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

/** RN default when the server sends no Content-Disposition filename. */
const val DEFAULT_BACKUP_FILENAME = "life-tracker-backup.xlsx"

/**
 * Port of the RN `apps/mobile/lib/data-backup.ts` export/restore flows:
 *
 * - export streams the `@Streaming` XLSX response body into a sink supplied by
 *   the screen (the picked CreateDocument `Uri` output stream is opened by the
 *   caller) and returns the filename from `Content-Disposition`.
 * - import uploads a previously exported backup as multipart part `file`
 *   (XLSX ≤ 32 MB, server-enforced). **Destructive**: the backend wipes the
 *   user's data before restoring.
 */
@Singleton
class DataBackupRepository @Inject constructor(
    private val data: DataApi,
) {

    /**
     * Writes the backup workbook into `sink` (consumes + closes both sides).
     * @return the suggested filename from Content-Disposition (the screen
     *   keeps the CreateDocument-picked name — RN only used the server name
     *   for the share sheet, which CreateDocument replaces).
     */
    suspend fun exportTo(sink: OutputStream): String {
        val response = data.exportData()
        if (!response.isSuccessful) {
            response.errorBody()?.close()
            throw ApiError("Failed to export data", response.code())
        }
        val body = response.body() ?: run {
            throw ApiError("Failed to export data", response.code())
        }
        body.byteStream().use { input ->
            sink.use { output -> input.copyTo(output) }
        }
        return filenameFromDisposition(response.headers()["Content-Disposition"])
            ?: DEFAULT_BACKUP_FILENAME
    }

    /** POST /users/me/data/import (multipart part `file`). Destructive. */
    suspend fun importBackup(file: File): RestoreCounts {
        val part = MultipartBody.Part.createFormData(
            name = "file",
            filename = file.name,
            body = file.asRequestBody(BACKUP_MIME.toMediaType()),
        )
        return data.importData(part).successOrThrow().data
            ?: throw ApiError("Failed to import data")
    }

    /** `filename="?…" ` pattern of the RN `filenameFromDisposition`. */
    private fun filenameFromDisposition(header: String?): String? =
        header?.let { Regex("filename=\"?([^\";]+)\"?").find(it)?.groupValues?.get(1) }
}
