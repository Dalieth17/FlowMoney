package com.flowmoney.presentation.ui.budgets

import androidx.compose.material3.SnackbarHostState
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.flowmoney.domain.model.BudgetError
import com.flowmoney.domain.model.BudgetOverview
import com.flowmoney.domain.model.BudgetStatus
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.CategorySpending
import com.flowmoney.presentation.format.DateFormat
import com.flowmoney.presentation.format.MoneyFormatter
import com.flowmoney.presentation.theme.FlowMoneyTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.time.YearMonth

// Pantalla de teléfono real: la de Robolectric por defecto es tan baja que la lista no cabe.
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34], qualifiers = "w411dp-h891dp")
class BudgetsContentTest {
    @get:Rule
    val composeRule = createComposeRule()

    private val november = YearMonth.of(2026, 11)
    private val food = Category(id = 1, name = "Alimentación", icon = "restaurant", color = "#C25A44", isDefault = true)
    private val transport = Category(id = 2, name = "Transporte", icon = "directions_bus", color = "#3E78A8", isDefault = true)

    private fun render(overview: BudgetOverview, events: MutableList<BudgetsEvent> = mutableListOf()) {
        composeRule.setContent {
            FlowMoneyTheme {
                BudgetsContent(
                    state = BudgetsUiState(month = november, isLoading = false, overview = overview),
                    snackbarHostState = SnackbarHostState(),
                    onEvent = { events += it },
                )
            }
        }
    }

    private fun renderForm(editor: BudgetEditorState, events: MutableList<BudgetsEvent>) {
        composeRule.setContent {
            FlowMoneyTheme { BudgetEditorForm(editor = editor, onEvent = { events += it }) }
        }
    }

    @Test
    fun `cada presupuesto muestra su avance y la etiqueta de su nivel`() {
        val events = mutableListOf<BudgetsEvent>()
        val foodStatus = BudgetStatus(food, limitCents = 10_000, spentCents = 8_500)
        val transportStatus = BudgetStatus(transport, limitCents = 1_000, spentCents = 1_250)
        render(BudgetOverview(budgets = listOf(foodStatus, transportStatus)), events)

        val foodAmounts = "${MoneyFormatter.Default.format(8_500)} de ${MoneyFormatter.Default.format(10_000)}"
        composeRule.onNodeWithText(foodAmounts).assertIsDisplayed()
        composeRule.onNodeWithText("85 %").assertIsDisplayed()
        composeRule.onNodeWithText("125 %").assertIsDisplayed()
        composeRule.onNodeWithText("Cerca del límite").assertIsDisplayed()
        composeRule.onNodeWithText("Superado").assertIsDisplayed()
        composeRule.onNodeWithText("Te pasaste por ${MoneyFormatter.Default.format(250)}").assertIsDisplayed()
        composeRule.onNodeWithText("1 presupuesto superado · 1 cerca del límite").assertIsDisplayed()

        composeRule.onNodeWithText("Alimentación").performClick()
        assertEquals(listOf<BudgetsEvent>(BudgetsEvent.EditClicked(foodStatus)), events)
    }

    @Test
    fun `sin presupuestos invita a crear uno y cada categoria abre el editor`() {
        val events = mutableListOf<BudgetsEvent>()
        val transportSpending = CategorySpending(transport, 1_200)
        render(BudgetOverview(unbudgeted = listOf(transportSpending, CategorySpending(food, 0))), events)

        composeRule.onNodeWithText("Aún no tienes presupuestos este mes").assertIsDisplayed()
        composeRule.onNodeWithText("${MoneyFormatter.Default.format(1_200)} gastado este mes").assertIsDisplayed()
        composeRule.onNodeWithText("Sin gastos este mes").assertIsDisplayed()

        composeRule.onNodeWithText("Transporte").performClick()
        assertEquals(listOf<BudgetsEvent>(BudgetsEvent.AddClicked(transportSpending)), events)
    }

    @Test
    fun `ofrece copiar los limites del ultimo mes con presupuestos`() {
        val events = mutableListOf<BudgetsEvent>()
        val october = YearMonth.of(2026, 10)
        render(
            BudgetOverview(unbudgeted = listOf(CategorySpending(food, 0)), copySource = october, copyableCount = 2),
            events,
        )

        composeRule.onNodeWithText("¿Repetir los límites de ${DateFormat.monthInSentence(october)}?").assertIsDisplayed()
        composeRule.onNodeWithText("Se agregarán 2 presupuestos a este mes.").assertIsDisplayed()
        composeRule.onNodeWithText("Copiar").performClick()
        assertEquals(listOf<BudgetsEvent>(BudgetsEvent.CopyClicked), events)
    }

    @Test
    fun `el formulario nuevo muestra el error y permite guardar pero no quitar`() {
        val events = mutableListOf<BudgetsEvent>()
        val editor = BudgetEditorState(
            category = food,
            month = november,
            spentCents = 4_000,
            isNew = true,
            amountText = "0",
            error = BudgetError.AmountTooSmall,
        )
        renderForm(editor, events)

        composeRule.onNodeWithText("Nuevo presupuesto").assertIsDisplayed()
        composeRule.onNodeWithText("El monto mínimo es 0.01").assertIsDisplayed()
        composeRule.onAllNodesWithText("Quitar límite").assertCountEquals(0)
        composeRule.onNodeWithText("Guardar").performScrollTo().performClick()
        assertEquals(listOf<BudgetsEvent>(BudgetsEvent.SaveClicked), events)
    }

    @Test
    fun `al editar muestra lo gastado y ofrece quitar el limite`() {
        val events = mutableListOf<BudgetsEvent>()
        val editor = BudgetEditorState.edit(BudgetStatus(food, limitCents = 10_000, spentCents = 4_000), november)
        renderForm(editor, events)

        composeRule.onNodeWithText("Llevas gastado ${MoneyFormatter.Default.format(4_000)} este mes").assertIsDisplayed()
        composeRule.onNodeWithText("Quitar límite").performScrollTo().performClick()
        assertEquals(listOf<BudgetsEvent>(BudgetsEvent.DeleteClicked), events)
    }
}
