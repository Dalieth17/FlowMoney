package com.flowmoney.domain.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MoneyTest {
    @Test
    fun `convierte lo que escribe el usuario a centimos`() {
        assertEquals(1250L, Money.parseToCents("12,50"))
        assertEquals(1250L, Money.parseToCents("12.5"))
        assertEquals(700L, Money.parseToCents(" 7 "))
        assertEquals(1L, Money.parseToCents("0.01"))
        assertEquals(Money.MAX_CENTS, Money.parseToCents("9999999999.99"))
    }

    @Test
    fun `acepta separadores de miles colombianos y estadounidenses`() {
        assertEquals(450_000_000L, Money.parseToCents("4.500.000"))
        assertEquals(450_000_000L, Money.parseToCents("4,500,000"))
        assertEquals(123_400L, Money.parseToCents("1.234"))
        assertEquals(123_450L, Money.parseToCents("1.234,50"))
        assertEquals(123_450L, Money.parseToCents("1,234.50"))
        assertEquals(Money.MAX_CENTS, Money.parseToCents("9.999.999.999,99"))
    }

    @Test
    fun `rechaza en lugar de redondear o adivinar`() {
        listOf(
            "", "abc", "-5", "12.3456", "1 000", ".5", "12.", "1.23.456", "1.234.56", "1,234,5678",
            "1.234.567,891", "1.234,567", "1,234,567.8.9", "1234.567", "99.999.999.999", "0.001", "0,500",
        ).forEach {
            assertNull("\"$it\" no es un monto válido", Money.parseToCents(it))
        }
    }

    @Test
    fun `formatea centimos para editar sin decimales vacios`() {
        assertEquals("12.50", Money.toInput(1250))
        assertEquals("0.07", Money.toInput(7))
        assertEquals("4500000", Money.toInput(450_000_000))
    }
}
