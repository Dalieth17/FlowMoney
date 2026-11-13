package com.flowmoney.presentation.ui.advisor

import com.flowmoney.domain.advisor.AdvisorAnswer
import com.flowmoney.domain.model.DefaultCategories
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.domain.testing.FakeBudgetRepository
import com.flowmoney.domain.testing.FakeCategoryRepository
import com.flowmoney.domain.testing.FakeTransactionRepository
import com.flowmoney.domain.usecase.advisor.AskAdvisorUseCase
import com.flowmoney.domain.usecase.advisor.ObserveAdvisorReportUseCase
import com.flowmoney.testing.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
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
class AdvisorViewModelTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val clock = Clock.fixed(Instant.parse("2026-11-20T15:00:00Z"), ZoneOffset.UTC)
    private val defaults = DefaultCategories.all.mapIndexed { index, category -> category.copy(id = index + 1L) }
    private val food = defaults.first { it.name == "Alimentación" }
    private val salary = defaults.first { it.name == "Salario" }

    private val categories = FakeCategoryRepository(defaults)
    private val transactions = FakeTransactionRepository(
        categories,
        listOf(
            Transaction(1, 400_000, "Sueldo", LocalDate.of(2026, 11, 1), TransactionType.INCOME, salary.id),
            Transaction(2, 60_000, "Mercado", LocalDate.of(2026, 11, 5), TransactionType.EXPENSE, food.id),
            Transaction(3, 80_000, "Mercado", LocalDate.of(2026, 10, 5), TransactionType.EXPENSE, food.id),
        ),
    )
    private val budgets = FakeBudgetRepository()

    private lateinit var viewModel: AdvisorViewModel

    @Before
    fun setUp() {
        viewModel = AdvisorViewModel(ObserveAdvisorReportUseCase(transactions, categories, budgets), AskAdvisorUseCase(), clock)
    }

    private fun TestScope.subscribe() {
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect {} }
    }

    private val state get() = viewModel.uiState.value

    @Test
    fun `carga el analisis del mes actual`() = runTest {
        subscribe()
        val report = state.report!!
        assertEquals(YearMonth.of(2026, 11), report.month)
        assertEquals(60_000L, report.summary.expenseCents)
        assertTrue(report.score.score in 0..100)
        assertEquals(AdvisorTab.OVERVIEW, state.tab)
    }

    @Test
    fun `preguntar responde con cifras y abre la pestana de preguntas`() = runTest {
        subscribe()
        viewModel.onEvent(AdvisorEvent.QuestionChanged("¿Cuánto gasté en comida?"))
        assertTrue(state.canAsk)
        viewModel.onEvent(AdvisorEvent.AskClicked)

        val entry = state.conversation.single()
        assertEquals("¿Cuánto gasté en comida?", entry.question)
        val answer = entry.answer as AdvisorAnswer.CategorySpending
        assertEquals(food, answer.category)
        assertEquals(60_000L, answer.trend!!.currentCents)
        assertEquals("", state.question)
        assertEquals(AdvisorTab.ASK, state.tab)
    }

    @Test
    fun `una pregunta sugerida se responde directo`() = runTest {
        subscribe()
        viewModel.onEvent(AdvisorEvent.SuggestionClicked("¿Cómo voy este mes?"))
        assertTrue(state.conversation.single().answer is AdvisorAnswer.Overview)
    }

    @Test
    fun `no envia preguntas vacias`() = runTest {
        subscribe()
        viewModel.onEvent(AdvisorEvent.QuestionChanged("   "))
        viewModel.onEvent(AdvisorEvent.AskClicked)
        assertTrue(state.conversation.isEmpty())
    }

    @Test
    fun `la conversacion muestra lo mas reciente primero y se puede borrar`() = runTest {
        subscribe()
        viewModel.onEvent(AdvisorEvent.SuggestionClicked("¿Cómo voy este mes?"))
        viewModel.onEvent(AdvisorEvent.SuggestionClicked("¿Cuánto puedo gastar por día?"))
        assertEquals(listOf("¿Cuánto puedo gastar por día?", "¿Cómo voy este mes?"), state.conversation.map { it.question })

        viewModel.onEvent(AdvisorEvent.ClearConversation)
        assertTrue(state.conversation.isEmpty())
    }

    @Test
    fun `cambiar de pestana`() = runTest {
        subscribe()
        viewModel.onEvent(AdvisorEvent.TabSelected(AdvisorTab.ASK))
        assertEquals(AdvisorTab.ASK, state.tab)
    }

    @Test
    fun `el analisis se actualiza al registrar movimientos`() = runTest {
        subscribe()
        transactions.insert(Transaction(amountCents = 10_000, description = "Cena", date = LocalDate.of(2026, 11, 18), type = TransactionType.EXPENSE, categoryId = food.id))
        assertEquals(70_000L, state.report!!.summary.expenseCents)
    }
}
