package com.flowmoney.domain.testing

import com.flowmoney.domain.model.AppTheme
import com.flowmoney.domain.repository.ThemeRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow

class FakeThemeRepository(initial: AppTheme? = null) : ThemeRepository {
    val current = MutableStateFlow(initial)

    override fun observe(): Flow<AppTheme?> = current

    override suspend fun set(theme: AppTheme) {
        current.value = theme
    }
}
