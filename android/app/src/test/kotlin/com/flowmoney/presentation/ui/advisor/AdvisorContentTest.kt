package com.flowmoney.presentation.ui.advisor

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.flowmoney.domain.advisor.AdvisorInput
import com.flowmoney.domain.advisor.AdvisorQuestions
import com.flowmoney.domain.advisor.AdvisorReport
import com.flowmoney.domain.advisor.FinancialAdvisor
import com.flowmoney.domain.advisor.Severity
import com.flowmoney.domain.model.DefaultCategories
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.presentation.format.DateFormat
import com.flowmoney.presentation.format.MoneyFormatter
import com.flowmoney.presentation.theme.FlowMoneyTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.time.LocalDate

// Igual que en Reportes: assertExists comprueba que el nodo se compuso con el texto exacto, sin
// depender de la ventana de test; los textos con cifras se arman con el mismo redactor.
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34], qualifiers = "w411dp-h891dp")
class AdvisorContentTest {
    @get:Rule
    val composeRule = createComposeRule()

    private val writer = AdvisorWriter(money = MoneyFormatter.Default::format, monthName = { DateFormat.monthName(it) })
    private val categories = DefaultCategories.all.mapIndexed { index, category -> category.copy(id = index + 1L) }
    private val today = LocalDate.of(2026, 11, 20)

    private fun report(vararg transactions: Transaction): AdvisorReport =
        FinancialAdvisor.analyze(AdvisorInput(today, categories, transactions.toList(), emptyList()))

    private val overspent by lazy {
        val salary = categories.first { it.name == "Salario" }.id
        val fun_ = categories.first { it.name == "Entretenimiento" }.id
        report(
            Transaction(1, 100_000, "Sueldo", today.withDayOfMonth(1), TransactionType.INCOME, salary),
            Transaction(2, 150_000, "Viaje", today.withDayOfMonth(3), TransactionType.EXPENSE, fun_),
        )
    }

    @Test
    fun `una tarjeta de consejo muestra titulo cuerpo datos pasos y urgencia`() {
        val text = AdviceText(
            title = "Este mes gastas más de lo que ganas",
            body = listOf("Te faltan 500."),
            bullets = listOf("Entretenimiento: 1500"),
            actions = listOf("Congela los gastos no esenciales."),
        )
        composeRule.setContent { FlowMoneyTheme { AdviceCard(text, Severity.CRITICAL) } }

        composeRule.onNodeWithText("Urgente").assertExists()
        composeRule.onNodeWithText("Este mes gastas más de lo que ganas").assertExists()
        composeRule.onNodeWithText("Te faltan 500.").assertExists()
        composeRule.onNodeWithText("•  Entretenimiento: 1500").assertExists()
        composeRule.onNodeWithText("Congela los gastos no esenciales.").assertExists()
    }

    @Test
    fun `el analisis muestra la nota de salud financiera`() {
        val report = overspent
        composeRule.setContent { FlowMoneyTheme { AdvisorOverview(report, writer) } }

        composeRule.onNodeWithContentDescription("${report.score.score} de 100").assertExists()
        composeRule.onNodeWithText(writer.grade(report.score.grade)).assertExists()
        composeRule.onNodeWithText(writer.verdict(report.score.grade)).assertExists()
    }

    @Test
    fun `sin movimientos invita a registrar`() {
        composeRule.setContent { FlowMoneyTheme { AdvisorOverview(report(), writer) } }
        composeRule.onNodeWithText("Aún no hay nada que analizar").assertExists()
    }

    @Test
    fun `una pregunta sugerida se envia al tocarla`() {
        val events = mutableListOf<AdvisorEvent>()
        composeRule.setContent {
            FlowMoneyTheme { AdvisorChat(AdvisorUiState(report = overspent), writer, onEvent = { events += it }) }
        }
        composeRule.onNodeWithText("¿Cómo voy este mes?").performClick()
        assertEquals(listOf<AdvisorEvent>(AdvisorEvent.SuggestionClicked("¿Cómo voy este mes?")), events)
    }

    @Test
    fun `el boton enviar manda la pregunta escrita`() {
        val events = mutableListOf<AdvisorEvent>()
        composeRule.setContent {
            FlowMoneyTheme {
                AdvisorChat(AdvisorUiState(report = overspent, question = "¿Cómo ahorro más?"), writer, onEvent = { events += it })
            }
        }
        composeRule.onNodeWithContentDescription("Enviar pregunta").performClick()
        assertEquals(listOf<AdvisorEvent>(AdvisorEvent.AskClicked), events)
    }

    @Test
    fun `la conversacion muestra la pregunta y la respuesta redactada`() {
        val question = "¿Cuánto me queda para gastar?"
        val answer = AdvisorQuestions.answer(question, overspent)
        composeRule.setContent {
            FlowMoneyTheme {
                AdvisorChat(
                    AdvisorUiState(report = overspent, conversation = listOf(ChatEntry(1, question, answer))),
                    writer,
                    onEvent = {},
                )
            }
        }
        composeRule.onNodeWithText(question).assertExists()
        composeRule.onNodeWithText(writer.answer(answer).title).assertExists()
    }
}
