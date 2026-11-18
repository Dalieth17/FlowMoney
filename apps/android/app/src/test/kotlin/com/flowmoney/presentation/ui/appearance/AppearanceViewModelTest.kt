package com.flowmoney.presentation.ui.appearance

import com.flowmoney.domain.model.AppTheme
import com.flowmoney.domain.testing.FakeThemeRepository
import com.flowmoney.testing.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AppearanceViewModelTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `sin eleccion usa verde y negro y pide elegir`() = runTest {
        val viewModel = AppearanceViewModel(FakeThemeRepository())

        val state = viewModel.uiState.value
        assertTrue(state.isLoaded)
        assertFalse(state.isChosen)
        assertEquals(AppTheme.GREEN, state.theme)
    }

    @Test
    fun `elegir blanco y negro lo guarda y lo aplica`() = runTest {
        val repository = FakeThemeRepository()
        val viewModel = AppearanceViewModel(repository)

        viewModel.choose(AppTheme.MONO)

        assertEquals(AppTheme.MONO, repository.current.value)
        assertEquals(AppearanceUiState(theme = AppTheme.MONO, isChosen = true, isLoaded = true), viewModel.uiState.value)
    }

    @Test
    fun `con tema guardado entra directo`() = runTest {
        val viewModel = AppearanceViewModel(FakeThemeRepository(AppTheme.MONO))
        assertEquals(AppearanceUiState(theme = AppTheme.MONO, isChosen = true, isLoaded = true), viewModel.uiState.value)
    }
}
