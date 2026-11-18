package com.flowmoney.presentation.ui.reports

import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.domain.testing.FakeCategoryRepository
import com.flowmoney.domain.testing.FakeTransactionRepository
import com.flowmoney.domain.usecase.report.ObserveMonthlyReportUseCase
import com.flowmoney.testing.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneOffset

@OptIn(ExperimentalCoroutinesApi::class)
class ReportsViewModelTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val clock = Clock.fixed(Instant.parse("2026-11-12T15:00:00Z"), ZoneOffset.UTC)
    private val november = YearMonth.of(2026, 11)

    private val food = Category(id = 1, name = "Alimentación", icon = "restaurant", color = "#C25A44", isDefault = true)
    private val salary = Category(id = 2, name = "Salario", icon = "work", color = "#1F4D3A", isDefault = true)

    private val categories = FakeCategoryRepository(listOf(food, salary))
    private val transactions = FakeTransactionRepository(
        categories,
        listOf(
            Transaction(1, 420_000, "Sueldo", LocalDate.of(2026, 11, 1), TransactionType.INCOME, salary.id),
            Transaction(2, 30_000, "Mercado", LocalDate.of(2026, 11, 5), TransactionType.EXPENSE, food.id),
            Transaction(3, 12_000, "Octubre", LocalDate.of(2026, 10, 20), TransactionType.EXPENSE, food.id),
        ),
    )

    private lateinit var viewModel: ReportsViewModel

    @Before
    fun setUp() {
        viewModel = ReportsViewModel(ObserveMonthlyReportUseCase(transactions, categories), clock)
    }

    private fun TestScope.subscribe() {
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect {} }
    }

    private val state get() = viewModel.uiState.value

    @Test
    fun `abre en el mes actual con el reporte cargado`() = runTest {
        subscribe()
        assertFalse(state.isLoading)
        assertEquals(november, state.month)
        assertEquals(BarsGrouping.WEEKS, state.barsBy)
        assertEquals(420_000L, state.report!!.summary.incomeCents)
        assertEquals(30_000L, state.report!!.summary.expenseCents)
        assertEquals(food, state.report!!.expensesByCategory.single().category)
    }

    @Test
    fun `cambiar de mes recalcula el reporte`() = runTest {
        subscribe()
        viewModel.onEvent(ReportsEvent.PreviousMonth)
        assertEquals(YearMonth.of(2026, 10), state.month)
        assertEquals(12_000L, state.report!!.summary.expenseCents)
        // El mes del estado sale del propio reporte: nunca muestra un mes con datos de otro.
        assertEquals(state.month, state.report!!.month)

        viewModel.onEvent(ReportsEvent.NextMonth)
        viewModel.onEvent(ReportsEvent.NextMonth)
        assertEquals(YearMonth.of(2026, 12), state.month)
        assertTrue(state.report!!.isEmpty)
    }

    @Test
    fun `la agrupacion de las barras se mantiene al cambiar de mes`() = runTest {
        subscribe()
        viewModel.onEvent(ReportsEvent.BarsGroupingChanged(BarsGrouping.MONTHS))
        assertEquals(BarsGrouping.MONTHS, state.barsBy)

        viewModel.onEvent(ReportsEvent.PreviousMonth)
        assertEquals(BarsGrouping.MONTHS, state.barsBy)
        // El reporte sigue trayendo sus 6 meses y 5 semanas aunque solo se muestre uno.
        assertEquals(6, state.report!!.months.size)
    }
}
