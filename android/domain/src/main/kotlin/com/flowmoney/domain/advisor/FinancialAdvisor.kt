package com.flowmoney.domain.advisor

import com.flowmoney.domain.model.BudgetLevel
import com.flowmoney.domain.model.BudgetStatus
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.MonthSummary
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionType
import java.time.LocalDate
import java.time.YearMonth
import kotlin.math.ceil
import kotlin.math.roundToInt
import kotlin.math.roundToLong

/**
 * Asesor financiero local: analiza el mes en curso frente a los anteriores y produce un
 * [AdvisorReport] con nota de salud, proyección de cierre, reparto 50/30/20, gastos recurrentes
 * y recomendaciones priorizadas con cifras concretas. Determinista y sin red: los datos no salen
 * del teléfono y cada consejo se puede explicar y probar.
 *
 * Las reglas siguen pautas de finanzas personales ampliamente aceptadas: ahorrar al menos el 20 %
 * de los ingresos, que los gustos no pasen del 30 %, y un fondo de emergencia de 3 a 6 meses de gastos.
 */
object FinancialAdvisor {
    /** Meses anteriores que se promedian para comparar. */
    const val HISTORY_MONTHS = 3

    const val TARGET_SAVINGS_PERCENT = 20
    const val LOW_SAVINGS_PERCENT = 10
    const val WANTS_LIMIT_PERCENT = 30
    const val EMERGENCY_MONTHS = 3
    const val EMERGENCY_IDEAL_MONTHS = 6

    /** Antes de este día del mes el ritmo de gasto todavía no es representativo. */
    const val MIN_DAYS_FOR_PACE = 5

    private const val SPIKE_RATIO = 1.3
    private const val SPIKE_MIN_CENTS = 2_000L
    private const val SPIKE_MIN_SHARE = 0.05
    private const val SMALL_EXPENSE_MIN_CENTS = 1_500L
    private const val SMALL_EXPENSE_SHARE = 0.01
    private const val SMALL_EXPENSES_MIN_COUNT = 8
    private const val SMALL_EXPENSES_MIN_SHARE = 0.03
    private const val BUDGET_SUGGESTION_SHARE = 0.10
    private const val BUDGET_SUGGESTION_FACTOR = 0.9
    /** Paso mínimo de redondeo de un límite sugerido: 10 unidades de la moneda. */
    private const val BUDGET_ROUNDING_CENTS = 1_000L
    /** Se conservan 3 cifras significativas: el paso crece mientras el cociente llegue a 1000. */
    private const val ROUNDING_MAX_QUOTIENT = 1_000L
    private const val MAX_BUDGET_SUGGESTIONS = 2
    private const val SPENDING_DOWN_RATIO = 0.9
    private const val RECURRING_TOLERANCE = 0.1
    private const val MAX_RECURRING = 8
    private const val MIN_RECURRING_TEXT = 3
    private const val DAYS_PER_YEAR = 365

