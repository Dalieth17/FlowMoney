package com.flowmoney.domain.model

import java.util.Locale

/** Conversión entre lo que escribe el usuario y céntimos. */
object Money {
    /** Mismo tope que la web (DECIMAL(12,2)): 9 999 999 999.99. */
    const val MAX_CENTS = 999_999_999_999L

    private const val MAX_UNIT_DIGITS = 10
    private const val GROUP_SIZE = 3
    private val SEPARATOR = Regex("[.,]")
    private val DIGITS_AND_SEPARATORS = Regex("""^[\d.,]+$""")

    /**
     * Acepta montos escritos al estilo colombiano o estadounidense:
     * "12,50" / "12.5" → 1250; "1.234.567" / "1,234,567" → 123456700; "1.234,50" / "1,234.50" → 123450.
     *
     * Reglas: un separador seguido de 1 o 2 dígitos al final es el decimal; los demás separan miles
     * (grupos de 3, todos del mismo tipo y distinto al decimal). "1.234" son mil doscientos treinta y cuatro.
     * Devuelve null ante letras, negativos, grupos mal formados o más de 2 decimales: nunca redondea a escondidas.
     */
    fun parseToCents(input: String): Long? {
        val text = input.trim()
        if (!DIGITS_AND_SEPARATORS.matches(text)) return null
        val parts = text.split(SEPARATOR)
        val separators = SEPARATOR.findAll(text).map { it.value }.toList()
        if (parts.any { it.isEmpty() }) return null

        val last = parts.last()
        val decimalSeparator = when {
            separators.isEmpty() -> null
            last.length <= 2 -> separators.last()
            last.length == GROUP_SIZE -> null
            else -> return null
        }
        val unitParts = if (decimalSeparator != null) parts.dropLast(1) else parts
        val groupSeparators = if (decimalSeparator != null) separators.dropLast(1) else separators
        if (groupSeparators.isNotEmpty()) {
            val sameKind = groupSeparators.distinct().size == 1 && groupSeparators.first() != decimalSeparator
            val first = unitParts.first()
            // "0.001" no es un número con miles: un grupo inicial no empieza con cero.
            val wellGrouped = first.length <= GROUP_SIZE && !first.startsWith('0') && unitParts.drop(1).all { it.length == GROUP_SIZE }
            if (!sameKind || !wellGrouped) return null
        }

        val units = unitParts.joinToString("")
        if (units.length > MAX_UNIT_DIGITS) return null
        val decimals = if (decimalSeparator != null) last else ""
        return units.toLong() * 100 + decimals.padEnd(2, '0').toLong()
    }

    /** 1250 → "12.50", 450000000 → "4500000" (para precargar un formulario de edición). */
    fun toInput(cents: Long): String =
        if (cents % 100 == 0L) (cents / 100).toString()
        else String.format(Locale.ROOT, "%d.%02d", cents / 100, cents % 100)
}
