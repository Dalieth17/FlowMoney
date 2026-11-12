package com.flowmoney.domain.model

import java.time.YearMonth

/**
 * Límite de gasto de una categoría en un mes. Cada mes tiene sus propios límites (igual que la
 * web): ajustar el presupuesto de este mes no reescribe el historial de los anteriores.
 */
data class Budget(
    val categoryId: Long,
    val month: YearMonth,
    val limitCents: Long,
)
