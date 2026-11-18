package com.flowmoney.domain.usecase.budget

import com.flowmoney.domain.common.Outcome
import com.flowmoney.domain.model.Budget
import com.flowmoney.domain.model.BudgetError
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.YearMonth

class DeleteAndCopyBudgetsUseCaseTest {
    private val data = BudgetTestData()
    private val delete = DeleteBudgetUseCase(data.budgets)
    private val copy = CopyBudgetsUseCase(data.budgets)

    @Test
    fun `quitar devuelve el presupuesto borrado para poder deshacer`() = runTest {
        val budget = Budget(data.food.id, data.november, 10_000)
        data.budgets.upsert(budget)

        assertEquals(Outcome.Success(budget), delete(data.food.id, data.november))
        assertTrue(data.budgets.current.isEmpty())
        assertEquals(Outcome.Failure(BudgetError.NotFound), delete(data.food.id, data.november))
    }

    @Test
    fun `copia los limites del ultimo mes con presupuestos sin pisar los existentes`() = runTest {
        val september = YearMonth.of(2026, 9)
        data.budgets.upsert(Budget(data.food.id, september, 10_000))
        data.budgets.upsert(Budget(data.transport.id, september, 5_000))
        data.budgets.upsert(Budget(data.transport.id, data.november, 7_000))

        assertEquals(1, copy(data.november))
        assertEquals(10_000L, data.budgets.get(data.food.id, data.november)?.limitCents)
        assertEquals(7_000L, data.budgets.get(data.transport.id, data.november)?.limitCents)

        // Repetirlo no duplica nada.
        assertEquals(0, copy(data.november))
    }

    @Test
    fun `sin meses anteriores no hay nada que copiar`() = runTest {
        assertEquals(0, copy(data.november))
        assertTrue(data.budgets.current.isEmpty())
    }
}
