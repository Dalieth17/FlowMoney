package com.flowmoney.data.local

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.flowmoney.data.repository.ThemeRepositoryImpl
import com.flowmoney.domain.model.AppTheme
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** El tema elegido sobrevive a reiniciar la app y no pisa la moneda (comparten archivo). */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34])
class ThemeRepositoryImplTest {
    private val preferences = ApplicationProvider.getApplicationContext<Context>()
        .getSharedPreferences("theme-test", Context.MODE_PRIVATE)

    @Before
    fun clear() {
        preferences.edit().clear().commit()
    }

    @Test
    fun `sin eleccion emite null y guarda el tema elegido`() = runTest {
        preferences.edit().putString("currency", "USD").commit()
        val repository = ThemeRepositoryImpl(preferences)
        assertNull(repository.observe().first())

        repository.set(AppTheme.MONO)

        assertEquals(AppTheme.MONO, ThemeRepositoryImpl(preferences).observe().first())
        assertEquals("USD", preferences.getString("currency", null))
    }

    @Test
    fun `un valor desconocido cuenta como sin elegir`() = runTest {
        preferences.edit().putString("theme", "SEPIA").commit()
        assertNull(ThemeRepositoryImpl(preferences).observe().first())
    }
}