    fun analyze(input: AdvisorInput): AdvisorReport {
        val today = input.today
        val month = YearMonth.from(today)
        val categoriesById = input.categories.associateBy { it.id }
        // Solo cuenta lo que pertenece a categorías existentes y no está en el futuro.
        val transactions = input.transactions.filter { it.categoryId in categoriesById && !it.date.isAfter(today) }
        val byMonth = transactions.groupBy { YearMonth.from(it.date) }

        val current = byMonth[month].orEmpty()
        val summary = MonthSummary.of(current)
        val previousMonths = (1..HISTORY_MONTHS).map { month.minusMonths(it.toLong()) }.filter { byMonth[it].orEmpty().isNotEmpty() }
        val previous = previousMonths.flatMap { byMonth.getValue(it) }
        val historyMonths = previousMonths.size
        val averageIncome = averageOf(previous, TransactionType.INCOME, historyMonths)
        val averageExpense = averageOf(previous, TransactionType.EXPENSE, historyMonths)

        val budgetStatuses = input.budgets
            .filter { it.month == month }
            .mapNotNull { budget ->
                categoriesById[budget.categoryId]?.let { BudgetStatus(it, budget.limitCents, expenseOf(current, it.id)) }
            }
        val budgetByCategory = budgetStatuses.associateBy { it.category.id }

        val trends = input.categories.mapNotNull { category ->
            val currentCents = expenseOf(current, category.id)
            val averageCents = if (historyMonths > 0) expenseOf(previous, category.id) / historyMonths else 0L
            if (currentCents == 0L && averageCents == 0L) {
                null
            } else {
                CategoryTrend(category, SpendingKinds.of(category), currentCents, averageCents, budgetByCategory[category.id])
            }
        }.sortedByDescending { it.currentCents }

        val projection = project(today, summary, averageIncome, averageExpense, historyMonths)
        val split = SpendingSplit(
            incomeCents = summary.incomeCents,
            needsCents = trends.filter { it.kind == SpendingKind.NEEDS }.sumOf { it.currentCents },
            wantsCents = trends.filter { it.kind == SpendingKind.WANTS }.sumOf { it.currentCents },
            savingsCategoryCents = trends.filter { it.kind == SpendingKind.SAVINGS }.sumOf { it.currentCents },
        )
        val recurring = findRecurring(transactions, month, categoriesById)

        val context = Context(
            today = today,
            summary = summary,
            averageIncome = averageIncome,
            averageExpense = averageExpense,
            historyMonths = historyMonths,
            projection = projection,
            split = split,
            trends = trends,
            budgets = budgetStatuses,
            recurring = recurring,
            current = current,
        )
        val insights = buildInsights(context).sortedBy { it.severity }

        return AdvisorReport(
            today = today,
            month = month,
            categories = input.categories,
            summary = summary,
            averageIncomeCents = averageIncome,
            averageExpenseCents = averageExpense,
            historyMonths = historyMonths,
            projection = projection,
            split = split,
            trends = trends,
            budgets = budgetStatuses,
            recurring = recurring,
            insights = insights,
            score = score(context),
        )
    }

    /** Lo que el análisis necesita a mano para decidir cada recomendación. */
    private class Context(
        val today: LocalDate,
        val summary: MonthSummary,
        val averageIncome: Long,
        val averageExpense: Long,
        val historyMonths: Int,
        val projection: MonthProjection?,
        val split: SpendingSplit,
        val trends: List<CategoryTrend>,
        val budgets: List<BudgetStatus>,
        val recurring: List<RecurringExpense>,
        val current: List<Transaction>,
    ) {
        /** Gasto de referencia de un mes: el promedio, o lo de este mes si no hay historial. */
        val monthlyExpense: Long get() = if (averageExpense > 0) averageExpense else summary.expenseCents

        /** Ingreso y gasto con los que se juzga el mes: la proyección si la hay, si no lo registrado. */
        val expectedIncome: Long get() = projection?.expectedIncomeCents ?: summary.incomeCents
        val expectedExpense: Long get() = projection?.projectedExpenseCents ?: summary.expenseCents
        val expectedBalance: Long get() = expectedIncome - expectedExpense

        val savingsRate: Int? get() = if (expectedIncome > 0) ((expectedBalance * 100.0) / expectedIncome).toInt() else null
    }

