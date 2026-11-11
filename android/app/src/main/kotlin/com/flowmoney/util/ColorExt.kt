package com.flowmoney.util

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance

/** "#RRGGBB" → [Color]; null si el texto no tiene ese formato. */
fun String.toColorOrNull(): Color? {
    if (length != 7 || first() != '#') return null
    val rgb = substring(1).toLongOrNull(radix = 16) ?: return null
    return Color(0xFF000000 or rgb)
}

private val DarkContent = Color(0xFF16231E)

/**
 * Color de texto/ícono legible sobre este fondo: elige entre blanco y tinta
 * el que tenga mayor contraste (fórmula de contraste de WCAG).
 */
fun Color.readableContentColor(): Color {
    val background = luminance()
    val contrastWithWhite = 1.05f / (background + 0.05f)
    val contrastWithDark = (background + 0.05f) / (DarkContent.luminance() + 0.05f)
    return if (contrastWithWhite >= contrastWithDark) Color.White else DarkContent
}
