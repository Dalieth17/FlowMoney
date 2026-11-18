package com.flowmoney.domain.model

import java.time.LocalDate
import java.time.YearMonth

/** Parte del gasto del mes que corresponde a una categoría. Los [percent] de una lista suman 100. */
data class CategoryShare(
    val category: Category,
    val amountCents: Long,
    val percent: Int,
)

/** Ingresos y gastos de una semana del mes (ver [ReportRules.weekNumber]). */
data class WeekFlow(
    val number: Int,
    val from: LocalDate,
    val to: LocalDate,
    val incomeCents: Long = 0,
    val expenseCents: Long = 0,
)

/** Ingresos y gastos de un mes completo. */
data class MonthFlow(
    val month: YearMonth,
    val incomeCents: Long = 0,
    val expenseCents: Long = 0,
)

/**
 * Reporte de un mes: resumen, gasto por categoría y evolución por semana y por mes.
 *
 * @property previousSummary totales del mes anterior, para comparar.
 * @property expensesByCategory categorías con gasto en el mes, de mayor a menor.
 * @property weeks todas las semanas del mes, en orden (también las que no tienen movimientos).
 * @property months los últimos [ReportRules.HISTORY_MONTHS] meses, del más antiguo al del reporte.
 */
data class MonthlyReport(
    val month: YearMonth,
    val summary: MonthSummary = MonthSummary(),
    val previousSummary: MonthSummary = MonthSummary(),
    val expensesByCategory: List<CategoryShare> = emptyList(),
    val weeks: List<WeekFlow> = emptyList(),
    val months: List<MonthFlow> = emptyList(),
) {
    /** true si el mes no tiene ningún movimiento (los montos son siempre positivos). */
    val isEmpty: Boolean get() = summary.incomeCents == 0L && summary.expenseCents == 0L

    /**
     * Tasa de ahorro: qué porcentaje de los ingresos no se gastó. Es negativa si se gastó más de
     * lo que entró y null si no hubo ingresos (no hay base para calcularla).
     */
    val savingsRatePercent: Int?
        get() = if (summary.incomeCents > 0) Percentages.ratio(summary.balanceCents, summary.incomeCents) else null

    /**
     * Cambio del gasto frente al mes anterior, en porcentaje: positivo si se gastó más, negativo
     * si se gastó menos. null si el mes anterior no tuvo gastos (no hay con qué comparar).
     */
    val expenseChangePercent: Int?
        get() {
            val before = previousSummary.expenseCents
            return if (before > 0) Percentages.ratio(summary.expenseCents - before, before) else null
        }
}
