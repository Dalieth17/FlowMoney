package com.flowmoney.domain.model

/** Qué tan cerca está el gasto del límite. Mismos umbrales que la web. */
enum class BudgetLevel {
    /** Menos del [BudgetRules.WARNING_PERCENT] %. */
    ON_TRACK,

    /** Desde el [BudgetRules.WARNING_PERCENT] % y por debajo del límite. */
    NEAR_LIMIT,

    /** El gasto llegó al límite o lo pasó. */
    OVER_LIMIT,
}

/** Presupuesto de una categoría en su mes: cuánto se gastó frente al límite. */
data class BudgetStatus(
    val category: Category,
    val limitCents: Long,
    val spentCents: Long,
) {
    /** Lo que queda por gastar; negativo si se pasó del límite. */
    val remainingCents: Long get() = limitCents - spentCents

    /** Porcentaje gastado, redondeado hacia abajo (puede pasar de 100). */
    val percent: Int get() = BudgetRules.percentOf(spentCents, limitCents)

    val level: BudgetLevel get() = BudgetRules.levelOf(spentCents, limitCents)
}
