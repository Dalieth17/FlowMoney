package com.flowmoney.domain.usecase.budget

import com.flowmoney.domain.common.Outcome
import com.flowmoney.domain.model.Budget
import com.flowmoney.domain.model.BudgetError
import com.flowmoney.domain.model.BudgetRules
import com.flowmoney.domain.repository.BudgetRepository
import com.flowmoney.domain.repository.CategoryRepository
import java.time.YearMonth
import javax.inject.Inject

/** Datos del formulario. [limitCents] es null si lo escrito no es un monto válido (`Money.parseToCents`). */
data class BudgetDraft(
    val categoryId: Long,
    val month: YearMonth,
    val limitCents: Long?,
)

/** Define o cambia el límite de una categoría en un mes. */
class SaveBudgetUseCase @Inject constructor(
    private val budgets: BudgetRepository,
    private val categories: CategoryRepository,
) {
    suspend operator fun invoke(draft: BudgetDraft): Outcome<Unit, BudgetError> {
        val limitCents = draft.limitCents ?: return Outcome.Failure(BudgetError.InvalidAmount)
        BudgetRules.validate(limitCents)?.let { return Outcome.Failure(it) }
        if (categories.getById(draft.categoryId) == null) return Outcome.Failure(BudgetError.CategoryNotFound)

        budgets.upsert(Budget(draft.categoryId, draft.month, limitCents))
        return Outcome.Success(Unit)
    }
}
