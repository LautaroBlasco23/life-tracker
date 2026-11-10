package com.lifetracker.core.designsystem

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

/**
 * Port of RN `components/ui/toast.tsx`, rendered once at the app root.
 *
 * Session-scoped state + bottom-centered overlay (the RN overlay was top-anchored;
 * the Compose port lands it as a snackbar-like bottom toast). Queue semantics
 * match RN: only the latest toast is visible, auto-dismiss after 4s, tap to hide.
 */
class ToastState {
    internal var current by mutableStateOf<ToastData?>(null)
    private var sequence = 0L

    /** Shows `text`; a new toast replaces any in-flight one. */
    fun show(text: String, isError: Boolean = false) {
        current = ToastData(text, isError, ++sequence)
    }

    internal fun hide() {
        current = null
    }
}

internal data class ToastData(val text: String, val isError: Boolean, val id: Long)

/** Single-instance toast state (features use `LocalToast` instead). */
@Composable
fun rememberToastState(): ToastState = remember { ToastState() }

/** Provided at the app root so features can do `LocalToast.current.show(...)` (RN `showToast`). */
val LocalToast: androidx.compose.runtime.ProvidableCompositionLocal<ToastState> =
    staticCompositionLocalOf { ToastState() }

/** Toast overlay; compose once per screen root (or in the app host) above everything. */
@Composable
fun ToastHost(state: ToastState) {
    val toast = state.current
    // Retain the last message during the exit animation.
    var visibleToast by remember { mutableStateOf<ToastData?>(toast) }
    if (toast != null) visibleToast = toast

    LaunchedEffect(toast) {
        if (toast != null) {
            delay(4000)
            state.hide()
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        AnimatedVisibility(
            visible = toast != null,
            enter = fadeIn() + slideInVertically { it / 2 },
            exit = fadeOut() + slideOutVertically { it / 2 },
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
        ) {
            val shown = visibleToast
            if (shown != null) {
                val colors = LocalAppColors.current
                val shape = RoundedCornerShape(8.dp)
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(shape)
                        .background(if (shown.isError) colors.danger else colors.background)
                        .border(
                            1.dp,
                            if (shown.isError) colors.danger else colors.border,
                            shape,
                        )
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = state::hide,
                        )
                        .padding(12.dp),
                ) {
                    Text(
                        shown.text,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (shown.isError) colors.primaryForeground else colors.foreground,
                    )
                }
            }
        }
    }
}
