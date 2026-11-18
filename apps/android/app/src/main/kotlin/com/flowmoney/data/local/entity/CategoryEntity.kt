package com.flowmoney.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Tabla `categories`.
 *
 * La unicidad del nombre se apoya en [nameKey] (ver `CategoryRules.nameKey`), no en `COLLATE NOCASE`:
 * NOCASE de SQLite solo pliega ASCII y dejaba pasar "Educación" y "EDUCACIÓN" (QA #5).
 * La columna `name` conserva su definición original para que una base migrada y una nueva sean idénticas.
 */
@Entity(
    tableName = "categories",
    indices = [Index(value = ["name_key"], unique = true)],
)
data class CategoryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(collate = ColumnInfo.NOCASE) val name: String,
    @ColumnInfo(name = "name_key", defaultValue = "") val nameKey: String,
    val icon: String,
    val color: String,
    @ColumnInfo(name = "is_default") val isDefault: Boolean,
)
