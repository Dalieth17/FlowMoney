package com.flowmoney.domain.repository

import com.flowmoney.domain.model.Budget
import kotlinx.coroutines.flow.Flow
import java.time.YearMonth

/** Contrato de acceso a presupuestos (uno por categoría y mes). La capa de datos lo implementa (Room). */
interface BudgetRepository {
    fun observe(month: YearMonth): Flow<List<Budget>>

    /** Presupuestos del último mes anterior a [month] que tenga alguno (lista vacía si no hay). */
    fun observeLatestBefore(month: YearMonth): Flow<List<Budget>>

    suspend fun get(categoryId: Long, month: YearMonth): Budget?

    /** Crea el presupuesto o reemplaza el límite si la categoría ya tenía uno ese mes. */
    suspend fun upsert(budget: Budget)

    suspend fun delete(categoryId: Long, month: YearMonth)

    /** Inserta los que aún no existen (misma categoría y mes) sin tocar los demás; devuelve cuántos insertó. */
    suspend fun insertMissing(budgets: List<Budget>): Int
}