    private fun buildInsights(c: Context): List<Insight> = buildList {
        val summary = c.summary

        // 1. Lo grave primero: gastar más de lo que entra.
        if (summary.incomeCents > 0 && summary.expenseCents > summary.incomeCents) {
            add(Insight.Overspending(summary.incomeCents, summary.expenseCents))
        } else if (summary.incomeCents == 0L && summary.expenseCents > 0 && c.averageIncome > 0) {
            add(Insight.IncomeNotRecorded(summary.expenseCents, c.averageIncome))
        }

        // 2. Proyección: si a este ritmo el mes cierra en rojo, cuánto recortar por día.
        val projection = c.projection
        if (projection != null && projection.projectedBalanceCents < 0 && none { it is Insight.Overspending }) {
            val daysLeft = projection.daysLeft.coerceAtLeast(1)
            add(Insight.ProjectedDeficit(projection, ceilDiv(-projection.projectedBalanceCents, daysLeft.toLong())))
        }

        // 3. Presupuestos pasados o en riesgo.
        for (status in c.budgets) {
            if (status.level == BudgetLevel.OVER_LIMIT) add(Insight.BudgetExceeded(status)) else budgetRisk(status, c)?.let(::add)
        }

        // 4. Categorías que se dispararon frente a su promedio.
        if (c.historyMonths > 0) {
            val minExtra = maxOf(SPIKE_MIN_CENTS, (c.averageExpense * SPIKE_MIN_SHARE).toLong())
            c.trends
                .filter { it.kind != SpendingKind.SAVINGS && it.averageCents > 0 }
                .filter { it.currentCents >= it.averageCents * SPIKE_RATIO && it.currentCents - it.averageCents >= minExtra }
                .filter { trend -> none { it is Insight.BudgetExceeded && it.status.category.id == trend.category.id } }
                .take(2)
                .forEach { add(Insight.CategorySpike(it, percentChange(it.currentCents, it.averageCents))) }
        }

        // 5. Ahorro frente a la meta del 20 %.
        val rate = c.savingsRate
        if (rate != null && c.expectedBalance >= 0) {
            if (rate >= TARGET_SAVINGS_PERCENT) {
                add(Insight.GoodSavings(rate))
            } else {
                val gap = c.expectedIncome * TARGET_SAVINGS_PERCENT / 100 - c.expectedBalance
                add(Insight.LowSavings(rate, gap.coerceAtLeast(0)))
            }
        }

        // 6. Gustos por encima del 30 % de los ingresos.
        val wantsPercent = c.split.percentOfIncome(c.split.wantsCents)
        if (wantsPercent != null && wantsPercent > WANTS_LIMIT_PERCENT) {
            val excess = c.split.wantsCents - c.split.incomeCents * WANTS_LIMIT_PERCENT / 100
            add(Insight.WantsTooHigh(wantsPercent, excess, c.trends.filter { it.kind == SpendingKind.WANTS && it.currentCents > 0 }.take(3)))
        }

        // 7. Gastos hormiga.
        smallExpenses(c)?.let(::add)

        // 8. Suscripciones (gustos que se cobran solos cada mes): las que no se usan son ahorro fácil.
        val subscriptions = c.recurring.filter { it.isSubscription }
        if (subscriptions.isNotEmpty()) add(Insight.Subscriptions(subscriptions))

        // 9. Categorías importantes sin presupuesto.
        if (c.monthlyExpense > 0) {
            val budgeted = c.budgets.map { it.category.id }.toSet()
            c.trends
                .filter { it.category.id !in budgeted && it.kind != SpendingKind.SAVINGS }
                // Con historial, el límite se basa en lo habitual (no en un mes que se disparó).
                .map { it to if (it.averageCents > 0) it.averageCents else it.currentCents }
                .filter { (_, reference) -> reference >= c.monthlyExpense * BUDGET_SUGGESTION_SHARE }
                .sortedByDescending { (_, reference) -> reference }
                .take(MAX_BUDGET_SUGGESTIONS)
                .forEach { (trend, reference) -> add(Insight.SuggestBudget(trend, roundUp((reference * BUDGET_SUGGESTION_FACTOR).roundToLong()))) }
        }

        // 10. Buenas noticias: gasto a la baja y presupuestos en control.
        if (c.historyMonths > 0 && c.averageExpense > 0 && c.expectedExpense <= c.averageExpense * SPENDING_DOWN_RATIO) {
            add(Insight.SpendingDown(c.averageExpense, c.expectedExpense, -percentChange(c.expectedExpense, c.averageExpense)))
        }
        if (c.budgets.isNotEmpty() && c.budgets.all { it.level == BudgetLevel.ON_TRACK } && none { it is Insight.BudgetAtRisk }) {
            add(Insight.BudgetsOnTrack(c.budgets.size))
        }

        // 11. Fondo de emergencia: la base de cualquier plan.
        if (c.monthlyExpense > 0) {
            val monthlySaving = (if (c.historyMonths > 0) c.averageIncome - c.averageExpense else c.expectedBalance).coerceAtLeast(0)
            val target = c.monthlyExpense * EMERGENCY_MONTHS
            val months = if (monthlySaving > 0) ceilDiv(target, monthlySaving).toInt() else null
            add(Insight.EmergencyFund(target, c.monthlyExpense * EMERGENCY_IDEAL_MONTHS, monthlySaving, months))
        }
    }

