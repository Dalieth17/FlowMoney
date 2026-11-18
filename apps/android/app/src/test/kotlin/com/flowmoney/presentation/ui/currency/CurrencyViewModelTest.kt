package com.flowmoney.presentation.ui.currency

import com.flowmoney.domain.model.AppCurrency
import com.flowmoney.domain.testing.FakeCurrencyRepository
import com.flowmoney.testing.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CurrencyViewModelTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `sin moneda guardada pide elegir y al elegir queda lista`() = runTest {
        val repository = FakeCurrencyRepository()
        val viewModel = CurrencyViewModel(repository)
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect {} }

        assertEquals(CurrencyUiState.NeedsChoice, viewModel.uiState.value)

        viewModel.choose(AppCurrency.USD)

        assertEquals(AppCurrency.USD, repository.current.value)
        assertEquals(CurrencyUiState.Ready(AppCurrency.USD), viewModel.uiState.value)
    }

    @Test
    fun `con moneda guardada entra directo y se puede cambiar`() = runTest {
        val repository = FakeCurrencyRepository(AppCurrency.COP)
        val viewModel = CurrencyViewModel(repository)
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect {} }

        assertEquals(CurrencyUiState.Ready(AppCurrency.COP), viewModel.uiState.value)

        viewModel.choose(AppCurrency.USD)
        assertEquals(CurrencyUiState.Ready(AppCurrency.USD), viewModel.uiState.value)
    }
}
