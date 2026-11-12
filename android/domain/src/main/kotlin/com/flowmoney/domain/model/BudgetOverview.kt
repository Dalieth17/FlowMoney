package com.flowmoney.domain.model

import java.time.YearMonth

/** Gasto del mes en una categoría que no tiene presupuesto. */
data class CategorySpending(val category: Category, val spentCents: Long)

/**
 * Todo lo que muestra la pantalla de presupuestos para un mes.
 *
 * @property budgets categorías con límite, en el orden habitual de las categorías.
 * @property unbudgeted el resto: primero las que tienen más gasto en el mes.
 * @property copySource último mes anterior con presupuestos que este mes todavía no tiene
 *   (null si no hay nada que copiar); [copyableCount] dice cuántos se copiarían.
 */
data class BudgetOverview(
    val budgets: List<BudgetStatus> = emptyList(),
    val unbudgeted: List<CategorySpending> = emptyList(),
    val copySource: YearMonth? = null,
    val copyableCount: Int = 0,
) {
    val limitCents: Long get() = budgets.sumOf { it.limitCents }

    val spentCents: Long get() = budgets.sumOf { it.spentCents }

    val remainingCents: Long get() = limitCents - spentCents

    /** Gasto en categorías sin presupuesto (no cuenta en [spentCents]). */
    val unbudgetedSpentCents: Long get() = unbudgeted.sumOf { it.spentCents }

    val nearLimitCount: Int get() = budgets.count { it.level == BudgetLevel.NEAR_LIMIT }

    val overLimitCount: Int get() = budgets.count { it.level == BudgetLevel.OVER_LIMIT }

    /** Estado del total; null si no hay presupuestos. */
    val level: BudgetLevel? get() = if (limitCents > 0) BudgetRules.levelOf(spentCents, limitCents) else null
}
