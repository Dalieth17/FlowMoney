package com.flowmoney.domain.usecase.report

import com.flowmoney.domain.model.MonthlyReport
import com.flowmoney.domain.model.ReportRules
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.domain.repository.CategoryRepository
import com.flowmoney.domain.repository.TransactionRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import java.time.YearMonth
import javax.inject.Inject

/**
 * Reporte de un mes. La base de datos entrega totales ya sumados (por categoría y por día) y aquí
 * se arman el resumen, los porcentajes y las series de los gráficos; se actualiza solo cuando
 * cambian los movimientos o las categorías.
 */
class ObserveMonthlyReportUseCase @Inject constructor(
    private val transactions: TransactionRepository,
    private val categories: CategoryRepository,
) {
    operator fun invoke(month: YearMonth): Flow<MonthlyReport> = combine(
        categories.observeAll(),
        transactions.observeTotalsByCategory(month, TransactionType.EXPENSE),
        transactions.observeDailyTotals(ReportRules.historyStart(month), month.atEndOfMonth()),
    ) { categoryList, expenseTotals, dailyTotals ->
        ReportRules.build(month, categoryList, expenseTotals, dailyTotals)
    }
}
