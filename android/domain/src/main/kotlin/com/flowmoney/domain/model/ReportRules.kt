package com.flowmoney.domain.model

import java.time.LocalDate
import java.time.YearMonth

/** Cómo se arma un reporte mensual a partir de totales ya sumados por la base de datos. */
object ReportRules {
    /** Meses que muestra el gráfico "por mes", contando el del reporte (igual que la web). */
    const val HISTORY_MONTHS = 6

    private const val DAYS_PER_WEEK = 7

    /** Primer día que necesita el reporte de [month]: el inicio de su historial. */
    fun historyStart(month: YearMonth): LocalDate = month.minusMonths(HISTORY_MONTHS - 1L).atDay(1)

    /**
     * Semana del mes a la que pertenece [date]. Las semanas son bloques de 7 días contados desde
     * el día 1 (1–7, 8–14, 15–21, 22–28 y, si el mes sigue, 29–fin), igual que en la web: así
     * todas las semanas son comparables y ninguna mezcla días de dos meses.
     */
    fun weekNumber(date: LocalDate): Int = (date.dayOfMonth - 1) / DAYS_PER_WEEK + 1

    /**
     * @param categories todas las categorías, en su orden habitual.
     * @param expenseTotals gasto de [month] por id de categoría.
     * @param dailyTotals totales por día y tipo desde [historyStart] hasta el fin de [month]
     *   (se ignora lo que quede fuera de ese rango).
     */
    fun build(
        month: YearMonth,
        categories: List<Category>,
        expenseTotals: Map<Long, Long>,
        dailyTotals: List<DailyTotal>,
    ): MonthlyReport {
        val months = monthFlows(month, dailyTotals)
        val current = months[months.lastIndex]
        val previous = months[months.lastIndex - 1]
        return MonthlyReport(
            month = month,
            summary = MonthSummary(current.incomeCents, current.expenseCents),
            previousSummary = MonthSummary(previous.incomeCents, previous.expenseCents),
            expensesByCategory = categoryShares(categories, expenseTotals),
            weeks = weekFlows(month, dailyTotals),
            months = months,
        )
    }

    private fun monthFlows(month: YearMonth, dailyTotals: List<DailyTotal>): List<MonthFlow> {
        val byMonth = dailyTotals.groupBy { YearMonth.from(it.date) }
        return (HISTORY_MONTHS - 1 downTo 0).map { monthsBack ->
            val flowMonth = month.minusMonths(monthsBack.toLong())
            val (income, expense) = sumByType(byMonth[flowMonth].orEmpty())
            MonthFlow(flowMonth, income, expense)
        }
    }

    private fun weekFlows(month: YearMonth, dailyTotals: List<DailyTotal>): List<WeekFlow> {
        val daysInMonth = month.lengthOfMonth()
        val weekCount = (daysInMonth + DAYS_PER_WEEK - 1) / DAYS_PER_WEEK
        val byWeek = dailyTotals.filter { YearMonth.from(it.date) == month }.groupBy { weekNumber(it.date) }
        return (1..weekCount).map { number ->
            val (income, expense) = sumByType(byWeek[number].orEmpty())
            WeekFlow(
                number = number,
                from = month.atDay((number - 1) * DAYS_PER_WEEK + 1),
                to = month.atDay(minOf(number * DAYS_PER_WEEK, daysInMonth)),
                incomeCents = income,
                expenseCents = expense,
            )
        }
    }

    /** (ingresos, gastos). addExact: ante un desborde es mejor fallar que mostrar un total falso. */
    private fun sumByType(totals: List<DailyTotal>): Pair<Long, Long> {
        var income = 0L
        var expense = 0L
        for (total in totals) {
            when (total.type) {
                TransactionType.INCOME -> income = Math.addExact(income, total.totalCents)
                TransactionType.EXPENSE -> expense = Math.addExact(expense, total.totalCents)
            }
        }
        return income to expense
    }

    private fun categoryShares(categories: List<Category>, expenseTotals: Map<Long, Long>): List<CategoryShare> {
        // sortedByDescending es estable: a igual gasto se conserva el orden habitual de las categorías.
        val spent = categories
            .mapNotNull { category -> expenseTotals[category.id]?.takeIf { it > 0 }?.let { category to it } }
            .sortedByDescending { (_, amount) -> amount }
        val percents = Percentages.distribute(spent.map { (_, amount) -> amount })
        return spent.mapIndexed { index, (category, amount) -> CategoryShare(category, amount, percents[index]) }
    }
}
