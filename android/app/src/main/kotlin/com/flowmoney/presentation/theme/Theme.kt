package com.flowmoney.presentation.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

private val LightColors = lightColorScheme(
    primary = Pine,
    onPrimary = Color(0xFFF3F7F2),
    primaryContainer = Color(0xFFCFE3D6),
    onPrimaryContainer = PineDeep,
    secondary = Brass,
    onSecondary = Color(0xFF2A1E07),
    secondaryContainer = Color(0xFFF3E3C7),
    onSecondaryContainer = Color(0xFF3B2A0C),
    tertiary = Sage,
    onTertiary = Color.White,
    error = Clay,
    onError = Color.White,
    errorContainer = Color(0xFFF6DAD3),
    onErrorContainer = Color(0xFF5A1D10),
    background = Paper,
    onBackground = Ink,
    surface = Paper,
    onSurface = Ink,
    surfaceVariant = PaperDeep,
    onSurfaceVariant = InkSoft,
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = CardSurface,
    surfaceContainer = Color(0xFFEEF2EB),
    surfaceContainerHigh = PaperDeep,
    surfaceContainerHighest = Color(0xFFE1E7DD),
    outline = Color(0xFF75867C),
    outlineVariant = Line,
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF9FC9B2),
    onPrimary = Color(0xFF0C2A1E),
    primaryContainer = PineDeep,
    onPrimaryContainer = Color(0xFFCFE3D6),
    secondary = Color(0xFFE2B877),
    onSecondary = Color(0xFF3B2A0C),
    secondaryContainer = Color(0xFF5A4118),
    onSecondaryContainer = Color(0xFFF3E3C7),
    tertiary = Color(0xFFA9C7B8),
    onTertiary = Color(0xFF14261D),
    error = Color(0xFFF0A08C),
    onError = Color(0xFF5A1D10),
    errorContainer = Color(0xFF7A2E1E),
    onErrorContainer = Color(0xFFF6DAD3),
    background = Color(0xFF0F1713),
    onBackground = Color(0xFFE3EAE5),
    surface = Color(0xFF0F1713),
    onSurface = Color(0xFFE3EAE5),
    surfaceVariant = Color(0xFF26322C),
    onSurfaceVariant = Color(0xFFB6C4BB),
    surfaceContainerLowest = Color(0xFF0A110E),
    surfaceContainerLow = Color(0xFF151F1A),
    surfaceContainer = Color(0xFF1A2520),
    surfaceContainerHigh = Color(0xFF222E28),
    surfaceContainerHighest = Color(0xFF2B3832),
    outline = Color(0xFF7F8F86),
    outlineVariant = Color(0xFF33413A),
)

private val FlowMoneyShapes = Shapes(
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(20.dp),
)

/**
 * Tema de marca. No usa colores dinámicos del sistema (Material You) a propósito:
 * la identidad pino/latón/arcilla también comunica significado (ingreso, saldo, gasto).
 */
@Composable
fun FlowMoneyTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = FlowMoneyTypography,
        shapes = FlowMoneyShapes,
        content = content,
    )
}
