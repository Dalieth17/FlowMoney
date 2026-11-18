package com.flowmoney.domain.usecase.budget

import com.flowmoney.domain.common.Outcome
import com.flowmoney.domain.model.Budget
import com.flowmoney.domain.model.BudgetError
import com.flowmoney.domain.repository.BudgetRepository
import java.time.YearMonth
import javax.inject.Inject

/** Quita el límite de una categoría en un mes. Devuelve el presupuesto borrado para poder deshacer. */
class DeleteBudgetUseCase @Inject constructor(
    private val budgets: BudgetRepository,
) {
    suspend operator fun invoke(categoryId: Long, month: YearMonth): Outcome<Budget, BudgetError> {
        val existing = budgets.get(categoryId, month) ?: return Outcome.Failure(BudgetError.NotFound)
        budgets.delete(categoryId, month)
        return Outcome.Success(existing)
    }
}
