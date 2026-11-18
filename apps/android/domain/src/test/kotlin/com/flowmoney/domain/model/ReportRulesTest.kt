package com.flowmoney.domain.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.YearMonth

class ReportRulesTest {
    private val november = YearMonth.of(2026, 11)

    private val food = Category(id = 1, name = "Alimentación", icon = "restaurant", color = "#C25A44", isDefault = true)
    private val transport = Category(id = 2, name = "Transporte", icon = "directions_bus", color = "#3E78A8", isDefault = true)
    private val health = Category(id = 3, name = "Salud", icon = "medical_services", color = "#5B9E86", isDefault = true)
    private val categories = listOf(food, transport, health)

    private fun income(date: LocalDate, cents: Long) = DailyTotal(date, TransactionType.INCOME, cents)

    private fun expense(date: LocalDate, cents: Long) = DailyTotal(date, TransactionType.EXPENSE, cents)

    private fun day(dayOfMonth: Int) = november.atDay(dayOfMonth)

    private fun report(
        month: YearMonth = november,
        expenseTotals: Map<Long, Long> = emptyMap(),
        dailyTotals: List<DailyTotal> = emptyList(),
    ) = ReportRules.build(month, categories, expenseTotals, dailyTotals)

    @Test
    fun `las semanas son bloques de 7 dias y la ultima termina con el mes`() {
        val weeks = report().weeks
        assertEquals(listOf(1, 2, 3, 4, 5), weeks.map { it.number })
        assertEquals(listOf(1, 8, 15, 22, 29), weeks.map { it.from.dayOfMonth })
        assertEquals(listOf(7, 14, 21, 28, 30), weeks.map { it.to.dayOfMonth })

        // Febrero de 28 dias tiene exactamente 4 semanas; diciembre cierra la quinta el dia 31.
        assertEquals(4, report(YearMonth.of(2026, 2)).weeks.size)
        assertEquals(31, report(YearMonth.of(2026, 12)).weeks.last().to.dayOfMonth)
        assertEquals(29, report(YearMonth.of(2028, 2)).weeks.last().to.dayOfMonth) // bisiesto: 29–29
    }

    @Test
    fun `cada dia cae en su semana incluidos los bordes`() {
        val weeks = report(
            dailyTotals = listOf(
                expense(day(1), 100),
                expense(day(7), 200),
                expense(day(8), 400),
                income(day(14), 5_000),
                expense(day(28), 800),
                expense(day(29), 1_600),
                expense(day(30), 3_200),
            ),
        ).weeks

        assertEquals(listOf(300L, 400L, 0L, 800L, 4_800L), weeks.map { it.expenseCents })
        assertEquals(listOf(0L, 5_000L, 0L, 0L, 0L), weeks.map { it.incomeCents })
    }

    @Test
    fun `el historial son los ultimos 6 meses terminando en el del reporte`() {
        val report = report(
            dailyTotals = listOf(
                income(LocalDate.of(2026, 6, 1), 1_000),
                expense(LocalDate.of(2026, 6, 30), 400),
                expense(LocalDate.of(2026, 9, 15), 250),
                income(LocalDate.of(2026, 10, 31), 3_000),
                expense(LocalDate.of(2026, 10, 1), 1_000),
                income(day(1), 4_200),
                expense(day(30), 1_050),
                // Fuera del rango: no deben contarse.
                expense(LocalDate.of(2026, 5, 31), 9_999),
                expense(LocalDate.of(2026, 12, 1), 9_999),
            ),
        )

        assertEquals((6..11).map { YearMonth.of(2026, it) }, report.months.map { it.month })
        assertEquals(listOf(1_000L, 0L, 0L, 0L, 3_000L, 4_200L), report.months.map { it.incomeCents })
        assertEquals(listOf(400L, 0L, 0L, 250L, 1_000L, 1_050L), report.months.map { it.expenseCents })
        assertEquals(MonthSummary(4_200, 1_050), report.summary)
        assertEquals(MonthSummary(3_000, 1_000), report.previousSummary)
        assertEquals(LocalDate.of(2026, 6, 1), ReportRules.historyStart(november))
    }

    @Test
    fun `el historial cruza el cambio de anio`() {
        val months = report(YearMonth.of(2027, 2)).months.map { it.month }
        assertEquals(YearMonth.of(2026, 9), months.first())
        assertEquals(YearMonth.of(2027, 2), months.last())
        assertEquals(6, months.size)
    }

    @Test
    fun `gasto por categoria de mayor a menor con porcentajes que suman 100`() {
        val shares = report(expenseTotals = mapOf(food.id to 1_000L, transport.id to 1_000L, health.id to 1_000L))
            .expensesByCategory

        // A igual gasto se conserva el orden habitual de las categorias.
        assertEquals(listOf(food, transport, health), shares.map { it.category })
        assertEquals(listOf(34, 33, 33), shares.map { it.percent })
        assertEquals(100, shares.sumOf { it.percent })

        val sorted = report(expenseTotals = mapOf(food.id to 500L, health.id to 4_500L)).expensesByCategory
        assertEquals(listOf(health, food), sorted.map { it.category })
        assertEquals(listOf(4_500L, 500L), sorted.map { it.amountCents })
        assertEquals(listOf(90, 10), sorted.map { it.percent })
    }

    @Test
    fun `ignora categorias sin gasto y totales de categorias que ya no existen`() {
        val shares = report(expenseTotals = mapOf(food.id to 700L, transport.id to 0L, 99L to 5_000L)).expensesByCategory
        assertEquals(listOf(food), shares.map { it.category })
        assertEquals(100, shares.single().percent)
    }

    @Test
    fun `tasa de ahorro sobre los ingresos`() {
        fun rate(income: Long, expense: Long) =
            MonthlyReport(november, summary = MonthSummary(income, expense)).savingsRatePercent

        assertEquals(75, rate(income = 4_200, expense = 1_050))
        assertEquals(0, rate(income = 1_000, expense = 1_000))
        assertEquals(-50, rate(income = 1_000, expense = 1_500)) // gasto mas de lo que entro
        assertEquals(100, rate(income = 1_000, expense = 0))
        assertNull("sin ingresos no hay base para calcularla", rate(income = 0, expense = 500))
    }

    @Test
    fun `cambio del gasto frente al mes anterior`() {
        fun change(now: Long, before: Long) = MonthlyReport(
            month = november,
            summary = MonthSummary(0, now),
            previousSummary = MonthSummary(0, before),
        ).expenseChangePercent

        assertEquals(20, change(now = 1_200, before = 1_000))
        assertEquals(-20, change(now = 800, before = 1_000))
        assertEquals(0, change(now = 1_000, before = 1_000))
        assertEquals(-100, change(now = 0, before = 1_000))
        assertNull("sin gastos el mes anterior no hay con que comparar", change(now = 500, before = 0))
    }

    @Test
    fun `un mes sin movimientos esta vacio pero conserva semanas e historial`() {
        val empty = report()
        assertTrue(empty.isEmpty)
        assertTrue(empty.expensesByCategory.isEmpty())
        assertEquals(5, empty.weeks.size)
        assertEquals(6, empty.months.size)
        assertNull(empty.savingsRatePercent)
        assertNull(empty.expenseChangePercent)

        assertFalse(report(dailyTotals = listOf(expense(day(3), 1))).isEmpty)
    }
}
