package com.flowmoney.domain.model

import java.time.YearMonth

/** Qué movimientos ver: un mes y, opcionalmente, un tipo y una categoría. */
data class TransactionFilter(
    val month: YearMonth,
    val type: TransactionType? = null,
    val categoryId: Long? = null,
)
