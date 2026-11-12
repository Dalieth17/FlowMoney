package com.flowmoney.domain.repository

import com.flowmoney.domain.model.DailyTotal
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionDetails
import com.flowmoney.domain.model.TransactionFilter
import com.flowmoney.domain.model.TransactionType
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate
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

    /** Total del mes por id de categoría para un tipo de movimiento (las categorías sin movimientos no aparecen). */
    fun observeTotalsByCategory(month: YearMonth, type: TransactionType): Flow<Map<Long, Long>>

    /** Totales por día y tipo entre dos fechas, ambas incluidas (los días sin movimientos no aparecen). */
    fun observeDailyTotals(from: LocalDate, to: LocalDate): Flow<List<DailyTotal>>
}
