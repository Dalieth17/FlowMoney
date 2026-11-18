package com.flowmoney.presentation.format

import com.flowmoney.domain.model.AppCurrency
import com.flowmoney.domain.model.TransactionType
import org.junit.Assert.assertEquals
import org.junit.Test

class MoneyFormatterTest {
    private val cop = MoneyFormatter.of(AppCurrency.COP)
    private val usd = MoneyFormatter.of(AppCurrency.USD)

    @Test
    fun `pesos con punto de miles y sin decimales cuando no hay centavos`() {
        assertEquals("$ 4.500.000", cop.format(450_000_000))
        assertEquals("$ 0", cop.format(0))
        assertEquals("$ 1.234,50", cop.format(123_450))
        assertEquals("-$ 20.000", cop.format(-2_000_000))
        assertEquals("$", cop.symbol)
    }

    @Test
    fun `dolares con coma de miles y siempre dos decimales`() {
        assertEquals("US$ 1,234.56", usd.format(123_456))
        assertEquals("US$ 25.00", usd.format(2_500))
        assertEquals("-US$ 0.07", usd.format(-7))
        assertEquals("US$", usd.symbol)
    }

    @Test
    fun `signo segun el tipo de movimiento`() {
        assertEquals("+$ 10.000", cop.signed(1_000_000, TransactionType.INCOME))
        assertEquals("−US$ 10.00", usd.signed(1_000, TransactionType.EXPENSE))
    }

    @Test
    fun `por defecto se usan pesos colombianos`() {
        assertEquals(AppCurrency.COP, MoneyFormatter.Default.currency)
    }
}
