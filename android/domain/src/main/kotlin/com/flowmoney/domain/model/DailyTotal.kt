package com.flowmoney.domain.model

import java.time.LocalDate

/** Total de un tipo de movimiento en un día. Los reportes se calculan a partir de estos totales. */
data class DailyTotal(
    val date: LocalDate,
    val type: TransactionType,
    val totalCents: Long,
)
