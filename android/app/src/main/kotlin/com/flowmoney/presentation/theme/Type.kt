package com.flowmoney.presentation.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.font.FontFamily

// Títulos con serif (como Fraunces en la web) y texto de interfaz con la sans del sistema.
// Pendiente: empaquetar Fraunces y Hanken Grotesk como fuentes de la app.
private val Display = FontFamily.Serif

private val Base = Typography()

val FlowMoneyTypography = Base.copy(
    displayLarge = Base.displayLarge.copy(fontFamily = Display),
    displayMedium = Base.displayMedium.copy(fontFamily = Display),
    displaySmall = Base.displaySmall.copy(fontFamily = Display),
    headlineLarge = Base.headlineLarge.copy(fontFamily = Display),
    headlineMedium = Base.headlineMedium.copy(fontFamily = Display),
    headlineSmall = Base.headlineSmall.copy(fontFamily = Display),
)
