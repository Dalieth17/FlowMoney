package com.flowmoney.presentation.ui.reports

import com.flowmoney.domain.model.MonthlyReport
import java.time.YearMonth

/** Estado completo de la pantalla de reportes. [report] es null solo mientras carga el primero. */
data class ReportsUiState(
    val month: YearMonth,
    val report: MonthlyReport? = null,
    val barsBy: BarsGrouping = BarsGrouping.WEEKS,
) {
    val isLoading: Boolean get() = report == null
}

/** Cómo se agrupan las barras de "Ingresos y gastos". */
enum class BarsGrouping {
    /** Las semanas del mes elegido. */
    WEEKS,

    /** Los últimos meses, terminando en el elegido. */
    MONTHS,
}

/** Intenciones del usuario (flujo unidireccional). */
sealed interface ReportsEvent {
    data object PreviousMonth : ReportsEvent

    data object NextMonth : ReportsEvent

    data class BarsGroupingChanged(val grouping: BarsGrouping) : ReportsEvent
}
