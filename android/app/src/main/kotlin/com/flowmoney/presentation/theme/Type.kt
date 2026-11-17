package com.flowmoney.presentation.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em

// Una sola familia sans (la del sistema), como Inter en la web: los títulos se distinguen por
// tamaño, peso medio y un tracking más cerrado, no por cambiar de tipografía.
private val Base = Typography()

private fun TextStyle.display(tracking: Double) = copy(fontWeight = FontWeight.Medium, letterSpacing = tracking.em)

val FlowMoneyTypography = Base.copy(
    displayLarge = Base.displayLarge.display(-0.022),
    displayMedium = Base.displayMedium.display(-0.022),
    displaySmall = Base.displaySmall.display(-0.02),
    headlineLarge = Base.headlineLarge.display(-0.02),
    headlineMedium = Base.headlineMedium.display(-0.016),
    headlineSmall = Base.headlineSmall.display(-0.012),
    titleLarge = Base.titleLarge.display(-0.01),
)
