package com.flowmoney.domain.usecase.budget

import com.flowmoney.domain.model.Budget
import com.flowmoney.domain.model.BudgetLevel
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CheckBudgetUseCaseTest {
    private val data = BudgetTestData()
    private val check = CheckBudgetUseCase(data.budgets, data.categories, data.transactions)

    @Test
    fun `sin limite no hay estado`() = runTest {
        data.spend(5_000, data.food.id)
        assertNull(check(data.food.id, data.november))
    }

    @Test
    fun `devuelve el estado con lo gastado en el mes`() = runTest {
        data.budgets.upsert(Budget(data.food.id, data.november, 10_000))
        data.spend(10_500, data.food.id)

        val status = check(data.food.id, data.november)!!
        assertEquals(data.food, status.category)
        assertEquals(10_500L, status.spentCents)
        assertEquals(105, status.percent)
        assertEquals(BudgetLevel.OVER_LIMIT, status.level)
    }
}
