package com.flowmoney.domain.repository

import com.flowmoney.domain.model.AppCurrency
import kotlinx.coroutines.flow.Flow

/** Preferencia de moneda de la persona. */
interface CurrencyRepository {
    /** Emite null mientras la persona no haya elegido (primer uso). */
    fun observe(): Flow<AppCurrency?>

    suspend fun set(currency: AppCurrency)
}