    private fun budgetRisk(status: BudgetStatus, c: Context): Insight.BudgetAtRisk? {
        val projection = c.projection ?: return null
        val elapsed = projection.daysElapsed
        val projected = if (elapsed >= MIN_DAYS_FOR_PACE) status.spentCents * projection.daysInMonth / elapsed else status.spentCents
        val atRisk = status.level == BudgetLevel.NEAR_LIMIT || projected > status.limitCents
        if (!atRisk) return null
        val daysLeft = projection.daysLeft.coerceAtLeast(1)
        val allowance = (status.remainingCents / daysLeft).coerceAtLeast(0)
        return Insight.BudgetAtRisk(status, projected, allowance, daysLeft)
    }

    private fun smallExpenses(c: Context): Insight.SmallExpenses? {
        val expense = c.summary.expenseCents
        if (expense <= 0) return null
        val threshold = maxOf(SMALL_EXPENSE_MIN_CENTS, (maxOf(c.monthlyExpense, expense) * SMALL_EXPENSE_SHARE).toLong())
        val small = c.current.filter { it.type == TransactionType.EXPENSE && it.amountCents <= threshold }
        val total = small.sumOf { it.amountCents }
        if (small.size < SMALL_EXPENSES_MIN_COUNT || total < expense * SMALL_EXPENSES_MIN_SHARE) return null
        val elapsed = c.projection?.daysElapsed ?: c.today.dayOfMonth
        val yearly = total * DAYS_PER_YEAR / elapsed.coerceAtLeast(1)
        val topCategoryId = small.groupBy { it.categoryId }.maxByOrNull { (_, items) -> items.sumOf { it.amountCents } }?.key
        val topCategory = c.trends.firstOrNull { it.category.id == topCategoryId }?.category
        return Insight.SmallExpenses(small.size, total, yearly, topCategory)
    }

    private fun project(
        today: LocalDate,
        summary: MonthSummary,
        averageIncome: Long,
        averageExpense: Long,
        historyMonths: Int,
    ): MonthProjection? {
        val daysInMonth = today.lengthOfMonth()
        val elapsed = today.dayOfMonth
        if (historyMonths == 0 && elapsed < MIN_DAYS_FOR_PACE) return null
        if (summary.incomeCents == 0L && summary.expenseCents == 0L && historyMonths == 0) return null

        val pace = summary.expenseCents * daysInMonth / elapsed
        val projected = when {
            elapsed >= daysInMonth -> summary.expenseCents
            historyMonths == 0 -> pace
            elapsed < MIN_DAYS_FOR_PACE -> maxOf(summary.expenseCents, averageExpense)
            // Mezcla el ritmo del mes con lo habitual: un gasto grande a inicio de mes (alquiler)
            // no se multiplica como si se repitiera cada día.
            else -> maxOf(summary.expenseCents, (pace + averageExpense) / 2)
        }
        return MonthProjection(
            daysElapsed = elapsed,
            daysInMonth = daysInMonth,
            expectedIncomeCents = maxOf(summary.incomeCents, averageIncome),
            projectedExpenseCents = projected,
        )
    }

    /**
     * Pagos que aparecen en al menos 2 de los últimos 3 meses con la misma descripción y casi el
     * mismo importe (±10 %): suscripciones, cuotas, alquiler, servicios. Un gasto que varía mucho
     * (el mercado) no es un pago fijo.
     */
    private fun findRecurring(
        transactions: List<Transaction>,
        month: YearMonth,
        categoriesById: Map<Long, Category>,
    ): List<RecurringExpense> {
        val window = (0L..2L).map { month.minusMonths(it) }.toSet()
        return transactions
            .filter { it.type == TransactionType.EXPENSE && YearMonth.from(it.date) in window }
            .groupBy { TextNormalizer.normalize(it.description) }
            .filterKeys { it.length >= MIN_RECURRING_TEXT }
            .mapNotNull { (_, items) ->
                val months = items.map { YearMonth.from(it.date) }.toSet()
                if (months.size < 2 || items.size > months.size * 2) return@mapNotNull null
                val amounts = items.map { it.amountCents }.sorted()
                val median = amounts[amounts.size / 2]
                val similar = amounts.all { kotlin.math.abs(it - median) <= median * RECURRING_TOLERANCE }
                if (!similar) return@mapNotNull null
                val latest = items.maxWith(compareBy<Transaction> { it.date }.thenBy { it.id })
                RecurringExpense(latest.description, categoriesById.getValue(latest.categoryId), median, months.size)
            }
            .sortedByDescending { it.monthlyCents }
            .take(MAX_RECURRING)
    }

