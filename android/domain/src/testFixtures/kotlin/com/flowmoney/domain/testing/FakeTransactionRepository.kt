package com.flowmoney.domain.testing

import com.flowmoney.domain.model.DailyTotal
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionDetails
import com.flowmoney.domain.model.TransactionFilter
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.domain.repository.TransactionRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import java.time.LocalDate
import java.time.YearMonth

/**
 * Repositorio de movimientos en memoria. Une cada movimiento con su categoría tomada de
 * [categories], igual que el JOIN de la implementación real, y respeta su mismo orden.
 */
class FakeTransactionRepository(
    private val categories: FakeCategoryRepository,
    initial: List<Transaction> = emptyList(),
) : TransactionRepository {
    private val state = MutableStateFlow(initial)
    private var nextId = (initial.maxOfOrNull { it.id } ?: 0L) + 1

    val current: List<Transaction> get() = state.value

    override fun observe(filter: TransactionFilter): Flow<List<TransactionDetails>> =
        combine(state, categories.observeAll()) { transactions, categoryList ->
            val byId = categoryList.associateBy { it.id }
            transactions
                .filter { YearMonth.from(it.date) == filter.month }
                .filter { filter.type == null || it.type == filter.type }
                .filter { filter.categoryId == null || it.categoryId == filter.categoryId }
                .sortedWith(compareByDescending<Transaction> { it.date }.thenByDescending { it.id })
                .mapNotNull { t -> byId[t.categoryId]?.let { TransactionDetails(t, it) } }
        }

    override suspend fun getById(id: Long): Transaction? = state.value.firstOrNull { it.id == id }

    override suspend fun insert(transaction: Transaction): Long {
        val id = nextId++
        state.update { it + transaction.copy(id = id) }
        return id
    }

    override suspend fun update(transaction: Transaction) {
        state.update { list -> list.map { if (it.id == transaction.id) transaction else it } }
    }

    override suspend fun delete(id: Long) {
        state.update { list -> list.filterNot { it.id == id } }
    }

    override suspend fun countByCategory(categoryId: Long): Int = state.value.count { it.categoryId == categoryId }

    override fun observeTotalsByCategory(month: YearMonth, type: TransactionType): Flow<Map<Long, Long>> =
        state.map { list ->
            list.filter { it.type == type && YearMonth.from(it.date) == month }
                .groupBy { it.categoryId }
                .mapValues { (_, items) -> items.sumOf { it.amountCents } }
        }

    override fun observeDailyTotals(from: LocalDate, to: LocalDate): Flow<List<DailyTotal>> = state.map { list ->
        list.filter { it.date in from..to }
            .groupBy { it.date to it.type }
            .map { (key, items) -> DailyTotal(key.first, key.second, items.sumOf { it.amountCents }) }
    }
}
