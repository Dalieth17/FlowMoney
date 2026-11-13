package com.flowmoney.domain.testing

import com.flowmoney.domain.model.AppCurrency
import com.flowmoney.domain.repository.CurrencyRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow

class FakeCurrencyRepository(initial: AppCurrency? = null) : CurrencyRepository {
    val current = MutableStateFlow(initial)

    override fun observe(): Flow<AppCurrency?> = current

    override suspend fun set(currency: AppCurrency) {
        current.value = currency
    }
}
