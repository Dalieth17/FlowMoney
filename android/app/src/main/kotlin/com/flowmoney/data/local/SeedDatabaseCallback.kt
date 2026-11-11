package com.flowmoney.data.local

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.flowmoney.domain.model.DefaultCategories

/**
 * Inserta las categorías predeterminadas la primera vez que se crea la base de datos.
 * Corre dentro de la transacción de creación, así que la app nunca arranca "a medias".
 */
class SeedDatabaseCallback : RoomDatabase.Callback() {
    override fun onCreate(db: SupportSQLiteDatabase) {
        DefaultCategories.all.forEach { category ->
            val values = ContentValues().apply {
                put("name", category.name)
                put("icon", category.icon)
                put("color", category.color)
                put("is_default", if (category.isDefault) 1 else 0)
            }
            db.insert("categories", SQLiteDatabase.CONFLICT_IGNORE, values)
        }
    }
}
