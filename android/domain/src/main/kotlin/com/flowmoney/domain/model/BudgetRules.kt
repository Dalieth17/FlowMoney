package com.flowmoney.domain.model

/** Reglas de los presupuestos. Todo en enteros (céntimos) para evitar errores de redondeo. */
object BudgetRules {
    /** Desde este porcentaje se avisa que el gasto está cerca del límite (igual que la web). */
    const val WARNING_PERCENT = 80

    const val MIN_LIMIT_CENTS = 1L

    /** Error del límite, o null si es válido. */
    fun validate(limitCents: Long): BudgetError? = when {
        limitCents < MIN_LIMIT_CENTS -> BudgetError.AmountTooSmall
        limitCents > Money.MAX_CENTS -> BudgetError.AmountTooLarge(Money.MAX_CENTS)
        else -> null
    }

    /** Porcentaje gastado, redondeado hacia abajo: 79.99 % es 79, así coincide con [levelOf]. */
    fun percentOf(spentCents: Long, limitCents: Long): Int {
        require(limitCents > 0) { "El límite debe ser positivo" }
        return (spentCents.coerceAtLeast(0) * 100 / limitCents).coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
    }

    fun levelOf(spentCents: Long, limitCents: Long): BudgetLevel {
        require(limitCents > 0) { "El límite debe ser positivo" }
        return when {
            spentCents >= limitCents -> BudgetLevel.OVER_LIMIT
            spentCents * 100 >= limitCents * WARNING_PERCENT -> BudgetLevel.NEAR_LIMIT
            else -> BudgetLevel.ON_TRACK
        }
    }
}
