package com.flowmoney.domain.usecase.budget

import com.flowmoney.domain.model.BudgetOverview
import com.flowmoney.domain.model.BudgetStatus
import com.flowmoney.domain.model.CategorySpending
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.domain.repository.BudgetRepository
import com.flowmoney.domain.repository.CategoryRepository
import com.flowmoney.domain.repository.TransactionRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import java.time.YearMonth
import javax.inject.Inject

/**
 * Presupuestos del mes con lo gastado en cada categoría. Se actualiza solo cuando cambian
 * categorías, límites o movimientos. Solo cuentan los gastos (no los ingresos) de ese mes.
 */
class ObserveBudgetOverviewUseCase @Inject constructor(
    private val budgets: BudgetRepository,
    private val categories: CategoryRepository,
    private val transactions: TransactionRepository,
) {
    operator fun invoke(month: YearMonth): Flow<BudgetOverview> = combine(
        categories.observeAll(),
        budgets.observe(month),
        budgets.observeLatestBefore(month),
        transactions.observeTotalsByCategory(month, TransactionType.EXPENSE),
    ) { categoryList, current, previous, spending ->
        val limits = current.associate { it.categoryId to it.limitCents }
        val statuses = categoryList.mapNotNull { category ->
            limits[category.id]?.let { limit -> BudgetStatus(category, limit, spending[category.id] ?: 0L) }
        }
        // sortedByDescending es estable: a igual gasto se conserva el orden de las categorías.
        val unbudgeted = categoryList
            .filter { it.id !in limits }
            .map { CategorySpending(it, spending[it.id] ?: 0L) }
            .sortedByDescending { it.spentCents }

        // Un presupuesto cuya categoría ya no existe no se puede copiar.
        val existingIds = categoryList.mapTo(HashSet()) { it.id }
        val copyable = previous.count { it.categoryId in existingIds && it.categoryId !in limits }

        BudgetOverview(
            budgets = statuses,
            unbudgeted = unbudgeted,
            copySource = previous.firstOrNull()?.month?.takeIf { copyable > 0 },
            copyableCount = copyable,
        )
    }
}
