package com.flowmoney.domain.advisor

import com.flowmoney.domain.model.Budget
import com.flowmoney.domain.model.MonthSummary
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class FinancialAdvisorTest {
    private val data = AdvisorTestData()
    private fun day(d: Int): LocalDate = data.november.atDay(d)

    private inline fun <reified T : Insight> AdvisorReport.insight(): T? = insights.filterIsInstance<T>().firstOrNull()

    /** Noviembre sano sobre un historial estable: ingreso 4000, gastos 2000 al día 20. */
    private fun healthyNovember() {
        data.steadyHistory()
        data.income(400_000, day(1))
        data.expense(60_000, day(5), data.food, "Mercado")
        data.expense(120_000, day(2), data.home, "Alquiler")
        data.expense(20_000, day(10), data.transport, "Pasajes")
    }

    @Test
    fun `un mes sano saca nota excelente y felicita el ahorro`() {
        healthyNovember()
        val report = data.report()

        assertEquals(MonthSummary(400_000, 200_000), report.summary)
        assertEquals(3, report.historyMonths)
        assertEquals(250_000L, report.averageExpenseCents)
        // Ritmo: 2000 en 20 días → 3000 al mes; mezclado con el promedio (2500) → 2750.
        assertEquals(275_000L, report.projection!!.projectedExpenseCents)
        assertEquals(125_000L, report.projection!!.projectedBalanceCents)
        assertEquals(31, report.insight<Insight.GoodSavings>()!!.ratePercent)
        assertTrue(report.insights.none { it.severity == Severity.CRITICAL })
        assertTrue("nota ${report.score.score}", report.score.score >= 80)
        assertEquals(HealthScore.Grade.EXCELLENT, report.score.grade)
    }

    @Test
    fun `las recomendaciones van de la mas urgente a las buenas noticias`() {
        healthyNovember()
        data.expense(200_000, day(15), data.food, "Fiesta")
        val severities = data.report().insights.map { it.severity }
        assertEquals(severities.sorted(), severities)
    }

    @Test
    fun `gastar mas de lo que entra es lo primero que avisa`() {
        data.income(100_000, day(1))
        data.expense(120_000, day(3), data.food)
        val report = data.report()

        val overspending = report.insights.first() as Insight.Overspending
        assertEquals(20_000L, overspending.deficitCents)
        assertNull("no repite el aviso como proyección", report.insight<Insight.ProjectedDeficit>())
        assertEquals(0, report.score.parts.first { it.kind == ScorePart.Kind.CUSHION }.points)
    }

    @Test
    fun `proyecta el cierre en rojo y dice cuanto recortar por dia`() {
        data.income(100_000, day(1))
        data.expense(80_000, day(15), data.food)
        val deficit = data.report().insight<Insight.ProjectedDeficit>()!!

        // 800 en 20 días → 1200 al mes; faltan 200 en 10 días → 20 por día.
        assertEquals(120_000L, deficit.projection.projectedExpenseCents)
        assertEquals(2_000L, deficit.dailyCutCents)
    }

    @Test
    fun `detecta una categoria que se disparo frente a su promedio`() {
        data.steadyHistory()
        data.income(400_000, day(1))
        data.expense(200_000, day(8), data.food)
        val spike = data.report().insight<Insight.CategorySpike>()!!
        assertEquals(data.food, spike.trend.category)
        assertEquals(100, spike.increasePercent)
        assertEquals(100_000L, spike.extraCents)
    }

    @Test
    fun `presupuesto pasado y presupuesto en riesgo con monto diario`() {
        data.steadyHistory()
        data.income(400_000, day(1))
        data.expense(55_000, day(4), data.food)
        data.expense(15_000, day(6), data.transport)
        data.budgets += Budget(data.food.id, data.november, 50_000)
        data.budgets += Budget(data.transport.id, data.november, 20_000)
        val report = data.report()

        assertEquals(data.food, report.insight<Insight.BudgetExceeded>()!!.status.category)
        val risk = report.insight<Insight.BudgetAtRisk>()!!
        assertEquals(data.transport, risk.status.category)
        // Va al 75 %, pero a este ritmo cerraría en 225 (> 200): quedan 50 para 10 días.
        assertEquals(22_500L, risk.projectedCents)
        assertEquals(500L, risk.dailyAllowanceCents)
        assertNull(report.insight<Insight.BudgetsOnTrack>())
    }

    @Test
    fun `felicita cuando todos los presupuestos van bien`() {
        healthyNovember()
        data.budgets += Budget(data.home.id, data.november, 200_000)
        assertEquals(1, data.report().insight<Insight.BudgetsOnTrack>()!!.count)
    }

    @Test
    fun `suma los gastos hormiga y los proyecta a un anio`() {
        data.income(300_000, day(1))
        data.expense(100_000, day(2), data.home, "Alquiler")
        repeat(10) { data.expense(800, day(3 + it), data.food, "Café") }
        val small = data.report().insight<Insight.SmallExpenses>()!!

        assertEquals(10, small.count)
        assertEquals(8_000L, small.totalCents)
        assertEquals(8_000L * 365 / 20, small.yearlyCents)
        assertEquals(data.food, small.topCategory)
    }

    @Test
    fun `encuentra suscripciones que se repiten cada mes`() {
        for (month in 9..11) data.expense(3_990, LocalDate.of(2026, month, 15), data.fun_, "Netflix")
        data.expense(5_000, day(2), data.fun_, "Cine") // una sola vez: no es recurrente
        data.income(300_000, day(1))
        val subscriptions = data.report().insight<Insight.Subscriptions>()!!

        val netflix = subscriptions.items.single()
        assertEquals("Netflix", netflix.description)
        assertEquals(3_990L, netflix.monthlyCents)
        assertEquals(3, netflix.monthsSeen)
        assertEquals(3_990L * 12, subscriptions.yearlyCents)
    }

    @Test
    fun `no confunde gastos de importe muy distinto con una suscripcion`() {
        data.expense(3_000, LocalDate.of(2026, 10, 5), data.food, "Restaurante")
        data.expense(15_000, day(5), data.food, "Restaurante")
        data.income(300_000, day(1))
        assertNull(data.report().insight<Insight.Subscriptions>())
    }

    @Test
    fun `avisa si los gustos pasan del 30 por ciento`() {
        data.income(100_000, day(1))
        data.expense(40_000, day(5), data.fun_)
        val wants = data.report().insight<Insight.WantsTooHigh>()!!
        assertEquals(40, wants.wantsPercent)
        assertEquals(10_000L, wants.excessCents)
        assertEquals(data.fun_, wants.topWants.single().category)
    }

    @Test
    fun `sugiere presupuesto para categorias grandes sin limite`() {
        data.steadyHistory()
        data.income(400_000, day(1))
        val suggestions = data.report().insights.filterIsInstance<Insight.SuggestBudget>()
        // Hogar (1200 de promedio) primero; límite sugerido: 90 % redondeado a 10 → 1080.
        assertEquals(listOf(data.home, data.food), suggestions.map { it.trend.category })
        assertEquals(108_000L, suggestions.first().suggestedLimitCents)
    }

    @Test
    fun `calcula el fondo de emergencia y en cuantos meses llegar`() {
        healthyNovember()
        val fund = data.report().insight<Insight.EmergencyFund>()!!
        assertEquals(750_000L, fund.targetCents) // 3 meses de 2500
        assertEquals(1_500_000L, fund.idealCents) // 6 meses
        assertEquals(150_000L, fund.monthlySavingCents) // 4000 − 2500 de promedio
        assertEquals(5, fund.monthsToTarget)
    }

    @Test
    fun `avisa si hay gastos pero aun no registraste el ingreso del mes`() {
        data.steadyHistory()
        data.expense(10_000, day(3), data.food)
        val report = data.report()
        assertEquals(400_000L, report.insight<Insight.IncomeNotRecorded>()!!.usualIncomeCents)
        assertNull(report.insight<Insight.Overspending>())
    }

    @Test
    fun `sin movimientos no hay nada que analizar`() {
        val report = data.report()
        assertFalse(report.hasData)
        assertTrue(report.insights.isEmpty())
        assertNull(report.projection)
        assertNull(report.savingsRatePercent)
    }

    @Test
    fun `al inicio del mes y sin historial no proyecta`() {
        data.income(100_000, LocalDate.of(2026, 11, 1))
        data.expense(5_000, LocalDate.of(2026, 11, 2), data.food)
        assertNull(data.report(LocalDate.of(2026, 11, 3)).projection)
    }

    @Test
    fun `ignora movimientos futuros y de categorias borradas`() {
        data.income(100_000, day(1))
        data.expense(50_000, day(25), data.food) // después de hoy
        data.transactions += com.flowmoney.domain.model.Transaction(
            999, 70_000, "Huérfano", day(5), com.flowmoney.domain.model.TransactionType.EXPENSE, 12_345,
        )
        assertEquals(0L, data.report().summary.expenseCents)
    }

    @Test
    fun `la nota siempre queda entre 0 y 100`() {
        data.income(10_000, day(1))
        data.expense(900_000, day(2), data.fun_)
        data.budgets += Budget(data.fun_.id, data.november, 1_000)
        val score = data.report().score
        assertTrue(score.score in 0..100)
        assertEquals(HealthScore.Grade.NEEDS_ATTENTION, score.grade)
        assertNotNull(score.parts.firstOrNull { it.kind == ScorePart.Kind.SAVINGS })
    }

    @Test
    fun `los limites sugeridos se redondean a cifras faciles en dolares y en pesos`() {
        assertEquals(108_000L, FinancialAdvisor.roundUp(107_200))
        assertEquals(65_400_000L, FinancialAdvisor.roundUp(65_347_800))
        assertEquals(1_000L, FinancialAdvisor.roundUp(1))
        assertEquals(500_000_000L, FinancialAdvisor.roundUp(500_000_000))
    }
}
