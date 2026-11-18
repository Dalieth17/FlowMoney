package com.flowmoney.data.local

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.flowmoney.data.repository.CurrencyRepositoryImpl
import com.flowmoney.domain.model.AppCurrency
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** La moneda elegida sobrevive a reiniciar la app (otra instancia lee el mismo archivo). */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34])
class CurrencyRepositoryImplTest {
    private val preferences = ApplicationProvider.getApplicationContext<Context>()
        .getSharedPreferences("currency-test", Context.MODE_PRIVATE)

    @Before
    fun clear() {
        preferences.edit().clear().commit()
    }

    @Test
    fun `sin eleccion emite null y guarda la moneda elegida`() = runTest {
        val repository = CurrencyRepositoryImpl(preferences)
        assertNull(repository.observe().first())

        repository.set(AppCurrency.USD)

        assertEquals(AppCurrency.USD, repository.observe().first())
        assertEquals(AppCurrency.USD, CurrencyRepositoryImpl(preferences).observe().first())
    }

    @Test
    fun `un valor desconocido cuenta como sin elegir`() = runTest {
        preferences.edit().putString("currency", "EUR").commit()
        assertNull(CurrencyRepositoryImpl(preferences).observe().first())
    }
}
