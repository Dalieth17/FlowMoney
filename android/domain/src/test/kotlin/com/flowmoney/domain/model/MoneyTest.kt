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
    fun `rechaza en lugar de redondear o adivinar`() {
        listOf("", "abc", "-5", "12.345", "1,234.50", "1 000", ".5", "12.").forEach {
            assertNull("\"$it\" no es un monto válido", Money.parseToCents(it))
        }
    }

    @Test
    fun `formatea centimos para editar`() {
        assertEquals("12.50", Money.toInput(1250))
        assertEquals("0.07", Money.toInput(7))
    }
}
