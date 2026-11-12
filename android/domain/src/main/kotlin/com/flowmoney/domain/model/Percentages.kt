package com.flowmoney.domain.model

import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode

/** Porcentajes enteros para mostrar. Se calculan con enteros grandes: sin coma flotante ni desbordes. */
object Percentages {
    private const val TOTAL_PERCENT = 100
    private val HUNDRED_INT = BigInteger.valueOf(TOTAL_PERCENT.toLong())
    private val HUNDRED = BigDecimal(TOTAL_PERCENT)
    private val INT_MIN = BigDecimal(Int.MIN_VALUE)
    private val INT_MAX = BigDecimal(Int.MAX_VALUE)

    /**
     * Reparte 100 puntos entre [amounts] en proporción a cada monto. A diferencia de redondear cada
     * uno por separado, el resultado **siempre suma 100** (método del resto mayor): cada parte
     * recibe su porcentaje redondeado hacia abajo y los puntos que sobran van a los restos más
     * grandes. Si todo es cero, devuelve ceros.
     */
    fun distribute(amounts: List<Long>): List<Int> {
        require(amounts.all { it >= 0 }) { "Los montos no pueden ser negativos" }
        val total = amounts.fold(BigInteger.ZERO) { sum, amount -> sum + BigInteger.valueOf(amount) }
        if (total.signum() == 0) return List(amounts.size) { 0 }

        // Para cada monto: [porcentaje entero, resto] de monto × 100 / total.
        val parts = amounts.map { BigInteger.valueOf(it).multiply(HUNDRED_INT).divideAndRemainder(total) }
        val percents = IntArray(amounts.size) { parts[it][0].toInt() }
        val leftover = TOTAL_PERCENT - percents.sum()
        // sortedByDescending es estable: a igual resto gana el que aparece primero en la lista.
        amounts.indices.sortedByDescending { parts[it][1] }.take(leftover).forEach { percents[it]++ }
        return percents.toList()
    }

    /** [value] como porcentaje de [total], redondeado al entero más cercano (puede ser negativo o pasar de 100). */
    fun ratio(value: Long, total: Long): Int {
        require(total > 0) { "El total debe ser positivo" }
        return BigDecimal(value).multiply(HUNDRED)
            .divide(BigDecimal(total), 0, RoundingMode.HALF_UP)
            .max(INT_MIN).min(INT_MAX)
            .toInt()
    }
}
