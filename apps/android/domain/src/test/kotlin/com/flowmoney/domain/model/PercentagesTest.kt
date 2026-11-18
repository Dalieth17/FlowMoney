package com.flowmoney.domain.model

import org.junit.Assert.assertEquals
import org.junit.Test

class PercentagesTest {
    @Test
    fun `reparte en proporcion cuando la division es exacta`() {
        assertEquals(listOf(50, 30, 20), Percentages.distribute(listOf(5_000, 3_000, 2_000)))
        assertEquals(listOf(100), Percentages.distribute(listOf(1)))
    }

    @Test
    fun `siempre suma 100 aunque cada parte no sea exacta`() {
        // Redondeando cada tercio por separado daria 33 + 33 + 33 = 99.
        assertEquals(listOf(34, 33, 33), Percentages.distribute(listOf(1, 1, 1)))
        // 16.67 % cada uno: redondeados sumarian 102.
        assertEquals(listOf(17, 17, 17, 17, 16, 16), Percentages.distribute(List(6) { 250L }))
        // El punto que falta va al resto mas grande, no al monto mas grande.
        assertEquals(listOf(66, 34), Percentages.distribute(listOf(1_987, 1_013)))
    }

    @Test
    fun `una parte minima puede quedar en cero pero la suma sigue siendo 100`() {
        assertEquals(listOf(100, 0), Percentages.distribute(listOf(999_999, 1)))
        assertEquals(listOf(99, 1), Percentages.distribute(listOf(9_940, 60)))
    }

    @Test
    fun `sin montos o con todo en cero devuelve ceros`() {
        assertEquals(emptyList<Int>(), Percentages.distribute(emptyList()))
        assertEquals(listOf(0, 0), Percentages.distribute(listOf(0, 0)))
        assertEquals(listOf(0, 100), Percentages.distribute(listOf(0, 7)))
    }

    @Test
    fun `no se desborda con montos enormes`() {
        val huge = Long.MAX_VALUE / 2
        assertEquals(listOf(50, 50), Percentages.distribute(listOf(huge, huge)))
        assertEquals(100, Percentages.distribute(listOf(huge, huge, 12_345)).sum())
    }

    @Test(expected = IllegalArgumentException::class)
    fun `rechaza montos negativos`() {
        Percentages.distribute(listOf(10, -1))
    }

    @Test
    fun `ratio redondea al entero mas cercano y admite negativos`() {
        assertEquals(33, Percentages.ratio(1, 3))
        assertEquals(67, Percentages.ratio(2, 3))
        assertEquals(125, Percentages.ratio(5, 4))
        assertEquals(1, Percentages.ratio(1, 200)) // 0.5 sube
        assertEquals(-1, Percentages.ratio(-1, 200)) // -0.5 se aleja de cero
        assertEquals(-250, Percentages.ratio(-5, 2))
        assertEquals(Int.MAX_VALUE, Percentages.ratio(Long.MAX_VALUE, 1))
    }
}
