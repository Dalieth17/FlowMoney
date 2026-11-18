package com.flowmoney.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import com.flowmoney.data.local.entity.CategoryEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CategoryDao {
    @Query("SELECT * FROM categories ORDER BY is_default DESC, name_key ASC")
    fun observeAll(): Flow<List<CategoryEntity>>

    @Query("SELECT * FROM categories WHERE id = :id")
    suspend fun getById(id: Long): CategoryEntity?

    /** [nameKey] debe venir de `CategoryRules.nameKey` (mismo cálculo que se guardó). */
    @Query(
        "SELECT EXISTS(SELECT 1 FROM categories WHERE name_key = :nameKey " +
            "AND (:excludingId IS NULL OR id != :excludingId))",
    )
    suspend fun existsByNameKey(nameKey: String, excludingId: Long?): Boolean

    @Insert
    suspend fun insert(category: CategoryEntity): Long

    @Update
    suspend fun update(category: CategoryEntity)

    @Query("DELETE FROM categories WHERE id = :id")
    suspend fun deleteById(id: Long): Int
}
