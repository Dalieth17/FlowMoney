package com.flowmoney.domain.model

/**
 * Categoría para clasificar movimientos.
 *
 * @property icon clave de un ícono de Material (p. ej. "restaurant"); la capa de presentación la traduce.
 * @property color color en formato "#RRGGBB".
 * @property isDefault las predeterminadas vienen con la app y no se pueden eliminar.
 */
data class Category(
    val id: Long = 0,
    val name: String,
    val icon: String,
    val color: String,
    val isDefault: Boolean = false,
)
