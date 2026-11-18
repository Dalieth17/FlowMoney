package com.flowmoney.domain.usecase.budget

import com.flowmoney.domain.model.BudgetStatus
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.domain.repository.BudgetRepository
import com.flowmoney.domain.repository.CategoryRepository
import com.flowmoney.domain.repository.TransactionRepository
import kotlinx.coroutines.flow.first
import java.time.YearMonth
import javax.inject.Inject

/** Estado del presupuesto de una categoría en un mes, o null si no tiene límite (para avisar al guardar un gasto). */
class CheckBudgetUseCase @Inject constructor(
    private val budgets: BudgetRepository,
    private val categories: CategoryRepository,
    private val transactions: TransactionRepository,
) {
    suspend operator fun invoke(categoryId: Long, month: YearMonth): BudgetStatus? {
        val budget = budgets.get(categoryId, month) ?: return null
        val category = categories.getById(categoryId) ?: return null
        val spent = transactions.observeTotalsByCategory(month, TransactionType.EXPENSE).first()[categoryId] ?: 0L
        return BudgetStatus(category, budget.limitCents, spent)
    }
}
