package com.flowmoney.domain.testing

import com.flowmoney.domain.model.Budget
import com.flowmoney.domain.repository.BudgetRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import java.time.YearMonth

/** Presupuestos en memoria, con la misma clave única que la tabla real: (categoría, mes). */
class FakeBudgetRepository(initial: List<Budget> = emptyList()) : BudgetRepository {
    private val state = MutableStateFlow(initial)

    /** Contenido actual, para hacer aserciones. */
    val current: List<Budget> get() = state.value

    override fun observe(month: YearMonth): Flow<List<Budget>> = state.map { list -> list.filter { it.month == month } }

    override fun observeLatestBefore(month: YearMonth): Flow<List<Budget>> = state.map { list ->
        val latest = list.filter { it.month < month }.maxOfOrNull { it.month }
        list.filter { it.month == latest }
    }

    override suspend fun get(categoryId: Long, month: YearMonth): Budget? =
        state.value.firstOrNull { it.categoryId == categoryId && it.month == month }

    override suspend fun upsert(budget: Budget) {
        state.update { list -> list.filterNot { it.sameKeyAs(budget) } + budget }
    }

    override suspend fun delete(categoryId: Long, month: YearMonth) {
        state.update { list -> list.filterNot { it.categoryId == categoryId && it.month == month } }
    }

    override suspend fun insertMissing(budgets: List<Budget>): Int {
        var inserted = 0
        state.update { list ->
            val missing = budgets.filter { candidate -> list.none { it.sameKeyAs(candidate) } }
            inserted = missing.size
            list + missing
        }
        return inserted
    }

    private fun Budget.sameKeyAs(other: Budget) = categoryId == other.categoryId && month == other.month
}
