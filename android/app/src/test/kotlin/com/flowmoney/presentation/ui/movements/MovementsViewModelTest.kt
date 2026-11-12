package com.flowmoney.presentation.ui.movements

import com.flowmoney.domain.model.Budget
import com.flowmoney.domain.model.BudgetLevel
import com.flowmoney.domain.model.DefaultCategories
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionError
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.domain.testing.FakeBudgetRepository
import com.flowmoney.domain.testing.FakeCategoryRepository
import com.flowmoney.domain.testing.FakeTransactionRepository
import com.flowmoney.domain.usecase.budget.CheckBudgetUseCase
import com.flowmoney.domain.usecase.category.ObserveCategoriesUseCase
import com.flowmoney.domain.usecase.transaction.DeleteTransactionUseCase
import com.flowmoney.domain.usecase.transaction.ObserveTransactionsUseCase
import com.flowmoney.domain.usecase.transaction.SaveTransactionUseCase
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
class MovementsViewModelTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val today = LocalDate.of(2026, 11, 12)
    private val clock = Clock.fixed(Instant.parse("2026-11-12T15:00:00Z"), ZoneOffset.UTC)

    private val defaults = DefaultCategories.all.mapIndexed { index, category -> category.copy(id = index + 1L) }
    private val food = defaults.first { it.name == "Alimentación" }
    private val salary = defaults.first { it.name == "Salario" }

    private val categories = FakeCategoryRepository(defaults)
    private val budgets = FakeBudgetRepository()
    private val transactions = FakeTransactionRepository(
        categories,
        listOf(
            Transaction(1, 1_250, "Almuerzo", today, TransactionType.EXPENSE, food.id),
            Transaction(2, 420_000, "Sueldo", today.minusDays(11), TransactionType.INCOME, salary.id),
            Transaction(3, 800, "Cafe", today, TransactionType.EXPENSE, food.id),
            Transaction(4, 5_000, "Octubre", LocalDate.of(2026, 10, 20), TransactionType.EXPENSE, food.id),
        ),
    )

    // Se crea en @Before: viewModelScope necesita el Dispatchers.Main de test ya instalado.
    private lateinit var viewModel: MovementsViewModel

    @Before
    fun setUp() {
        viewModel = MovementsViewModel(
            ObserveTransactionsUseCase(transactions),
            ObserveCategoriesUseCase(categories),
            SaveTransactionUseCase(transactions, categories),
            DeleteTransactionUseCase(transactions),
            CheckBudgetUseCase(budgets, categories, transactions),
            clock,
        )
    }

    private fun TestScope.subscribe(): MutableList<MovementsMessage> {
        val messages = mutableListOf<MovementsMessage>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect {} }
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.messages.toList(messages) }
        return messages
    }

    private val state get() = viewModel.uiState.value

    @Test
    fun `abre en el mes actual con resumen y dias agrupados`() = runTest {
        subscribe()
        assertFalse(state.isLoading)
        assertEquals(YearMonth.of(2026, 11), state.month)
        assertEquals(today, state.today)
        assertEquals(420_000L, state.summary.incomeCents)
        assertEquals(2_050L, state.summary.expenseCents)
        assertEquals(417_950L, state.summary.balanceCents)
        assertEquals(listOf(today, today.minusDays(11)), state.days.map { it.date })
        assertEquals(listOf("Cafe", "Almuerzo"), state.days.first().items.map { it.transaction.description })
    }

    @Test
    fun `cambiar de mes recalcula la lista`() = runTest {
        subscribe()
        viewModel.onEvent(MovementsEvent.PreviousMonth)
        assertEquals(YearMonth.of(2026, 10), state.month)
        assertEquals(listOf("Octubre"), state.days.flatMap { it.items }.map { it.transaction.description })

        viewModel.onEvent(MovementsEvent.NextMonth)
        viewModel.onEvent(MovementsEvent.NextMonth)
        assertTrue(state.days.isEmpty())
        assertEquals(0L, state.summary.balanceCents)
    }

    @Test
    fun `los filtros se combinan y se pueden quitar`() = runTest {
        subscribe()
        viewModel.onEvent(MovementsEvent.TypeFilterChanged(TransactionType.INCOME))
        assertTrue(state.isFiltered)
        assertEquals(listOf("Sueldo"), state.days.flatMap { it.items }.map { it.transaction.description })

        viewModel.onEvent(MovementsEvent.CategoryFilterChanged(food.id))
        assertTrue(state.days.isEmpty())

        viewModel.onEvent(MovementsEvent.ClearFilters)
        assertFalse(state.isFiltered)
        assertEquals(3, state.days.sumOf { it.items.size })
    }

    @Test
    fun `nuevo movimiento usa hoy y los filtros activos como valores iniciales`() = runTest {
        subscribe()
        viewModel.onEvent(MovementsEvent.TypeFilterChanged(TransactionType.INCOME))
        viewModel.onEvent(MovementsEvent.CategoryFilterChanged(salary.id))
        viewModel.onEvent(MovementsEvent.AddClicked)

        val editor = state.editor!!
        assertTrue(editor.isNew)
        assertEquals(today, editor.date)
        assertEquals(TransactionType.INCOME, editor.type)
        assertEquals(salary.id, editor.categoryId)
    }

    @Test
    fun `en otro mes el formulario nuevo arranca el dia 1 de ese mes`() = runTest {
        subscribe()
        viewModel.onEvent(MovementsEvent.PreviousMonth)
        viewModel.onEvent(MovementsEvent.AddClicked)
        assertEquals(LocalDate.of(2026, 10, 1), state.editor!!.date)
        assertEquals(TransactionType.EXPENSE, state.editor!!.type)
    }

    @Test
    fun `crear un movimiento con coma decimal lo guarda en centimos y avisa`() = runTest {
        val messages = subscribe()
        viewModel.onEvent(MovementsEvent.AddClicked)
        viewModel.onEvent(MovementsEvent.AmountChanged("12,5"))
        viewModel.onEvent(MovementsEvent.DescriptionChanged("  Taxi  "))
        viewModel.onEvent(MovementsEvent.CategorySelected(food.id))
        viewModel.onEvent(MovementsEvent.SaveClicked)

        assertNull(state.editor)
        val saved = transactions.current.single { it.description == "Taxi" }
        assertEquals(1_250L, saved.amountCents)
        assertEquals(today, saved.date)
        assertEquals(listOf<MovementsMessage>(MovementsMessage.Created), messages)
    }

    @Test
    fun `un gasto que deja la categoria cerca del limite avisa con el porcentaje`() = runTest {
        // Ya hay 20.50 gastados en Alimentacion este mes; con 60.00 mas son 80.50 de 100.00.
        budgets.upsert(Budget(food.id, YearMonth.of(2026, 11), 10_000))
        val messages = subscribe()
        viewModel.onEvent(MovementsEvent.AddClicked)
        viewModel.onEvent(MovementsEvent.AmountChanged("60"))
        viewModel.onEvent(MovementsEvent.DescriptionChanged("Mercado"))
        viewModel.onEvent(MovementsEvent.CategorySelected(food.id))
        viewModel.onEvent(MovementsEvent.SaveClicked)

        val alert = messages.single() as MovementsMessage.BudgetAlert
        assertEquals(food, alert.status.category)
        assertEquals(8_050L, alert.status.spentCents)
        assertEquals(BudgetLevel.NEAR_LIMIT, alert.status.level)
    }

    @Test
    fun `los ingresos y las categorias en control no muestran aviso de presupuesto`() = runTest {
        budgets.upsert(Budget(food.id, YearMonth.of(2026, 11), 1_000_000))
        budgets.upsert(Budget(salary.id, YearMonth.of(2026, 11), 100))
        val messages = subscribe()

        viewModel.onEvent(MovementsEvent.AddClicked)
        viewModel.onEvent(MovementsEvent.AmountChanged("5"))
        viewModel.onEvent(MovementsEvent.DescriptionChanged("Pan"))
        viewModel.onEvent(MovementsEvent.CategorySelected(food.id))
        viewModel.onEvent(MovementsEvent.SaveClicked)

        viewModel.onEvent(MovementsEvent.AddClicked)
        viewModel.onEvent(MovementsEvent.TypeChanged(TransactionType.INCOME))
        viewModel.onEvent(MovementsEvent.AmountChanged("500"))
        viewModel.onEvent(MovementsEvent.DescriptionChanged("Bono"))
        viewModel.onEvent(MovementsEvent.CategorySelected(salary.id))
        viewModel.onEvent(MovementsEvent.SaveClicked)

        assertEquals(listOf<MovementsMessage>(MovementsMessage.Created, MovementsMessage.Created), messages)
    }

    @Test
    fun `guardar con fecha de otro mes navega a ese mes`() = runTest {
        subscribe()
        viewModel.onEvent(MovementsEvent.AddClicked)
        viewModel.onEvent(MovementsEvent.AmountChanged("30"))
        viewModel.onEvent(MovementsEvent.DescriptionChanged("Regalo"))
        viewModel.onEvent(MovementsEvent.CategorySelected(food.id))
        viewModel.onEvent(MovementsEvent.DateSelected(LocalDate.of(2026, 9, 3)))
        viewModel.onEvent(MovementsEvent.SaveClicked)

        assertEquals(YearMonth.of(2026, 9), state.month)
        assertEquals(listOf("Regalo"), state.days.flatMap { it.items }.map { it.transaction.description })
    }

    @Test
    fun `un monto invalido deja el editor abierto y el error se borra al corregir`() = runTest {
        val messages = subscribe()
        viewModel.onEvent(MovementsEvent.AddClicked)
        viewModel.onEvent(MovementsEvent.AmountChanged("0.001"))
        viewModel.onEvent(MovementsEvent.DescriptionChanged("Chicle"))
        viewModel.onEvent(MovementsEvent.CategorySelected(food.id))
        viewModel.onEvent(MovementsEvent.SaveClicked)

        val editor = state.editor
        assertNotNull(editor)
        assertEquals(TransactionError.InvalidAmount, editor!!.error)
        assertFalse(editor.isSaving)
        assertTrue(messages.isEmpty())

        viewModel.onEvent(MovementsEvent.AmountChanged("0.01"))
        assertNull(state.editor!!.error)
    }

    @Test
    fun `sin categoria no guarda`() = runTest {
        subscribe()
        viewModel.onEvent(MovementsEvent.AddClicked)
        viewModel.onEvent(MovementsEvent.AmountChanged("5"))
        viewModel.onEvent(MovementsEvent.DescriptionChanged("Pan"))
        viewModel.onEvent(MovementsEvent.SaveClicked)
        assertEquals(TransactionError.CategoryRequired, state.editor!!.error)
    }

    @Test
    fun `editar precarga el formulario y guarda los cambios`() = runTest {
        val messages = subscribe()
        val almuerzo = state.days.flatMap { it.items }.single { it.transaction.description == "Almuerzo" }

        viewModel.onEvent(MovementsEvent.EditClicked(almuerzo))
        assertEquals("12.50", state.editor!!.amountText)
        assertFalse(state.editor!!.isNew)

        viewModel.onEvent(MovementsEvent.AmountChanged("15"))
        viewModel.onEvent(MovementsEvent.NoteChanged("Con el equipo"))
        viewModel.onEvent(MovementsEvent.SaveClicked)

        val stored = transactions.current.single { it.id == 1L }
        assertEquals(1_500L, stored.amountCents)
        assertEquals("Con el equipo", stored.note)
        assertEquals(listOf<MovementsMessage>(MovementsMessage.Updated), messages)
    }

    @Test
    fun `eliminar pide confirmacion borra y cierra el editor`() = runTest {
        val messages = subscribe()
        val cafe = state.days.flatMap { it.items }.single { it.transaction.description == "Cafe" }

        viewModel.onEvent(MovementsEvent.EditClicked(cafe))
        viewModel.onEvent(MovementsEvent.DeleteClicked)
        assertEquals(DeleteRequest(3, "Cafe"), state.pendingDelete)
        assertEquals(3, transactions.current.count { YearMonth.from(it.date) == YearMonth.of(2026, 11) })

        viewModel.onEvent(MovementsEvent.DeleteConfirmed)
        assertNull(state.pendingDelete)
        assertNull(state.editor)
        assertTrue(transactions.current.none { it.id == 3L })
        assertEquals(listOf<MovementsMessage>(MovementsMessage.Deleted), messages)
    }

    @Test
    fun `cancelar la eliminacion conserva el movimiento`() = runTest {
        subscribe()
        val cafe = state.days.flatMap { it.items }.single { it.transaction.description == "Cafe" }
        viewModel.onEvent(MovementsEvent.EditClicked(cafe))
        viewModel.onEvent(MovementsEvent.DeleteClicked)
        viewModel.onEvent(MovementsEvent.DeleteDismissed)

        assertNull(state.pendingDelete)
        assertNotNull(state.editor)
        assertTrue(transactions.current.any { it.id == 3L })
    }
}
