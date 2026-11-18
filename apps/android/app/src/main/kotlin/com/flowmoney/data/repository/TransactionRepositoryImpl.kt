package com.flowmoney.data.repository

import com.flowmoney.data.local.dao.TransactionDao
import com.flowmoney.domain.model.DailyTotal
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionDetails
import com.flowmoney.domain.model.TransactionFilter
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.domain.repository.TransactionRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.time.LocalDate
import java.time.YearMonth
import javax.inject.Inject

class TransactionRepositoryImpl @Inject constructor(
    private val dao: TransactionDao,
) : TransactionRepository {
    override fun observe(filter: TransactionFilter): Flow<List<TransactionDetails>> =
        dao.observeBetween(
            fromEpochDay = filter.month.atDay(1).toEpochDay(),
            toEpochDay = filter.month.atEndOfMonth().toEpochDay(),
            type = filter.type?.name,
            categoryId = filter.categoryId,
        ).map { rows -> rows.map { it.toDomain() } }

    override suspend fun getById(id: Long): Transaction? = dao.getById(id)?.toDomain()

    override suspend fun insert(transaction: Transaction): Long = dao.insert(transaction.toEntity())

    override suspend fun update(transaction: Transaction) = dao.update(transaction.toEntity())

    override suspend fun delete(id: Long) {
        dao.deleteById(id)
    }

    override suspend fun countByCategory(categoryId: Long): Int = dao.countByCategory(categoryId)

    override fun observeTotalsByCategory(month: YearMonth, type: TransactionType): Flow<Map<Long, Long>> =
        dao.observeTotalsByCategory(
            fromEpochDay = month.atDay(1).toEpochDay(),
            toEpochDay = month.atEndOfMonth().toEpochDay(),
            type = type.name,
        ).map { rows -> rows.associate { it.categoryId to it.totalCents } }

    override fun observeRange(from: LocalDate, to: LocalDate): Flow<List<Transaction>> =
        dao.observeBetween(from.toEpochDay(), to.toEpochDay(), type = null, categoryId = null)
            .map { rows -> rows.map { it.transaction.toDomain() } }

    override fun observeDailyTotals(from: LocalDate, to: LocalDate): Flow<List<DailyTotal>> =
        dao.observeDailyTotals(from.toEpochDay(), to.toEpochDay()).map { rows ->
            rows.map { DailyTotal(LocalDate.ofEpochDay(it.dateEpochDay), it.type, it.totalCents) }
        }
}
