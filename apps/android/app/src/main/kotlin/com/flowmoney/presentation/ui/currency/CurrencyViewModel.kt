package com.flowmoney.presentation.ui.currency

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.flowmoney.domain.model.AppCurrency
import com.flowmoney.domain.repository.CurrencyRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Estado de la moneda para la raíz de la app. */
sealed interface CurrencyUiState {
    /** Aún se lee la preferencia: no se muestra nada para no parpadear. */
    data object Loading : CurrencyUiState

    /** Primer uso: la persona debe elegir antes de ver montos. */
    data object NeedsChoice : CurrencyUiState

    data class Ready(val currency: AppCurrency) : CurrencyUiState
}

@HiltViewModel
class CurrencyViewModel @Inject constructor(
    private val repository: CurrencyRepository,
) : ViewModel() {
    val uiState: StateFlow<CurrencyUiState> = repository.observe()
        .map { currency -> if (currency == null) CurrencyUiState.NeedsChoice else CurrencyUiState.Ready(currency) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), CurrencyUiState.Loading)

    fun choose(currency: AppCurrency) {
        viewModelScope.launch { repository.set(currency) }
    }

    private companion object {
        const val STOP_TIMEOUT_MS = 5_000L
    }
}
