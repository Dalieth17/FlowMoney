package com.flowmoney.domain.repository

import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionDetails
import com.flowmoney.domain.model.TransactionFilter
import kotlinx.coroutines.flow.Flow
import java.time.YearMonth

/** Contrato de acceso a movimientos. La capa de datos lo implementa (Room). */
interface TransactionRepository {
    /** Movimientos que cumplen el filtro, del más reciente al más antiguo. */
    fun observe(filter: TransactionFilter): Flow<List<TransactionDetails>>

    suspend fun getById(id: Long): Transaction?

    suspend fun insert(transaction: Transaction): Long

    suspend fun update(transaction: Transaction)

    suspend fun delete(id: Long)

    suspend fun countByCategory(categoryId: Long): Int

    /** Total gastado en el mes por categoría (solo gastos; las categorías sin gastos no aparecen). */
    fun observeExpensesByCategory(month: YearMonth): Flow<Map<Long, Long>>
}
