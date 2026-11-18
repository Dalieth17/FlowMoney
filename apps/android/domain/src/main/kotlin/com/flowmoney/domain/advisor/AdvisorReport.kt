package com.flowmoney.domain.advisor

import com.flowmoney.domain.model.Budget
import com.flowmoney.domain.model.BudgetStatus
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.MonthSummary
import com.flowmoney.domain.model.Transaction
import java.time.LocalDate
import java.time.YearMonth

/** Datos que analiza el asesor: el historial reciente hasta [today] y los presupuestos del mes. */
data class AdvisorInput(
    val today: LocalDate,
    val categories: List<Category>,
    val transactions: List<Transaction>,
    val budgets: List<Budget>,
)

/** Qué tan urgente es una recomendación. El orden de la enumeración es el de la pantalla. */
enum class Severity { CRITICAL, WARNING, TIP, POSITIVE }

/** Nota global de salud financiera (0–100) y de qué se compone. */
data class HealthScore(val score: Int, val grade: Grade, val parts: List<ScorePart>) {
    enum class Grade { EXCELLENT, GOOD, FAIR, NEEDS_ATTENTION }
}

data class ScorePart(val kind: Kind, val points: Int, val max: Int) {
    enum class Kind { SAVINGS, BUDGETS, TREND, BALANCE, CUSHION }
}

/**
 * Cierre estimado del mes.
 * @property expectedIncomeCents lo ya cobrado o, si es mayor, el ingreso habitual (el sueldo puede no haber llegado).
 * @property projectedExpenseCents mezcla del ritmo de gasto del mes y de lo que sueles gastar.
 */
data class MonthProjection(
    val daysElapsed: Int,
    val daysInMonth: Int,
    val expectedIncomeCents: Long,
    val projectedExpenseCents: Long,
) {
    val daysLeft: Int get() = daysInMonth - daysElapsed
    val projectedBalanceCents: Long get() = expectedIncomeCents - projectedExpenseCents
}

/** Reparto 50/30/20 de los gastos del mes (el ahorro es lo que queda del ingreso). */
data class SpendingSplit(
    val incomeCents: Long,
    val needsCents: Long,
    val wantsCents: Long,
    val savingsCategoryCents: Long,
) {
    /** Ahorro real: lo que queda sin gastar más lo destinado a categorías de ahorro. */
    val savedCents: Long get() = (incomeCents - needsCents - wantsCents).coerceAtLeast(0)

    fun percentOfIncome(cents: Long): Int? = if (incomeCents > 0) ((cents * 100.0) / incomeCents).toInt() else null
}

/**
 * Gasto que se repite cada mes con casi el mismo importe. Si es un gusto ([SpendingKind.WANTS]) se
 * trata como suscripción (se puede cancelar); si es una necesidad, como pago fijo (alquiler, servicios).
 */
data class RecurringExpense(
    val description: String,
    val category: Category,
    val monthlyCents: Long,
    val monthsSeen: Int,
    val kind: SpendingKind = SpendingKinds.of(category),
) {
    val isSubscription: Boolean get() = kind == SpendingKind.WANTS

    val yearlyCents: Long get() = monthlyCents * 12
}

/** Gasto de una categoría este mes frente a su promedio de los meses anteriores. */
data class CategoryTrend(
    val category: Category,
    val kind: SpendingKind,
    val currentCents: Long,
    val averageCents: Long,
    val budget: BudgetStatus?,
)

/**
 * Todo lo que sabe el asesor de un mes. Lo usan la pantalla de recomendaciones y las respuestas
 * a preguntas, así ambas dicen siempre las mismas cifras.
 *
 * @property historyMonths meses anteriores con movimientos que se usaron para los promedios.
 */
data class AdvisorReport(
    val today: LocalDate,
    val month: YearMonth,
    val categories: List<Category>,
    val summary: MonthSummary,
    val averageIncomeCents: Long,
    val averageExpenseCents: Long,
    val historyMonths: Int,
    val projection: MonthProjection?,
    val split: SpendingSplit,
    val trends: List<CategoryTrend>,
    val budgets: List<BudgetStatus>,
    val recurring: List<RecurringExpense>,
    val insights: List<Insight>,
    val score: HealthScore,
) {
    /** Sin ningún movimiento no hay nada que analizar. */
    val hasData: Boolean get() = summary.incomeCents > 0 || summary.expenseCents > 0 || historyMonths > 0

    /** Porcentaje de los ingresos que no se gastó (negativo si se gastó de más); null sin ingresos. */
    val savingsRatePercent: Int?
        get() = if (summary.incomeCents > 0) ((summary.balanceCents * 100.0) / summary.incomeCents).toInt() else null
}
