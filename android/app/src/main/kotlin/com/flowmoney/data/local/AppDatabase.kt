package com.flowmoney.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.flowmoney.data.local.dao.CategoryDao
import com.flowmoney.data.local.entity.CategoryEntity

/**
 * Base de datos local (offline). Cada cambio de esquema sube [version] y añade una
 * migración en `migrations/Migrations.kt` (nunca se borran datos del usuario).
 *
 * v1: categorías · v2: `categories.name_key` (unicidad de nombres Unicode).
 */
@Database(
    entities = [CategoryEntity::class],
    version = 2,
    exportSchema = true,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun categoryDao(): CategoryDao

    companion object {
        const val NAME = "flowmoney.db"
    }
}
