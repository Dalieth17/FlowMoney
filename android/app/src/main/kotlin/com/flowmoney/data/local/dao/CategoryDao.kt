package com.flowmoney.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import com.flowmoney.data.local.entity.CategoryEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CategoryDao {
    @Query("SELECT * FROM categories ORDER BY is_default DESC, name ASC")
    fun observeAll(): Flow<List<CategoryEntity>>

    @Query("SELECT * FROM categories WHERE id = :id")
    suspend fun getById(id: Long): CategoryEntity?

    /** La columna usa NOCASE, así que la comparación ignora mayúsculas. */
    @Query(
        "SELECT EXISTS(SELECT 1 FROM categories WHERE name = :name " +
            "AND (:excludingId IS NULL OR id != :excludingId))",
    )
    suspend fun existsByName(name: String, excludingId: Long?): Boolean

    @Insert
    suspend fun insert(category: CategoryEntity): Long

    @Update
    suspend fun update(category: CategoryEntity)

    @Query("DELETE FROM categories WHERE id = :id")
    suspend fun deleteById(id: Long): Int
}
