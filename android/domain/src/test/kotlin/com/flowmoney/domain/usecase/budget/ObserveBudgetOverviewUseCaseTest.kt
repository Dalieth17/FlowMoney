package com.flowmoney.domain.usecase.budget

import com.flowmoney.domain.model.Budget
import com.flowmoney.domain.model.BudgetLevel
import com.flowmoney.domain.model.TransactionType
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.YearMonth

class ObserveBudgetOverviewUseCaseTest {
    private val data = BudgetTestData()
    private val observe = ObserveBudgetOverviewUseCase(data.budgets, data.categories, data.transactions)

    @Test
    fun `cruza los limites con el gasto del mes sin contar ingresos ni otros meses`() = runTest {
        data.budgets.upsert(Budget(data.food.id, data.november, 10_000))
        data.spend(6_000, data.food.id)
        data.spend(2_500, data.food.id, LocalDate.of(2026, 11, 30))
        data.spend(9_999, data.food.id, LocalDate.of(2026, 10, 31))
        data.spend(50_000, data.food.id, type = TransactionType.INCOME)

        val status = observe(data.november).first().budgets.single()
        assertEquals(data.food, status.category)
        assertEquals(8_500L, status.spentCents)
        assertEquals(BudgetLevel.NEAR_LIMIT, status.level)
    }

    @Test
    fun `sin presupuesto van primero las de mayor gasto y luego el orden habitual`() = runTest {
        data.budgets.upsert(Budget(data.food.id, data.november, 10_000))
        data.spend(300, data.pets.id)
        data.spend(1_200, data.transport.id)

        val unbudgeted = observe(data.november).first().unbudgeted
        assertEquals(listOf(data.transport, data.pets, data.salary), unbudgeted.map { it.category })
        assertEquals(listOf(1_200L, 300L, 0L), unbudgeted.map { it.spentCents })
    }

    @Test
    fun `ofrece copiar del ultimo mes con presupuestos sin contar los que ya existen`() = runTest {
        val august = YearMonth.of(2026, 8)
        data.budgets.upsert(Budget(data.food.id, august, 10_000))
        data.budgets.upsert(Budget(data.transport.id, august, 5_000))
        data.budgets.upsert(Budget(data.pets.id, YearMonth.of(2026, 7), 1_000))
        data.budgets.upsert(Budget(data.transport.id, data.november, 4_000))

        val overview = observe(data.november).first()
        assertEquals(august, overview.copySource)
        assertEquals(1, overview.copyableCount)
    }

    @Test
    fun `no ofrece copiar si no hay meses anteriores o el mes ya tiene todo`() = runTest {
        assertNull(observe(data.november).first().copySource)

        data.budgets.upsert(Budget(data.food.id, YearMonth.of(2026, 10), 10_000))
        data.budgets.upsert(Budget(data.food.id, data.november, 12_000))
        val overview = observe(data.november).first()
        assertNull(overview.copySource)
        assertEquals(0, overview.copyableCount)
    }

    @Test
    fun `ignora presupuestos de categorias que ya no existen`() = runTest {
        data.budgets.upsert(Budget(99, data.november, 10_000))
        data.budgets.upsert(Budget(99, YearMonth.of(2026, 10), 10_000))

        val overview = observe(data.november).first()
        assertTrue(overview.budgets.isEmpty())
        assertEquals(4, overview.unbudgeted.size)
        assertNull(overview.copySource)
    }
}
