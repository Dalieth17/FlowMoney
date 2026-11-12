package com.flowmoney.domain.model

import java.util.Locale

/** Conversión entre lo que escribe el usuario y céntimos. */
object Money {
    /** Mismo tope que la web (DECIMAL(12,2)): 9 999 999 999.99. */
    const val MAX_CENTS = 999_999_999_999L

    // Hasta 10 dígitos enteros y como mucho 2 decimales, con "," o "." como separador.
    private val AMOUNT = Regex("""^(\d{1,10})(?:[.,](\d{1,2}))?$""")

    /**
     * "12,50" → 1250, "12.5" → 1250, "7" → 700. Devuelve null si el texto no es un monto válido
     * (letras, negativos, separadores de miles o más de 2 decimales: no se redondea a escondidas).
     */
    fun parseToCents(input: String): Long? {
        val match = AMOUNT.matchEntire(input.trim()) ?: return null
        val (units, decimals) = match.destructured
        return units.toLong() * 100 + decimals.padEnd(2, '0').toLong()
    }

    /** 1250 → "12.50" (para precargar un formulario de edición). */
    fun toInput(cents: Long): String = String.format(Locale.ROOT, "%d.%02d", cents / 100, cents % 100)
}
