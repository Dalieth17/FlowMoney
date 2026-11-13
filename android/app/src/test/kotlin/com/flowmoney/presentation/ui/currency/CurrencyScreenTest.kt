package com.flowmoney.presentation.ui.currency

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.flowmoney.domain.model.AppCurrency
import com.flowmoney.domain.model.MonthSummary
import com.flowmoney.presentation.components.MonthTotals
import com.flowmoney.presentation.format.LocalMoneyFormatter
import com.flowmoney.presentation.format.MoneyFormatter
import com.flowmoney.presentation.theme.FlowMoneyTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(sdk = [34], qualifiers = "w411dp-h891dp")
class CurrencyScreenTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun `el primer uso ofrece pesos y dolares con un ejemplo de cada formato`() {
        var chosen: AppCurrency? = null
        composeRule.setContent { FlowMoneyTheme { CurrencyChoiceScreen(onChoose = { chosen = it }) } }

        composeRule.onNodeWithText("¿En qué moneda manejas tu dinero?").assertExists()
        composeRule.onNodeWithText("Así se verán tus montos: $ 1.234.567").assertExists()
        composeRule.onNodeWithText("Así se verán tus montos: US$ 1,234,567.00").assertExists()

        composeRule.onNodeWithText("Dólares estadounidenses (USD)").performClick()
        assertEquals(AppCurrency.USD, chosen)
    }

    @Test
    fun `el dialogo avisa que cambiar la moneda no convierte los montos`() {
        var chosen: AppCurrency? = null
        composeRule.setContent {
            FlowMoneyTheme { CurrencyDialog(current = AppCurrency.USD, onChoose = { chosen = it }, onDismiss = {}) }
        }

        composeRule.onNodeWithText("Cambiar la moneda no convierte tus montos: solo cambia cómo se muestran.").assertExists()
        composeRule.onNodeWithText("Pesos colombianos (COP)").performClick()
        assertEquals(AppCurrency.COP, chosen)
    }

    @Test
    fun `los montos usan la moneda provista por la raiz`() {
        composeRule.setContent {
            FlowMoneyTheme {
                CompositionLocalProvider(LocalMoneyFormatter provides MoneyFormatter.of(AppCurrency.USD)) {
                    MonthTotals(MonthSummary(incomeCents = 420_000, expenseCents = 100_050))
                }
            }
        }

        composeRule.onNodeWithText("US$ 4,200.00").assertExists()
        composeRule.onNodeWithText("US$ 1,000.50").assertExists()
        composeRule.onNodeWithText("US$ 3,199.50").assertExists()
    }
}
