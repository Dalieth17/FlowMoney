package com.flowmoney.domain.usecase.advisor

import com.flowmoney.domain.advisor.AdvisorInput
import com.flowmoney.domain.advisor.AdvisorReport
import com.flowmoney.domain.advisor.FinancialAdvisor
import com.flowmoney.domain.repository.BudgetRepository
import com.flowmoney.domain.repository.CategoryRepository
import com.flowmoney.domain.repository.TransactionRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import java.time.LocalDate
import java.time.YearMonth
import javax.inject.Inject

/** Análisis del asesor para el mes de [today]; se recalcula cuando cambian movimientos, categorías o presupuestos. */
class ObserveAdvisorReportUseCase @Inject constructor(
    private val transactions: TransactionRepository,
    private val categories: CategoryRepository,
    private val budgets: BudgetRepository,
) {
    operator fun invoke(today: LocalDate): Flow<AdvisorReport> {
        val month = YearMonth.from(today)
        val from = month.minusMonths(FinancialAdvisor.HISTORY_MONTHS.toLong()).atDay(1)
        return combine(
            categories.observeAll(),
            transactions.observeRange(from, month.atEndOfMonth()),
            budgets.observe(month),
        ) { categoryList, history, monthBudgets ->
            FinancialAdvisor.analyze(AdvisorInput(today, categoryList, history, monthBudgets))
        }
    }
}
