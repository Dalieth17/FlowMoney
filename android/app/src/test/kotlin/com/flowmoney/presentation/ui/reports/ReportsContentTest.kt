package com.flowmoney.presentation.ui.reports

import androidx.compose.material3.SnackbarHostState
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.CategoryShare
import com.flowmoney.domain.model.MonthFlow
import com.flowmoney.domain.model.MonthSummary
import com.flowmoney.domain.model.MonthlyReport
import com.flowmoney.domain.model.WeekFlow
import com.flowmoney.presentation.format.DateFormat
import com.flowmoney.presentation.theme.FlowMoneyTheme
import com.flowmoney.presentation.ui.reports.ReportsTestTags
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.time.YearMonth

// Pantalla de teléfono real: la de Robolectric por defecto es tan baja que la lista no cabe.
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34], qualifiers = "w411dp-h891dp")
class ReportsContentTest {
    @get:Rule
    val composeRule = createComposeRule()

    private val november = YearMonth.of(2026, 11)
    private val food = Category(id = 1, name = "Alimentación", icon = "restaurant", color = "#C25A44", isDefault = true)
    private val transport = Category(id = 2, name = "Transporte", icon = "directions_bus", color = "#3E78A8", isDefault = true)

    private val report = MonthlyReport(
        month = november,
        summary = MonthSummary(incomeCents = 435_000, expenseCents = 60_000),
        previousSummary = MonthSummary(incomeCents = 420_000, expenseCents = 80_000),
        expensesByCategory = listOf(
            CategoryShare(food, 45_000, 75),
            CategoryShare(transport, 15_000, 25),
        ),
        weeks = listOf(
            WeekFlow(1, november.atDay(1), november.atDay(7), incomeCents = 435_000, expenseCents = 20_000),
            WeekFlow(2, november.atDay(8), november.atDay(14), expenseCents = 40_000),
            WeekFlow(3, november.atDay(15), november.atDay(21)),
            WeekFlow(4, november.atDay(22), november.atDay(28)),
            WeekFlow(5, november.atDay(29), november.atDay(30)),
        ),
        months = (5 downTo 0).map { MonthFlow(november.minusMonths(it.toLong()), 400_000, 50_000) },
    )

    private fun render(
        state: ReportsUiState,
        events: MutableList<ReportsEvent> = mutableListOf(),
        exported: MutableList<MonthlyReport> = mutableListOf(),
    ) {
        composeRule.setContent {
            FlowMoneyTheme {
                ReportsContent(
                    state = state,
                    snackbarHostState = SnackbarHostState(),
                    onEvent = { events += it },
                    onExport = { exported += it },
                )
            }
        }
    }

    private fun scrollTo(matcher: SemanticsMatcher) {
        composeRule.onNodeWithTag(ReportsTestTags.LIST).performScrollToNode(matcher)
    }

    @Test
    fun `muestra el mes el resumen la categoria y la tasa de ahorro`() {
        render(ReportsUiState(month = november, report = report))

        composeRule.onNodeWithText(DateFormat.month(november)).assertIsDisplayed()
        scrollTo(hasText("Tasa de ahorro"))
        composeRule.onNodeWithText("Tasa de ahorro").assertIsDisplayed()
        composeRule.onNodeWithText("86 %").assertIsDisplayed()
        // "Gastaste 25 % menos que en octubre" (60.000 frente a 80.000).
        composeRule.onNodeWithText("Gastaste 25 % menos que en octubre").assertIsDisplayed()
        // La fila de la categoría se expone a TalkBack como una sola frase.
        val categoryDescription = "Alimentación: S/ 450.00, 75 % del gasto"
        scrollTo(hasContentDescription(categoryDescription))
        composeRule.onNodeWithContentDescription(categoryDescription).assertIsDisplayed()
    }

    @Test
    fun `las flechas cambian de mes`() {
        val events = mutableListOf<ReportsEvent>()
        render(ReportsUiState(month = november, report = report), events)
        composeRule.onNodeWithContentDescription("Mes anterior").performClick()
        composeRule.onNodeWithContentDescription("Mes siguiente").performClick()
        assertEquals(listOf(ReportsEvent.PreviousMonth, ReportsEvent.NextMonth), events)
    }

    @Test
    fun `el selector cambia las barras a por mes`() {
        val events = mutableListOf<ReportsEvent>()
        render(ReportsUiState(month = november, report = report), events)
        scrollTo(hasText("Por mes"))
        composeRule.onNodeWithText("Por mes").performClick()
        assertEquals(listOf<ReportsEvent>(ReportsEvent.BarsGroupingChanged(BarsGrouping.MONTHS)), events)
    }

    @Test
    fun `exportar entrega el reporte del mes`() {
        val exported = mutableListOf<MonthlyReport>()
        render(ReportsUiState(month = november, report = report), exported = exported)
        composeRule.onNodeWithContentDescription("Exportar a PDF").assertIsEnabled().performClick()
        assertEquals(listOf(report), exported)
    }

    @Test
    fun `un mes vacio no se puede exportar e invita a registrar`() {
        render(ReportsUiState(month = november, report = MonthlyReport(november)))
        composeRule.onNodeWithText("Sin movimientos este mes").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Exportar a PDF").assertIsNotEnabled()
    }

    @Test
    fun `mientras carga no muestra el resumen`() {
        render(ReportsUiState(month = november, report = null))
        composeRule.onNodeWithContentDescription("Exportar a PDF").assertIsNotEnabled()
    }
}
