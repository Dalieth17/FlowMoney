package com.flowmoney.domain.model

/** Totales de un conjunto de movimientos, en céntimos. */
data class MonthSummary(
    val incomeCents: Long = 0,
    val expenseCents: Long = 0,
) {
    val balanceCents: Long get() = incomeCents - expenseCents

    companion object {
        fun of(transactions: Iterable<Transaction>): MonthSummary {
            var income = 0L
            var expense = 0L
            for (t in transactions) {
                when (t.type) {
                    TransactionType.INCOME -> income = Math.addExact(income, t.amountCents)
                    TransactionType.EXPENSE -> expense = Math.addExact(expense, t.amountCents)
                }
            }
            return MonthSummary(income, expense)
        }
    }
}
