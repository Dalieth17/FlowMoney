package com.flowmoney.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import com.flowmoney.domain.model.TransactionType

/**
 * Tabla `transactions`.
 * - `amount_cents`: céntimos (entero) para no acumular errores de coma flotante.
 * - `date_epoch_day`: días desde 1970-01-01; un día no depende de la zona horaria.
 * - `category_id` con RESTRICT: la base impide borrar una categoría que tiene movimientos.
 */
@Entity(
    tableName = "transactions",
    foreignKeys = [
        ForeignKey(
            entity = CategoryEntity::class,
            parentColumns = ["id"],
            childColumns = ["category_id"],
            onDelete = ForeignKey.RESTRICT,
        ),
    ],
    indices = [Index(value = ["category_id"]), Index(value = ["date_epoch_day"])],
)
data class TransactionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "amount_cents") val amountCents: Long,
    val description: String,
    @ColumnInfo(name = "date_epoch_day") val dateEpochDay: Long,
    val type: TransactionType,
    @ColumnInfo(name = "category_id") val categoryId: Long,
    val note: String?,
)

/** Fila del JOIN movimiento + categoría (las columnas de la categoría llevan el prefijo `cat_`). */
data class TransactionWithCategoryRow(
    @Embedded val transaction: TransactionEntity,
    @Embedded(prefix = "cat_") val category: CategoryEntity,
)

/** Fila de una suma agrupada por categoría. */
data class CategoryTotalRow(
    @ColumnInfo(name = "category_id") val categoryId: Long,
    @ColumnInfo(name = "total_cents") val totalCents: Long,
)
