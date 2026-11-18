package com.flowmoney.domain.usecase.budget

import com.flowmoney.domain.repository.BudgetRepository
import kotlinx.coroutines.flow.first
import java.time.YearMonth
import javax.inject.Inject

/**
 * Repite en [month] los límites del último mes anterior que tenga presupuestos. No pisa los que
 * [month] ya tiene. Devuelve cuántos copió (0 si no había nada que copiar).
 */
class CopyBudgetsUseCase @Inject constructor(
    private val budgets: BudgetRepository,
) {
    suspend operator fun invoke(month: YearMonth): Int {
        val source = budgets.observeLatestBefore(month).first()
        return budgets.insertMissing(source.map { it.copy(month = month) })
    }
}
