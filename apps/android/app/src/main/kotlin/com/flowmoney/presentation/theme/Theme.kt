package com.flowmoney.presentation.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.flowmoney.domain.model.AppTheme

private val GreenColors = with(GreenTokens) {
    darkColorScheme(
        primary = Accent,
        onPrimary = Canvas,
        primaryContainer = AccentContainer,
        onPrimaryContainer = Accent,
        inversePrimary = AccentDeep,
        secondary = Mist,
        onSecondary = Canvas,
        secondaryContainer = Graphite,
        onSecondaryContainer = Paper,
        tertiary = Fog,
        onTertiary = Canvas,
        error = Alert,
        onError = Paper,
        errorContainer = Color(0xFF3A1717),
        onErrorContainer = Color(0xFFFFB4B4),
        background = Canvas,
        onBackground = Paper,
        surface = Canvas,
        onSurface = Paper,
        surfaceVariant = Obsidian,
        onSurfaceVariant = Fog,
        surfaceTint = Color.Transparent,
        inverseSurface = Mist,
        inverseOnSurface = Canvas,
        surfaceContainerLowest = Color(0xFF050506),
        surfaceContainerLow = Carbon,
        surfaceContainer = Color(0xFF131416),
        surfaceContainerHigh = Obsidian,
        surfaceContainerHighest = Slate,
        outline = Smoke,
        outlineVariant = Graphite,
        scrim = Color.Black,
    )
}

private val MonoColors = with(MonoTokens) {
    lightColorScheme(
        primary = Ink,
        onPrimary = Canvas,
        primaryContainer = Line,
        onPrimaryContainer = Ink,
        inversePrimary = Line,
        secondary = Soft,
        onSecondary = Canvas,
        secondaryContainer = High,
        onSecondaryContainer = Ink,
        tertiary = Muted,
        onTertiary = Canvas,
        error = Alert,
        onError = Canvas,
        errorContainer = Color(0xFFFBE3E3),
        onErrorContainer = Color(0xFF5A1010),
        background = Canvas,
        onBackground = Ink,
        surface = Canvas,
        onSurface = Ink,
        surfaceVariant = Raised,
        onSurfaceVariant = Muted,
        surfaceTint = Color.Transparent,
        inverseSurface = Ink,
        inverseOnSurface = Canvas,
        surfaceContainerLowest = Canvas,
        surfaceContainerLow = Surface,
        surfaceContainer = Raised,
        surfaceContainerHigh = High,
        surfaceContainerHighest = Line,
        outline = Outline,
        outlineVariant = Line,
        scrim = Color.Black,
    )
}

// Pocos radios, como en la web: 6 para controles, 12 para tarjetas y hojas.
private val FlowMoneyShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(6.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(12.dp),
    extraLarge = RoundedCornerShape(16.dp),
)

/** ¿Este tema usa fondo oscuro? (para los íconos de la barra de estado). */
val AppTheme.isDark: Boolean get() = this == AppTheme.GREEN

/**
 * Tema de marca. No usa colores dinámicos del sistema (Material You) a propósito: la persona
 * elige entre "Verde y negro" y "Blanco y negro", y la app respeta esa elección.
 */
@Composable
fun FlowMoneyTheme(
    theme: AppTheme = AppTheme.Default,
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (theme == AppTheme.MONO) MonoColors else GreenColors,
        typography = FlowMoneyTypography,
        shapes = FlowMoneyShapes,
        content = content,
    )
}
