package com.flowmoney.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import com.flowmoney.data.local.entity.CategoryTotalRow
import com.flowmoney.data.local.entity.DailyTotalRow
import com.flowmoney.data.local.entity.TransactionEntity
import com.flowmoney.data.local.entity.TransactionWithCategoryRow
import kotlinx.coroutines.flow.Flow

@Dao
interface TransactionDao {
    /** Movimientos de un rango de días con su categoría, del más reciente al más antiguo. */
    @Query(
        """
        SELECT t.*,
               c.id AS cat_id, c.name AS cat_name, c.name_key AS cat_name_key,
               c.icon AS cat_icon, c.color AS cat_color, c.is_default AS cat_is_default
          FROM transactions t
          JOIN categories c ON c.id = t.category_id
         WHERE t.date_epoch_day BETWEEN :fromEpochDay AND :toEpochDay
           AND (:type IS NULL OR t.type = :type)
           AND (:categoryId IS NULL OR t.category_id = :categoryId)
         ORDER BY t.date_epoch_day DESC, t.id DESC
        """,
    )
    fun observeBetween(
        fromEpochDay: Long,
        toEpochDay: Long,
        type: String?,
        categoryId: Long?,
    ): Flow<List<TransactionWithCategoryRow>>

    @Query("SELECT * FROM transactions WHERE id = :id")
    suspend fun getById(id: Long): TransactionEntity?

    @Insert
    suspend fun insert(transaction: TransactionEntity): Long

    @Update
    suspend fun update(transaction: TransactionEntity)

    @Query("DELETE FROM transactions WHERE id = :id")
    suspend fun deleteById(id: Long): Int

    @Query("SELECT COUNT(*) FROM transactions WHERE category_id = :categoryId")
    suspend fun countByCategory(categoryId: Long): Int

    /** Total por categoría de un tipo de movimiento en un rango de días (p. ej. los gastos del mes). */
    @Query(
        """
        SELECT category_id, SUM(amount_cents) AS total_cents
          FROM transactions
         WHERE type = :type AND date_epoch_day BETWEEN :fromEpochDay AND :toEpochDay
         GROUP BY category_id
        """,
    )
    fun observeTotalsByCategory(fromEpochDay: Long, toEpochDay: Long, type: String): Flow<List<CategoryTotalRow>>

    /**
     * Total por día y tipo en un rango de días. Los reportes agrupan después por semana o por mes:
     * son como mucho dos filas por día, así que no hace falta traer cada movimiento.
     */
    @Query(
        """
        SELECT date_epoch_day, type, SUM(amount_cents) AS total_cents
          FROM transactions
         WHERE date_epoch_day BETWEEN :fromEpochDay AND :toEpochDay
         GROUP BY date_epoch_day, type
        """,
    )
    fun observeDailyTotals(fromEpochDay: Long, toEpochDay: Long): Flow<List<DailyTotalRow>>
}
