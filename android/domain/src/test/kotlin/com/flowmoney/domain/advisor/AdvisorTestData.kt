package com.flowmoney.domain.advisor

import com.flowmoney.domain.model.Budget
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.DefaultCategories
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionType
import java.time.LocalDate
import java.time.YearMonth

/** Escenarios compartidos por los tests del asesor. Hoy es 20 de noviembre de 2026 (mes de 30 días). */
internal class AdvisorTestData {
    val today: LocalDate = LocalDate.of(2026, 11, 20)
    val november: YearMonth = YearMonth.of(2026, 11)

    val categories: List<Category> = DefaultCategories.all.mapIndexed { index, category -> category.copy(id = index + 1L) }
    fun category(name: String) = categories.first { it.name == name }

    val food get() = category("Alimentación")
    val transport get() = category("Transporte")
    val fun_ get() = category("Entretenimiento")
    val home get() = category("Hogar")
    val salary get() = category("Salario")

    private var nextId = 1L
    val transactions = mutableListOf<Transaction>()
    val budgets = mutableListOf<Budget>()

    fun income(cents: Long, date: LocalDate, description: String = "Sueldo") = add(cents, date, TransactionType.INCOME, salary, description)

    fun expense(cents: Long, date: LocalDate, category: Category, description: String = "Gasto") =
        add(cents, date, TransactionType.EXPENSE, category, description)

    private fun add(cents: Long, date: LocalDate, type: TransactionType, category: Category, description: String) {
        transactions += Transaction(nextId++, cents, description, date, type, category.id)
    }

    /** Agosto, septiembre y octubre iguales: ingreso 4000, gastos 2500 (comida 1000, hogar 1200, transporte 300). */
    fun steadyHistory() {
        for (month in listOf(YearMonth.of(2026, 8), YearMonth.of(2026, 9), YearMonth.of(2026, 10))) {
            income(400_000, month.atDay(1))
            expense(100_000, month.atDay(5), food, "Mercado")
            expense(120_000, month.atDay(2), home, "Alquiler")
            expense(30_000, month.atDay(10), transport, "Pasajes")
        }
    }

    fun report(today: LocalDate = this.today): AdvisorReport =
        FinancialAdvisor.analyze(AdvisorInput(today, categories, transactions.toList(), budgets.toList()))
}
