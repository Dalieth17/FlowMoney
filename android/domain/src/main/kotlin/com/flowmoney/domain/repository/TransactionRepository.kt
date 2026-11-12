package com.flowmoney.domain.repository

import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionDetails
import com.flowmoney.domain.model.TransactionFilter
import kotlinx.coroutines.flow.Flow

/** Contrato de acceso a movimientos. La capa de datos lo implementa (Room). */
interface TransactionRepository {
    /** Movimientos que cumplen el filtro, del más reciente al más antiguo. */
    fun observe(filter: TransactionFilter): Flow<List<TransactionDetails>>

    suspend fun getById(id: Long): Transaction?

    suspend fun insert(transaction: Transaction): Long

    suspend fun update(transaction: Transaction)

    suspend fun delete(id: Long)

    suspend fun countByCategory(categoryId: Long): Int
}
