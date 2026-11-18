package com.flowmoney.presentation.ui.appearance

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.flowmoney.domain.model.AppTheme
import com.flowmoney.domain.repository.ThemeRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * @property theme tema a aplicar (el predeterminado mientras no se elige).
 * @property isChosen false en el primer uso: la app pide elegirlo.
 * @property isLoaded false mientras se lee la preferencia (no se muestra la elección para no parpadear).
 */
data class AppearanceUiState(
    val theme: AppTheme = AppTheme.Default,
    val isChosen: Boolean = false,
    val isLoaded: Boolean = false,
)

@HiltViewModel
class AppearanceViewModel @Inject constructor(
    private val repository: ThemeRepository,
) : ViewModel() {
    val uiState: StateFlow<AppearanceUiState> = repository.observe()
        .map { chosen -> AppearanceUiState(theme = chosen ?: AppTheme.Default, isChosen = chosen != null, isLoaded = true) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, AppearanceUiState())

    fun choose(theme: AppTheme) {
        viewModelScope.launch { repository.set(theme) }
    }
}
