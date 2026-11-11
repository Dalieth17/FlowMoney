package com.flowmoney.presentation.ui.categories

import androidx.compose.material3.SnackbarHostState
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.DefaultCategories
import com.flowmoney.presentation.theme.FlowMoneyTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(sdk = [34])
class CategoriesContentTest {
    @get:Rule
    val composeRule = createComposeRule()

    private val defaults = DefaultCategories.all.mapIndexed { index, category -> category.copy(id = index + 1L) }
    private val mascotas = Category(id = 20, name = "Mascotas", icon = "pets", color = "#B0506B")

    private fun render(state: CategoriesUiState, events: MutableList<CategoriesEvent> = mutableListOf()) {
        composeRule.setContent {
            FlowMoneyTheme {
                CategoriesContent(state = state, snackbarHostState = SnackbarHostState(), onEvent = { events += it })
            }
        }
    }

    @Test
    fun `solo las categorias propias tienen boton de eliminar`() {
        val events = mutableListOf<CategoriesEvent>()
        render(CategoriesUiState(isLoading = false, defaults = defaults, custom = listOf(mascotas)), events)

        composeRule.onNodeWithText("Mascotas").assertIsDisplayed()
        composeRule.onAllNodesWithContentDescription("Eliminar Alimentación").assertCountEquals(0)

        composeRule.onNodeWithContentDescription("Eliminar Mascotas").performClick()
        assertEquals(listOf<CategoriesEvent>(CategoriesEvent.DeleteClicked(mascotas)), events)
    }

    @Test
    fun `sin categorias propias muestra la invitacion a crear una`() {
        render(CategoriesUiState(isLoading = false, defaults = defaults))
        composeRule.onNodeWithText("Aún no tienes categorías propias").assertIsDisplayed()
    }

    @Test
    fun `el boton flotante abre el editor`() {
        val events = mutableListOf<CategoriesEvent>()
        render(CategoriesUiState(isLoading = false, defaults = defaults), events)
        composeRule.onNodeWithText("Nueva categoría").performClick()
        assertEquals(listOf<CategoriesEvent>(CategoriesEvent.AddClicked), events)
    }
}
