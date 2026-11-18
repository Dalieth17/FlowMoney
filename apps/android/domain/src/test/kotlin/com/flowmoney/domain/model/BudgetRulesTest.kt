package com.flowmoney.domain.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BudgetRulesTest {
    private fun category(id: Long, name: String) = Category(id = id, name = name, icon = "category", color = "#8A94A6")

    @Test
    fun `niveles con los mismos umbrales que la web`() {
        assertEquals(BudgetLevel.ON_TRACK, BudgetRules.levelOf(0, 10_000))
        assertEquals(BudgetLevel.ON_TRACK, BudgetRules.levelOf(7_999, 10_000))
        assertEquals(BudgetLevel.NEAR_LIMIT, BudgetRules.levelOf(8_000, 10_000))
        assertEquals(BudgetLevel.NEAR_LIMIT, BudgetRules.levelOf(9_999, 10_000))
        assertEquals(BudgetLevel.OVER_LIMIT, BudgetRules.levelOf(10_000, 10_000))
        assertEquals(BudgetLevel.OVER_LIMIT, BudgetRules.levelOf(12_000, 10_000))
    }

    @Test
    fun `el porcentaje se redondea hacia abajo y coincide con el nivel`() {
        assertEquals(0, BudgetRules.percentOf(0, 10_000))
        assertEquals(79, BudgetRules.percentOf(7_999, 10_000))
        assertEquals(80, BudgetRules.percentOf(8_000, 10_000))
        assertEquals(99, BudgetRules.percentOf(9_999, 10_000))
        assertEquals(120, BudgetRules.percentOf(12_000, 10_000))
        // Con un limite de 3 centimos, 2 son el 66 % (no 67) y siguen "en control".
        assertEquals(66, BudgetRules.percentOf(2, 3))
        assertEquals(BudgetLevel.ON_TRACK, BudgetRules.levelOf(2, 3))
        // 4 de 5 centimos es exactamente el 80 %.
        assertEquals(BudgetLevel.NEAR_LIMIT, BudgetRules.levelOf(4, 5))
    }

    @Test
    fun `valida el limite`() {
        assertEquals(BudgetError.AmountTooSmall, BudgetRules.validate(0))
        assertEquals(BudgetError.AmountTooSmall, BudgetRules.validate(-500))
        assertNull(BudgetRules.validate(1))
        assertNull(BudgetRules.validate(Money.MAX_CENTS))
        assertEquals(BudgetError.AmountTooLarge(Money.MAX_CENTS), BudgetRules.validate(Money.MAX_CENTS + 1))
    }

    @Test
    fun `estado de un presupuesto excedido`() {
        val status = BudgetStatus(category(1, "Comida"), limitCents = 30_000, spentCents = 31_250)
        assertEquals(-1_250L, status.remainingCents)
        assertEquals(104, status.percent)
        assertEquals(BudgetLevel.OVER_LIMIT, status.level)
    }

    @Test
    fun `el resumen suma solo las categorias con presupuesto`() {
        val overview = BudgetOverview(
            budgets = listOf(
                BudgetStatus(category(1, "Comida"), 10_000, 9_000),
                BudgetStatus(category(2, "Transporte"), 5_000, 6_000),
                BudgetStatus(category(3, "Salud"), 20_000, 0),
            ),
            unbudgeted = listOf(CategorySpending(category(4, "Otros"), 700)),
        )
        assertEquals(35_000L, overview.limitCents)
        assertEquals(15_000L, overview.spentCents)
        assertEquals(20_000L, overview.remainingCents)
        assertEquals(700L, overview.unbudgetedSpentCents)
        assertEquals(1, overview.nearLimitCount)
        assertEquals(1, overview.overLimitCount)
        assertEquals(BudgetLevel.ON_TRACK, overview.level)
        assertNull(BudgetOverview().level)
    }
}
