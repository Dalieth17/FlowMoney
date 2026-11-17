package com.flowmoney.presentation.ui.appearance

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.flowmoney.domain.model.AppTheme
import com.flowmoney.presentation.theme.FlowMoneyTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(sdk = [34], qualifiers = "w411dp-h891dp")
class AppearanceScreenTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun `el primer uso ofrece los dos temas`() {
        var chosen: AppTheme? = null
        composeRule.setContent { FlowMoneyTheme { ThemeChoiceScreen(onChoose = { chosen = it }) } }

        composeRule.onNodeWithText("Elige cómo se ve FlowMoney").assertExists()
        composeRule.onNodeWithText("Verde y negro").assertExists()
        composeRule.onNodeWithText("Blanco y negro").performClick()
        assertEquals(AppTheme.MONO, chosen)
    }

    @Test
    fun `el dialogo cambia el tema desde blanco y negro`() {
        var chosen: AppTheme? = null
        composeRule.setContent {
            FlowMoneyTheme(theme = AppTheme.MONO) { ThemeDialog(current = AppTheme.MONO, onChoose = { chosen = it }, onDismiss = {}) }
        }

        composeRule.onNodeWithText("Cambiar tema").assertExists()
        composeRule.onNodeWithText("Verde y negro").performClick()
        assertEquals(AppTheme.GREEN, chosen)
    }
}
