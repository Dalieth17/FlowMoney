package com.flowmoney.data.repository

import com.flowmoney.data.local.dao.BudgetDao
import com.flowmoney.domain.model.Budget
import com.flowmoney.domain.repository.BudgetRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.time.YearMonth
import javax.inject.Inject

class BudgetRepositoryImpl @Inject constructor(
    private val dao: BudgetDao,
) : BudgetRepository {
    override fun observe(month: YearMonth): Flow<List<Budget>> =
        dao.observeByMonth(month.toMonthKey()).map { rows -> rows.map { it.toDomain() } }

    override fun observeLatestBefore(month: YearMonth): Flow<List<Budget>> =
        dao.observeLatestBefore(month.toMonthKey()).map { rows -> rows.map { it.toDomain() } }

    override suspend fun get(categoryId: Long, month: YearMonth): Budget? =
        dao.get(categoryId, month.toMonthKey())?.toDomain()

    override suspend fun upsert(budget: Budget) = dao.upsert(budget.toEntity())

    override suspend fun delete(categoryId: Long, month: YearMonth) {
        dao.delete(categoryId, month.toMonthKey())
    }

    override suspend fun insertMissing(budgets: List<Budget>): Int {
        if (budgets.isEmpty()) return 0
        return dao.insertIgnoringExisting(budgets.map { it.toEntity() }).count { it != -1L }
    }
}
