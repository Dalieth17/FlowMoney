package com.flowmoney.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Tabla `categories`. El nombre es único sin distinguir mayúsculas (collation NOCASE):
 * la base de datos protege la regla aunque falle una validación en capas superiores.
 */
@Entity(
    tableName = "categories",
    indices = [Index(value = ["name"], unique = true)],
)
data class CategoryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(collate = ColumnInfo.NOCASE) val name: String,
    val icon: String,
    val color: String,
    @ColumnInfo(name = "is_default") val isDefault: Boolean,
)
