package com.flowmoney.presentation.ui.budgets

import com.flowmoney.domain.model.Budget
import com.flowmoney.domain.model.BudgetError
import com.flowmoney.domain.model.BudgetLevel
import com.flowmoney.domain.model.DefaultCategories
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.domain.testing.FakeBudgetRepository
import com.flowmoney.domain.testing.FakeCategoryRepository
import com.flowmoney.domain.testing.FakeTransactionRepository
import com.flowmoney.domain.usecase.budget.CopyBudgetsUseCase
import com.flowmoney.domain.usecase.budget.DeleteBudgetUseCase
import com.flowmoney.domain.usecase.budget.ObserveBudgetOverviewUseCase
import com.flowmoney.domain.usecase.budget.SaveBudgetUseCase
import com.flowmoney.testing.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
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
class BudgetsViewModelTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val clock = Clock.fixed(Instant.parse("2026-11-12T15:00:00Z"), ZoneOffset.UTC)
    private val november = YearMonth.of(2026, 11)
    private val october = YearMonth.of(2026, 10)

    private val defaults = DefaultCategories.all.mapIndexed { index, category -> category.copy(id = index + 1L) }
    private val food = defaults.first { it.name == "Alimentación" }
    private val transport = defaults.first { it.name == "Transporte" }

    private val categories = FakeCategoryRepository(defaults)
    private val transactions = FakeTransactionRepository(
        categories,
        listOf(
            Transaction(1, 8_500, "Mercado", LocalDate.of(2026, 11, 3), TransactionType.EXPENSE, food.id),
            Transaction(2, 1_200, "Bus", LocalDate.of(2026, 11, 4), TransactionType.EXPENSE, transport.id),
        ),
    )
    private val budgets = FakeBudgetRepository(listOf(Budget(food.id, november, 10_000)))

    // Se crea en @Before: viewModelScope necesita el Dispatchers.Main de test ya instalado.
    private lateinit var viewModel: BudgetsViewModel

    @Before
    fun setUp() {
        viewModel = BudgetsViewModel(
            ObserveBudgetOverviewUseCase(budgets, categories, transactions),
            SaveBudgetUseCase(budgets, categories),
            DeleteBudgetUseCase(budgets),
            CopyBudgetsUseCase(budgets),
            clock,
        )
    }

    private fun TestScope.subscribe(): MutableList<BudgetsMessage> {
        val messages = mutableListOf<BudgetsMessage>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect {} }
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.messages.toList(messages) }
        return messages
    }

    private val state get() = viewModel.uiState.value

    @Test
    fun `abre en el mes actual con el estado de cada presupuesto`() = runTest {
        subscribe()
        assertFalse(state.isLoading)
        assertEquals(november, state.month)

        val status = state.overview.budgets.single()
        assertEquals(food, status.category)
        assertEquals(8_500L, status.spentCents)
        assertEquals(BudgetLevel.NEAR_LIMIT, status.level)
        // Transporte tiene gasto y no tiene limite: encabeza la lista "Sin presupuesto".
        assertEquals(transport, state.overview.unbudgeted.first().category)
    }

    @Test
    fun `definir un limite nuevo lo guarda en centimos y avisa`() = runTest {
        val messages = subscribe()
        val spending = state.overview.unbudgeted.first()

        viewModel.onEvent(BudgetsEvent.AddClicked(spending))
        assertTrue(state.editor!!.isNew)
        assertEquals(1_200L, state.editor!!.spentCents)

        viewModel.onEvent(BudgetsEvent.AmountChanged("150,5"))
        viewModel.onEvent(BudgetsEvent.SaveClicked)

        assertNull(state.editor)
        assertEquals(15_050L, budgets.get(transport.id, november)?.limitCents)
        assertEquals(listOf(food, transport), state.overview.budgets.map { it.category })
        assertEquals(listOf<BudgetsMessage>(BudgetsMessage.Saved("Transporte")), messages)
    }

    @Test
    fun `un monto invalido deja el editor abierto y el error se borra al corregir`() = runTest {
        val messages = subscribe()
        viewModel.onEvent(BudgetsEvent.AddClicked(state.overview.unbudgeted.first()))
        viewModel.onEvent(BudgetsEvent.AmountChanged("0"))
        viewModel.onEvent(BudgetsEvent.SaveClicked)

        val editor = state.editor
        assertNotNull(editor)
        assertEquals(BudgetError.AmountTooSmall, editor!!.error)
        assertFalse(editor.isSaving)
        assertTrue(messages.isEmpty())

        viewModel.onEvent(BudgetsEvent.AmountChanged("10"))
        assertNull(state.editor!!.error)
    }

    @Test
    fun `editar precarga el limite y lo reemplaza`() = runTest {
        subscribe()
        viewModel.onEvent(BudgetsEvent.EditClicked(state.overview.budgets.single()))
        assertEquals("100", state.editor!!.amountText)
        assertFalse(state.editor!!.isNew)

        viewModel.onEvent(BudgetsEvent.AmountChanged("200"))
        viewModel.onEvent(BudgetsEvent.SaveClicked)

        assertEquals(20_000L, budgets.get(food.id, november)?.limitCents)
        assertEquals(BudgetLevel.ON_TRACK, state.overview.budgets.single().level)
    }

    @Test
    fun `quitar el limite avisa con deshacer y deshacer lo restaura`() = runTest {
        val messages = subscribe()
        viewModel.onEvent(BudgetsEvent.EditClicked(state.overview.budgets.single()))
        viewModel.onEvent(BudgetsEvent.DeleteClicked)

        assertNull(state.editor)
        assertTrue(state.overview.budgets.isEmpty())
        val deleted = messages.single() as BudgetsMessage.Deleted
        assertEquals("Alimentación", deleted.categoryName)

        viewModel.onEvent(BudgetsEvent.UndoDelete(deleted.budget))
        assertEquals(10_000L, state.overview.budgets.single().limitCents)
    }

    @Test
    fun `copiar repite los limites del ultimo mes con presupuestos`() = runTest {
        budgets.upsert(Budget(food.id, october, 9_000))
        budgets.upsert(Budget(transport.id, october, 4_000))
        val messages = subscribe()

        assertEquals(october, state.overview.copySource)
        assertEquals(1, state.overview.copyableCount)

        viewModel.onEvent(BudgetsEvent.CopyClicked)

        assertEquals(listOf<BudgetsMessage>(BudgetsMessage.Copied(1)), messages)
        assertEquals(4_000L, budgets.get(transport.id, november)?.limitCents)
        assertEquals(10_000L, budgets.get(food.id, november)?.limitCents) // el de noviembre no se pisa
        assertNull(state.overview.copySource)
    }

    @Test
    fun `cambiar de mes muestra los presupuestos de ese mes`() = runTest {
        subscribe()
        viewModel.onEvent(BudgetsEvent.PreviousMonth)
        assertEquals(october, state.month)
        assertTrue(state.overview.budgets.isEmpty())

        viewModel.onEvent(BudgetsEvent.NextMonth)
        assertEquals(november, state.month)
        assertEquals(1, state.overview.budgets.size)
    }

    @Test
    fun `el editor guarda en el mes que se estaba viendo`() = runTest {
        subscribe()
        viewModel.onEvent(BudgetsEvent.NextMonth)
        viewModel.onEvent(BudgetsEvent.AddClicked(state.overview.unbudgeted.first()))
        viewModel.onEvent(BudgetsEvent.AmountChanged("50"))
        viewModel.onEvent(BudgetsEvent.SaveClicked)

        assertEquals(1, budgets.current.count { it.month == november.plusMonths(1) })
    }
}
