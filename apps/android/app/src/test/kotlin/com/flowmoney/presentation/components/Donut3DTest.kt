package com.flowmoney.presentation.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class Donut3DTest {
    @Test
    fun `las porciones cubren la vuelta empezando arriba y la mayor es la mas alta`() {
        val slices = donutSlices(listOf(500, 300, 200), gapDeg = 0f)

        assertEquals(-90f, slices.first().startDeg, 1e-3f)
        assertEquals(360f, slices.sumOf { it.sweepDeg.toDouble() }.toFloat(), 1e-3f)
        assertEquals(180f, slices[0].sweepDeg, 1e-3f)
        assertEquals(1f, slices[0].height, 1e-6f)
        assertTrue(slices[1].height < slices[0].height && slices[2].height < slices[1].height)
        assertTrue(slices.all { it.height >= 0.25f })
    }

    @Test
    fun `sin gasto no hay porciones y con una sola no hay separacion`() {
        assertTrue(donutSlices(listOf(0, 0)).isEmpty())
        val one = donutSlices(listOf(42))
        assertEquals(360f, one.single().sweepDeg, 1e-3f)
    }
}
