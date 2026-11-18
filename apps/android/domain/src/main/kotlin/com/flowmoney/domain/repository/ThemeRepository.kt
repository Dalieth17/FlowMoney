package com.flowmoney.domain.repository

import com.flowmoney.domain.model.AppTheme
import kotlinx.coroutines.flow.Flow

/** Preferencia de tema de la persona. */
interface ThemeRepository {
    /** Emite null mientras la persona no haya elegido (primer uso). */
    fun observe(): Flow<AppTheme?>

    suspend fun set(theme: AppTheme)
}
