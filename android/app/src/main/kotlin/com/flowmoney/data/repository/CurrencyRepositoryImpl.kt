package com.flowmoney.data.repository

import android.content.SharedPreferences
import com.flowmoney.di.SettingsPreferences
import com.flowmoney.domain.model.AppCurrency
import com.flowmoney.domain.repository.CurrencyRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Guarda la moneda elegida en SharedPreferences (es un solo valor: no amerita una tabla de Room).
 * El valor se mantiene en memoria para que toda la app reaccione al instante cuando cambia.
 */
@Singleton
class CurrencyRepositoryImpl @Inject constructor(
    @SettingsPreferences private val preferences: SharedPreferences,
) : CurrencyRepository {
    private val current = MutableStateFlow(read())

    override fun observe(): Flow<AppCurrency?> = current.asStateFlow()

    override suspend fun set(currency: AppCurrency) {
        withContext(Dispatchers.IO) { preferences.edit().putString(KEY, currency.name).commit() }
        current.value = currency
    }

    // Un valor desconocido (p. ej. de una versión futura) cuenta como "sin elegir".
    private fun read(): AppCurrency? =
        preferences.getString(KEY, null)?.let { stored -> AppCurrency.entries.firstOrNull { it.name == stored } }

    private companion object {
        const val KEY = "currency"
    }
}
