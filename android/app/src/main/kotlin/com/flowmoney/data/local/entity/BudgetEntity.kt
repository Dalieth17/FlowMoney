package com.flowmoney.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index

/**
 * Tabla `budgets`: un límite por categoría y mes.
 * - `month`: entero aaaamm (202611), legible en la base y ordenable para buscar el mes anterior.
 * - Clave primaria (month, category_id): las consultas van por mes.
 * - `category_id` con CASCADE: borrar una categoría se lleva sus presupuestos.
 */
@Entity(
    tableName = "budgets",
    primaryKeys = ["month", "category_id"],
    foreignKeys = [
        ForeignKey(
            entity = CategoryEntity::class,
            parentColumns = ["id"],
            childColumns = ["category_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index(value = ["category_id"])],
)
data class BudgetEntity(
    val month: Int,
    @ColumnInfo(name = "category_id") val categoryId: Long,
    @ColumnInfo(name = "limit_cents") val limitCents: Long,
)
