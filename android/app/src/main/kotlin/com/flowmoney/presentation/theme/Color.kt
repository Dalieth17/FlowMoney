package com.flowmoney.presentation.theme

import androidx.compose.ui.graphics.Color

// Mismos tokens que la web (frontend/public/assets/css/tokens.css), en sus dos temas.

/** "Verde y negro": lienzo casi negro, superficies apenas más claras y un solo acento verde. */
internal object GreenTokens {
    val Canvas = Color(0xFF08090A)
    val Carbon = Color(0xFF0F1011)
    val Obsidian = Color(0xFF161718)
    val Slate = Color(0xFF1C1D20)
    val Graphite = Color(0xFF23252A)
    val Smoke = Color(0xFF383B3F)
    val Fog = Color(0xFF8A8F98)
    val Mist = Color(0xFFD0D6E0)
    val Paper = Color(0xFFFFFFFF)
    val Accent = Color(0xFF2FDC8A)
    val AccentDeep = Color(0xFF1F9E63)
    val AccentContainer = Color(0xFF103626)
    val Alert = Color(0xFFEB5757)
}

/** "Blanco y negro": lienzo blanco y solo tinta negra (con grises para la jerarquía). */
internal object MonoTokens {
    val Canvas = Color(0xFFFFFFFF)
    val Surface = Color(0xFFF7F7F8)
    val Raised = Color(0xFFF4F4F5)
    val High = Color(0xFFEFEFF1)
    val Line = Color(0xFFE4E4E7)
    val Outline = Color(0xFFA1A1AA)
    val Muted = Color(0xFF62626A)
    val Soft = Color(0xFF3A3A40)
    val Ink = Color(0xFF0A0A0A)
    val Alert = Color(0xFFD93D3D)
}
