package com.flowmoney.domain.usecase.budget

import com.flowmoney.domain.common.Outcome
import com.flowmoney.domain.model.Budget
import com.flowmoney.domain.model.BudgetError
import com.flowmoney.domain.model.Money
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SaveBudgetUseCaseTest {
    private val data = BudgetTestData()
    private val save = SaveBudgetUseCase(data.budgets, data.categories)

    @Test
    fun `crea y luego reemplaza el limite del mismo mes`() = runTest {
        assertEquals(Outcome.Success(Unit), save(BudgetDraft(data.food.id, data.november, 30_000)))
        assertEquals(Outcome.Success(Unit), save(BudgetDraft(data.food.id, data.november, 25_000)))
        assertEquals(listOf(Budget(data.food.id, data.november, 25_000)), data.budgets.current)
    }

    @Test
    fun `cada mes tiene su propio limite`() = runTest {
        val december = data.november.plusMonths(1)
        save(BudgetDraft(data.food.id, data.november, 30_000))
        save(BudgetDraft(data.food.id, december, 35_000))
        assertEquals(30_000L, data.budgets.get(data.food.id, data.november)?.limitCents)
        assertEquals(35_000L, data.budgets.get(data.food.id, december)?.limitCents)
    }

    @Test
    fun `valida monto y categoria`() = runTest {
        assertEquals(Outcome.Failure(BudgetError.InvalidAmount), save(BudgetDraft(data.food.id, data.november, null)))
        assertEquals(Outcome.Failure(BudgetError.AmountTooSmall), save(BudgetDraft(data.food.id, data.november, 0)))
        assertEquals(
            Outcome.Failure(BudgetError.AmountTooLarge(Money.MAX_CENTS)),
            save(BudgetDraft(data.food.id, data.november, Money.MAX_CENTS + 1)),
        )
        assertEquals(Outcome.Failure(BudgetError.CategoryNotFound), save(BudgetDraft(99, data.november, 1_000)))
        assertTrue(data.budgets.current.isEmpty())
    }
}