    private fun score(c: Context): HealthScore {
        val savings = run {
            val rate = c.savingsRate ?: return@run 0
            ((rate.coerceIn(0, TARGET_SAVINGS_PERCENT) / TARGET_SAVINGS_PERCENT.toDouble()) * 30).roundToInt()
        }
        val budgets = if (c.budgets.isEmpty()) {
            13
        } else {
            val points = c.budgets.sumOf { status ->
                when (status.level) {
                    BudgetLevel.ON_TRACK -> 1.0
                    BudgetLevel.NEAR_LIMIT -> 0.5
                    BudgetLevel.OVER_LIMIT -> 0.0
                }
            }
            (points / c.budgets.size * 25).roundToInt()
        }
        val trend = if (c.historyMonths == 0 || c.averageExpense == 0L) {
            10
        } else {
            val ratio = c.expectedExpense.toDouble() / c.averageExpense
            (((1.3 - ratio) / 0.3).coerceIn(0.0, 1.0) * 20).roundToInt()
        }
        val balance = run {
            val base = if (c.split.incomeCents > 0) c.split.incomeCents else c.summary.expenseCents
            if (base <= 0) return@run 8
            val wantsShare = c.split.wantsCents * 100.0 / base
            (((50.0 - wantsShare) / 20.0).coerceIn(0.0, 1.0) * 15).roundToInt()
        }
        val cushion = if (c.expectedBalance >= 0 && c.expectedIncome > 0) 10 else 0

        val parts = listOf(
            ScorePart(ScorePart.Kind.SAVINGS, savings, 30),
            ScorePart(ScorePart.Kind.BUDGETS, budgets, 25),
            ScorePart(ScorePart.Kind.TREND, trend, 20),
            ScorePart(ScorePart.Kind.BALANCE, balance, 15),
            ScorePart(ScorePart.Kind.CUSHION, cushion, 10),
        )
        val total = parts.sumOf { it.points }.coerceIn(0, 100)
        val grade = when {
            total >= 80 -> HealthScore.Grade.EXCELLENT
            total >= 60 -> HealthScore.Grade.GOOD
            total >= 40 -> HealthScore.Grade.FAIR
            else -> HealthScore.Grade.NEEDS_ATTENTION
        }
        return HealthScore(total, grade, parts)
    }

    private fun averageOf(items: List<Transaction>, type: TransactionType, months: Int): Long =
        if (months == 0) 0L else items.filter { it.type == type }.sumOf { it.amountCents } / months

    private fun expenseOf(items: List<Transaction>, categoryId: Long): Long =
        items.filter { it.type == TransactionType.EXPENSE && it.categoryId == categoryId }.sumOf { it.amountCents }

    /** Cambio porcentual de [value] frente a [base] (positivo si subió). */
    internal fun percentChange(value: Long, base: Long): Int = if (base <= 0) 0 else (((value - base) * 100.0) / base).roundToInt()

    /** Redondea hacia arriba a un número cómodo (múltiplo de 10 unidades) para sugerir límites. */
    /**
     * Redondea hacia arriba a un número "fácil de recordar" conservando 3 cifras significativas
     * (mínimo de a 10): 1 072 → 1 080 y, en pesos, 653 478 → 654 000. Así sirve para COP y USD.
     */
    internal fun roundUp(cents: Long): Long {
        var step = BUDGET_ROUNDING_CENTS
        while (cents / step >= ROUNDING_MAX_QUOTIENT) step *= 10
        return ceilDiv(cents, step) * step
    }

    private fun ceilDiv(a: Long, b: Long): Long = if (b <= 0) 0 else ceil(a.toDouble() / b).toLong()
}
