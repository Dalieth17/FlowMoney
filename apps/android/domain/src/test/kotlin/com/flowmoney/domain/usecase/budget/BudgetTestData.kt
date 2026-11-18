package com.flowmoney.domain.usecase.budget

import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.domain.testing.FakeBudgetRepository
import com.flowmoney.domain.testing.FakeCategoryRepository
import com.flowmoney.domain.testing.FakeTransactionRepository
import java.time.LocalDate
import java.time.YearMonth

/** Datos compartidos por los tests de presupuestos. */
internal class BudgetTestData {
    val november: YearMonth = YearMonth.of(2026, 11)

    val food = Category(id = 1, name = "Alimentación", icon = "restaurant", color = "#C25A44", isDefault = true)
    val transport = Category(id = 2, name = "Transporte", icon = "directions_bus", color = "#3E78A8", isDefault = true)
    val salary = Category(id = 3, name = "Salario", icon = "work", color = "#1F4D3A", isDefault = true)
    val pets = Category(id = 4, name = "Mascotas", icon = "pets", color = "#B0506B")

    val categories = FakeCategoryRepository(listOf(food, transport, salary, pets))
    val transactions = FakeTransactionRepository(categories)
    val budgets = FakeBudgetRepository()

    suspend fun spend(
        cents: Long,
        categoryId: Long,
        date: LocalDate = LocalDate.of(2026, 11, 5),
        type: TransactionType = TransactionType.EXPENSE,
    ) {
        transactions.insert(
            Transaction(amountCents = cents, description = "x", date = date, type = type, categoryId = categoryId),
        )
    }
}
