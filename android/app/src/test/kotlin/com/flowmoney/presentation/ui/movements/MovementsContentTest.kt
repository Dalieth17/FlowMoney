package com.flowmoney.presentation.ui.movements

import androidx.compose.material3.SnackbarHostState
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.MonthSummary
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionDetails
import com.flowmoney.domain.model.TransactionError
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.presentation.format.DateFormat
import com.flowmoney.presentation.format.MoneyFormat
import com.flowmoney.presentation.theme.FlowMoneyTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.time.LocalDate
import java.time.YearMonth

@RunWith(AndroidJUnit4::class)
@Config(sdk = [34])
class MovementsContentTest {
    @get:Rule
    val composeRule = createComposeRule()

    private val today = LocalDate.of(2026, 11, 12)
    private val food = Category(id = 1, name = "Alimentación", icon = "restaurant", color = "#C25A44", isDefault = true)
    private val lunch = TransactionDetails(
        Transaction(7, 1_250, "Almuerzo", today, TransactionType.EXPENSE, food.id),
        food,
    )
    private val baseState = MovementsUiState(
        month = YearMonth.of(2026, 11),
        today = today,
        isLoading = false,
        categories = listOf(food),
    )

    private fun render(state: MovementsUiState, events: MutableList<MovementsEvent> = mutableListOf()) {
        composeRule.setContent {
            FlowMoneyTheme {
                MovementsContent(state = state, snackbarHostState = SnackbarHostState(), onEvent = { events += it })
            }
        }
    }

    @Test
    fun `muestra el mes el resumen y los movimientos agrupados bajo Hoy`() {
        val events = mutableListOf<MovementsEvent>()
        render(
            baseState.copy(
                days = listOf(DayGroup(today, listOf(lunch))),
                summary = MonthSummary(incomeCents = 0, expenseCents = 1_250),
            ),
            events,
        )

        composeRule.onNodeWithText(DateFormat.month(YearMonth.of(2026, 11))).assertIsDisplayed()
        composeRule.onNodeWithText("Hoy").assertIsDisplayed()
        composeRule.onNodeWithText(MoneyFormat.signed(1_250, TransactionType.EXPENSE)).assertIsDisplayed()

        composeRule.onNodeWithText("Almuerzo").performClick()
        assertEquals(listOf<MovementsEvent>(MovementsEvent.EditClicked(lunch)), events)
    }

    @Test
    fun `las flechas cambian de mes`() {
        val events = mutableListOf<MovementsEvent>()
        render(baseState, events)
        composeRule.onNodeWithContentDescription("Mes anterior").performClick()
        composeRule.onNodeWithContentDescription("Mes siguiente").performClick()
        assertEquals(listOf(MovementsEvent.PreviousMonth, MovementsEvent.NextMonth), events)
    }

    @Test
    fun `sin resultados por filtros ofrece quitarlos`() {
        val events = mutableListOf<MovementsEvent>()
        render(baseState.copy(typeFilter = TransactionType.INCOME), events)

        composeRule.onNodeWithText("Nada coincide con los filtros").assertIsDisplayed()
        composeRule.onNodeWithText("Quitar filtros").performClick()
        assertEquals(listOf<MovementsEvent>(MovementsEvent.ClearFilters), events)
    }

    @Test
    fun `mes vacio sin filtros invita a registrar`() {
        render(baseState)
        composeRule.onNodeWithText("Sin movimientos este mes").assertIsDisplayed()
    }

    @Test
    fun `el boton flotante abre el formulario`() {
        val events = mutableListOf<MovementsEvent>()
        render(baseState, events)
        composeRule.onNodeWithContentDescription("Nuevo movimiento").performClick()
        assertEquals(listOf<MovementsEvent>(MovementsEvent.AddClicked), events)
    }

    @Test
    fun `el formulario muestra el error junto al monto y permite guardar`() {
        val events = mutableListOf<MovementsEvent>()
        val editor = MovementEditorState(date = today, amountText = "abc", error = TransactionError.InvalidAmount)
        render(baseState.copy(editor = editor), events)

        composeRule.onNodeWithText("Escribe un monto válido, por ejemplo 12.50").assertIsDisplayed()
        composeRule.onNodeWithText("Guardar").performClick()
        assertTrue(MovementsEvent.SaveClicked in events)
    }
}
