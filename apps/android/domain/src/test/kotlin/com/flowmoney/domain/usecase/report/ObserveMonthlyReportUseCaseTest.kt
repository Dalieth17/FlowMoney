package com.flowmoney.domain.usecase.report

import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.MonthSummary
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.domain.testing.FakeCategoryRepository
import com.flowmoney.domain.testing.FakeTransactionRepository
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.YearMonth

class ObserveMonthlyReportUseCaseTest {
    private val november = YearMonth.of(2026, 11)

    private val food = Category(id = 1, name = "Alimentación", icon = "restaurant", color = "#C25A44", isDefault = true)
    private val transport = Category(id = 2, name = "Transporte", icon = "directions_bus", color = "#3E78A8", isDefault = true)
    private val salary = Category(id = 3, name = "Salario", icon = "work", color = "#1F4D3A", isDefault = true)

    private val categories = FakeCategoryRepository(listOf(food, transport, salary))
    private val transactions = FakeTransactionRepository(categories)
    private val observe = ObserveMonthlyReportUseCase(transactions, categories)

    private suspend fun add(cents: Long, category: Category, date: LocalDate, type: TransactionType = TransactionType.EXPENSE) {
        transactions.insert(Transaction(amountCents = cents, description = "x", date = date, type = type, categoryId = category.id))
    }

    @Test
    fun `arma el reporte del mes con resumen categorias semanas e historial`() = runTest {
        add(420_000, salary, LocalDate.of(2026, 11, 1), TransactionType.INCOME)
        add(30_000, food, LocalDate.of(2026, 11, 3))
        add(15_000, food, LocalDate.of(2026, 11, 3)) // mismo dia y tipo: se suma en un solo total
        add(15_000, transport, LocalDate.of(2026, 11, 20))
        add(80_000, food, LocalDate.of(2026, 10, 10))
        add(300_000, salary, LocalDate.of(2026, 10, 1), TransactionType.INCOME)
        add(99_999, food, LocalDate.of(2026, 5, 31)) // anterior al historial de 6 meses
        add(99_999, food, LocalDate.of(2026, 12, 1)) // mes siguiente

        val report = observe(november).first()

        assertEquals(november, report.month)
        assertEquals(MonthSummary(420_000, 60_000), report.summary)
        assertEquals(MonthSummary(300_000, 80_000), report.previousSummary)
        assertEquals(86, report.savingsRatePercent)
        assertEquals(-25, report.expenseChangePercent)

        // Los ingresos no entran en el reparto por categoria.
        assertEquals(listOf(food, transport), report.expensesByCategory.map { it.category })
        assertEquals(listOf(45_000L, 15_000L), report.expensesByCategory.map { it.amountCents })
        assertEquals(listOf(75, 25), report.expensesByCategory.map { it.percent })

        assertEquals(listOf(45_000L, 0L, 15_000L, 0L, 0L), report.weeks.map { it.expenseCents })
        assertEquals(420_000L, report.weeks.first().incomeCents)
        assertEquals(listOf(0L, 0L, 0L, 0L, 80_000L, 60_000L), report.months.map { it.expenseCents })
    }

    @Test
    fun `se actualiza al registrar un movimiento`() = runTest {
        assertTrue(observe(november).first().isEmpty)

        add(2_500, transport, LocalDate.of(2026, 11, 12))

        val report = observe(november).first()
        assertEquals(2_500L, report.summary.expenseCents)
        assertEquals(transport, report.expensesByCategory.single().category)
    }

    @Test
    fun `cada mes tiene su propio reporte`() = runTest {
        add(1_000, food, LocalDate.of(2026, 10, 15))

        assertTrue(observe(november).first().isEmpty)
        assertEquals(1_000L, observe(november).first().previousSummary.expenseCents)
        assertEquals(1_000L, observe(YearMonth.of(2026, 10)).first().summary.expenseCents)
    }
}
