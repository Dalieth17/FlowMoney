package com.flowmoney.presentation.ui.reports

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.flowmoney.domain.usecase.report.ObserveMonthlyReportUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import java.time.Clock
import java.time.YearMonth
import javax.inject.Inject

/**
 * Solo lectura: elige el mes y cómo agrupar las barras; el reporte se recalcula solo cuando
 * cambian los movimientos. Exportar a PDF es cosa de la pantalla (necesita la Activity).
 */
@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class ReportsViewModel @Inject constructor(
    private val observeReport: ObserveMonthlyReportUseCase,
    clock: Clock,
) : ViewModel() {

    private val month = MutableStateFlow(YearMonth.now(clock))
    private val barsBy = MutableStateFlow(BarsGrouping.WEEKS)

    // Cambiar de mes cancela el reporte anterior y abre el nuevo.
    private val report = month.flatMapLatest { observeReport(it) }

    val uiState: StateFlow<ReportsUiState> =
        combine(report, barsBy) { currentReport, grouping ->
            // El mes sale del propio reporte: el título nunca muestra un mes con datos de otro.
            ReportsUiState(month = currentReport.month, report = currentReport, barsBy = grouping)
        }.stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            initialValue = ReportsUiState(month = month.value),
        )

    fun onEvent(event: ReportsEvent) {
        when (event) {
            ReportsEvent.PreviousMonth -> month.update { it.minusMonths(1) }
            ReportsEvent.NextMonth -> month.update { it.plusMonths(1) }
            is ReportsEvent.BarsGroupingChanged -> barsBy.value = event.grouping
        }
    }

    private companion object {
        const val STOP_TIMEOUT_MS = 5_000L
    }
}
