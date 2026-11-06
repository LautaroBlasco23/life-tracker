package com.lifetracker.feature.profile

import android.content.Context
import android.net.Uri
import android.graphics.BitmapFactory
import android.provider.OpenableColumns
import com.lifetracker.domain.profile.BACKUP_MIME
import com.lifetracker.domain.profile.DEFAULT_BACKUP_FILENAME
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lifetracker.core.designsystem.LocalAppColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URL

/**
 * Screen-side ActivityResult wiring (the ContentResolver/Uri access stays at
 * the screen level — the ViewModel only sees bytes, streams and temp files):
 * - [pickAvatar]: PickVisualMedia → bytes + mime → `viewModel.uploadImage`,
 * - [launchExport]/[launchImport]: CreateDocument / OpenDocument for the
 *   backup flows (import copy lands in the cache dir; the part upload is the
 *   repo's `file` multipart).
 */
internal class ProfileActivityResultActions internal constructor(
    val pickAvatar: () -> Unit,
    val launchExport: (String) -> Unit,
    val launchImport: () -> Unit,
)

private const val IMPORT_CACHE_PREFIX = "life-tracker-import"

@Composable
internal fun rememberProfileActivityResultActions(
    viewModel: ProfileViewModel,
): ProfileActivityResultActions {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val pickImageLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val resolver = context.contentResolver
        scope.launch {
            val picked = withContext(Dispatchers.IO) {
                val bytes = resolver.openInputStream(uri)?.use { stream -> stream.readBytes() }
                    ?: return@withContext null
                bytes to (resolver.getType(uri) ?: "image/jpeg")
            } ?: return@launch
            viewModel.uploadImage(picked.first, picked.second)
        }
    }

    val exportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument(BACKUP_MIME),
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val resolver = context.contentResolver
        scope.launch {
            val stream = withContext(Dispatchers.IO) { resolver.openOutputStream(uri) }
            viewModel.exportTo(stream)
        }
    }

    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val resolver = context.contentResolver
        scope.launch {
            val name = displayNameOf(context, uri)
            val temp = withContext(Dispatchers.IO) {
                resolver.openInputStream(uri)?.use { input ->
                    File.createTempFile(IMPORT_CACHE_PREFIX, ".xlsx", context.cacheDir).apply {
                        outputStream().use { output -> input.copyTo(output) }
                    }
                }
            }
            viewModel.onImportFileSelected(name, temp)
        }
    }

    return remember {
        ProfileActivityResultActions(
            pickAvatar = {
                pickImageLauncher.launch(
                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                )
            },
            launchExport = { suggestedName -> exportLauncher.launch(suggestedName) },
            launchImport = {
                importLauncher.launch(arrayOf(BACKUP_MIME, "application/octet-stream"))
            },
        )
    }
}

/** ContentResolver display name of a picked document (falls back to the RN default). */
private fun displayNameOf(context: Context, uri: Uri): String =
    runCatching {
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            ?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }
    }.getOrNull() ?: DEFAULT_BACKUP_FILENAME

/** 64dp circle avatar: server image when available, initial-letter fallback (RN parity). */
@Composable
internal fun AvatarImage(
    url: String?,
    firstName: String,
    modifier: Modifier = Modifier,
    initialsColor: Color? = null,
) {
    val colors = LocalAppColors.current
    var bitmap by remember(url) { mutableStateOf<android.graphics.Bitmap?>(null) }
    LaunchedEffect(url) {
        bitmap = if (url.isNullOrBlank()) {
            null
        } else {
            withContext(Dispatchers.IO) {
                runCatching { BitmapFactory.decodeStream(URL(url).openStream()) }.getOrNull()
            }
        }
    }
    val shape = CircleShape
    Box(
        modifier = modifier
            .size(64.dp)
            .clip(shape)
            .background(colors.surface),
        contentAlignment = Alignment.Center,
    ) {
        val loaded = bitmap
        if (loaded != null) {
            Image(
                bitmap = loaded.asImageBitmap(),
                contentDescription = "Profile picture",
                modifier = Modifier
                    .size(64.dp)
                    .clip(shape),
            )
        } else {
            Text(
                firstName.firstOrNull()?.toString() ?: "?",
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = initialsColor ?: colors.textMuted,
            )
        }
    }
}
