package com.flowmoney.util

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ColorExtTest {
    @Test
    fun `convierte hex RRGGBB a color opaco`() {
        assertEquals(Color(0xFFC25A44), "#C25A44".toColorOrNull())
        assertEquals(Color(0xFFC25A44), "#c25a44".toColorOrNull())
    }

    @Test
    fun `rechaza formatos invalidos`() {
        assertNull("C25A44".toColorOrNull())
        assertNull("#C25A4".toColorOrNull())
        assertNull("#ZZZZZZ".toColorOrNull())
    }

    @Test
    fun `elige el color de contenido con mas contraste`() {
        assertEquals(Color.White, Color(0xFF1F4D3A).readableContentColor()) // pino oscuro
        assertEquals(Color.White, Color(0xFFC25A44).readableContentColor()) // arcilla
        assertEquals(Color(0xFF16231E), Color(0xFFD9A648).readableContentColor()) // ámbar claro
    }
}
