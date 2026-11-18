package com.flowmoney.domain.model

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class MonthSummaryTest {
    private fun tx(cents: Long, type: TransactionType) =
        Transaction(amountCents = cents, description = "x", date = LocalDate.of(2026, 11, 1), type = type, categoryId = 1)

    @Test
    fun `suma exacta en centimos`() {
        // Con Double, 0.1 + 0.2 daría 0.30000000000000004.
        val summary = MonthSummary.of(
            listOf(tx(10, TransactionType.INCOME), tx(20, TransactionType.INCOME), tx(5, TransactionType.EXPENSE)),
        )
        assertEquals(30L, summary.incomeCents)
        assertEquals(5L, summary.expenseCents)
        assertEquals(25L, summary.balanceCents)
    }

    @Test
    fun `sin movimientos todo es cero`() {
        assertEquals(MonthSummary(0, 0), MonthSummary.of(emptyList()))
    }
}
