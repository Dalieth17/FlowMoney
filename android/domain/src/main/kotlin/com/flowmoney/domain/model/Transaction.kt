package com.flowmoney.domain.model

import java.time.LocalDate

/**
 * Movimiento de dinero (ingreso o gasto).
 *
 * @property amountCents monto en céntimos, siempre positivo; el signo lo da [type].
 *   Se usan enteros para que 0.1 + 0.2 sea exactamente 0.3 (sin errores de coma flotante).
 * @property date día del movimiento, sin hora ni zona horaria.
 */
data class Transaction(
    val id: Long = 0,
    val amountCents: Long,
    val description: String,
    val date: LocalDate,
    val type: TransactionType,
    val categoryId: Long,
    val note: String? = null,
)

/** Movimiento junto a su categoría, como se muestra en las listas. */
data class TransactionDetails(
    val transaction: Transaction,
    val category: Category,
)
