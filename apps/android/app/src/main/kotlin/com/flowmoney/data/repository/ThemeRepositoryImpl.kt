package com.flowmoney.data.repository

import android.content.SharedPreferences
import com.flowmoney.di.SettingsPreferences
import com.flowmoney.domain.model.AppTheme
import com.flowmoney.domain.repository.ThemeRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/** Guarda el tema elegido junto a la moneda; en memoria para que la app cambie al instante. */
@Singleton
class ThemeRepositoryImpl @Inject constructor(
    @SettingsPreferences private val preferences: SharedPreferences,
) : ThemeRepository {
    private val current = MutableStateFlow(read())

    override fun observe(): Flow<AppTheme?> = current.asStateFlow()

    override suspend fun set(theme: AppTheme) {
        withContext(Dispatchers.IO) { preferences.edit().putString(KEY, theme.name).commit() }
        current.value = theme
    }

    // Un valor desconocido (p. ej. de una versión futura) cuenta como "sin elegir".
    private fun read(): AppTheme? =
        preferences.getString(KEY, null)?.let { stored -> AppTheme.entries.firstOrNull { it.name == stored } }

    private companion object {
        const val KEY = "theme"
    }
}
