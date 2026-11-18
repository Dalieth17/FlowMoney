package com.flowmoney.domain.advisor

import com.flowmoney.domain.model.BudgetStatus
import com.flowmoney.domain.model.Category

/**
 * Una recomendación del asesor, con las cifras que la justifican. Solo datos: la capa de
 * presentación redacta el texto (así el análisis se prueba sin depender del idioma).
 */
sealed interface Insight {
    val severity: Severity

    /** Este mes gastaste más de lo que ganaste. */
    data class Overspending(val incomeCents: Long, val expenseCents: Long) : Insight {
        override val severity get() = Severity.CRITICAL
        val deficitCents: Long get() = expenseCents - incomeCents
    }

    /** Hay gastos pero ningún ingreso registrado este mes (y sí en meses anteriores). */
    data class IncomeNotRecorded(val expenseCents: Long, val usualIncomeCents: Long) : Insight {
        override val severity get() = Severity.TIP
    }

    /** A este ritmo terminarás el mes gastando más de lo que entra. */
    data class ProjectedDeficit(val projection: MonthProjection, val dailyCutCents: Long) : Insight {
        override val severity get() = Severity.WARNING
    }

    /** Un presupuesto ya se pasó del límite. */
    data class BudgetExceeded(val status: BudgetStatus) : Insight {
        override val severity get() = Severity.CRITICAL
    }

    /** Un presupuesto va camino de pasarse: cuánto puedes gastar por día para no hacerlo. */
    data class BudgetAtRisk(
        val status: BudgetStatus,
        val projectedCents: Long,
        val dailyAllowanceCents: Long,
        val daysLeft: Int,
    ) : Insight {
        override val severity get() = Severity.WARNING
    }

    /** Una categoría subió mucho frente a su promedio. */
    data class CategorySpike(val trend: CategoryTrend, val increasePercent: Int) : Insight {
        override val severity get() = Severity.WARNING
        val extraCents: Long get() = trend.currentCents - trend.averageCents
    }

    /** Ahorras menos del 20 % recomendado. Es advertencia por debajo del 10 %. */
    data class LowSavings(val ratePercent: Int, val gapToTargetCents: Long) : Insight {
        override val severity get() = if (ratePercent < FinancialAdvisor.LOW_SAVINGS_PERCENT) Severity.WARNING else Severity.TIP
    }

    /** Los gustos se llevan más del 30 % de tus ingresos. */
    data class WantsTooHigh(val wantsPercent: Int, val excessCents: Long, val topWants: List<CategoryTrend>) : Insight {
        override val severity get() = Severity.TIP
    }

    /** Muchos gastos pequeños ("gastos hormiga") que juntos pesan. */
    data class SmallExpenses(val count: Int, val totalCents: Long, val yearlyCents: Long, val topCategory: Category?) : Insight {
        override val severity get() = Severity.TIP
    }

    /** Pagos que se repiten cada mes. */
    data class Subscriptions(val items: List<RecurringExpense>) : Insight {
        override val severity get() = Severity.TIP
        val monthlyCents: Long get() = items.sumOf { it.monthlyCents }
        val yearlyCents: Long get() = monthlyCents * 12
    }

    /** Una categoría con gasto importante y sin presupuesto. */
    data class SuggestBudget(val trend: CategoryTrend, val suggestedLimitCents: Long) : Insight {
        override val severity get() = Severity.TIP
    }

    /** Cuánto deberías tener guardado para imprevistos y en cuánto tiempo llegarías. */
    data class EmergencyFund(
        val targetCents: Long,
        val idealCents: Long,
        val monthlySavingCents: Long,
        val monthsToTarget: Int?,
    ) : Insight {
        override val severity get() = Severity.TIP
    }

    /** Ahorras el 20 % o más. */
    data class GoodSavings(val ratePercent: Int) : Insight {
        override val severity get() = Severity.POSITIVE
    }

    /** Vas a gastar bastante menos que tu promedio. */
    data class SpendingDown(val averageCents: Long, val projectedCents: Long, val decreasePercent: Int) : Insight {
        override val severity get() = Severity.POSITIVE
    }

    /** Todos tus presupuestos van en control. */
    data class BudgetsOnTrack(val count: Int) : Insight {
        override val severity get() = Severity.POSITIVE
    }
}
