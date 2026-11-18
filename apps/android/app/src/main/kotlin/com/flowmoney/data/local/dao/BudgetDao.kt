package com.flowmoney.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Upsert
import com.flowmoney.data.local.entity.BudgetEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface BudgetDao {
    @Query("SELECT * FROM budgets WHERE month = :month")
    fun observeByMonth(month: Int): Flow<List<BudgetEntity>>

    /** Presupuestos del último mes anterior a [month] que tenga alguno. */
    @Query("SELECT * FROM budgets WHERE month = (SELECT MAX(month) FROM budgets WHERE month < :month)")
    fun observeLatestBefore(month: Int): Flow<List<BudgetEntity>>

    @Query("SELECT * FROM budgets WHERE category_id = :categoryId AND month = :month")
    suspend fun get(categoryId: Long, month: Int): BudgetEntity?

    @Upsert
    suspend fun upsert(budget: BudgetEntity)

    /** Los que ya existen (mismo mes y categoría) se dejan como están: su posición devuelve -1. */
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertIgnoringExisting(budgets: List<BudgetEntity>): List<Long>

    @Query("DELETE FROM budgets WHERE category_id = :categoryId AND month = :month")
    suspend fun delete(categoryId: Long, month: Int): Int
}
