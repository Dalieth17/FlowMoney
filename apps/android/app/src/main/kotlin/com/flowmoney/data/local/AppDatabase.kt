package com.flowmoney.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.flowmoney.data.local.dao.BudgetDao
import com.flowmoney.data.local.dao.CategoryDao
import com.flowmoney.data.local.dao.TransactionDao
import com.flowmoney.data.local.entity.BudgetEntity
import com.flowmoney.data.local.entity.CategoryEntity
import com.flowmoney.data.local.entity.TransactionEntity

/**
 * Base de datos local (offline). Cada cambio de esquema sube [version] y añade una
 * migración en `migrations/Migrations.kt` (nunca se borran datos del usuario).
 *
 * v1: categorías · v2: `categories.name_key` (unicidad de nombres Unicode) · v3: movimientos ·
 * v4: presupuestos.
 */
@Database(
    entities = [CategoryEntity::class, TransactionEntity::class, BudgetEntity::class],
    version = 4,
    exportSchema = true,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun categoryDao(): CategoryDao

    abstract fun transactionDao(): TransactionDao

    abstract fun budgetDao(): BudgetDao

    companion object {
        const val NAME = "flowmoney.db"
    }
}
