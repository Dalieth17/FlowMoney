package com.flowmoney.domain.usecase.category

import com.flowmoney.domain.common.Outcome
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.CategoryError
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.domain.testing.FakeCategoryRepository
import com.flowmoney.domain.testing.FakeTransactionRepository
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class DeleteCategoryUseCaseTest {
    private val salud = Category(id = 1, name = "Salud", icon = "medical_services", color = "#5B9E86", isDefault = true)
    private val mascotas = Category(id = 2, name = "Mascotas", icon = "pets", color = "#B0506B")
    private val repository = FakeCategoryRepository(listOf(salud, mascotas))
    private val transactions = FakeTransactionRepository(repository)
    private val delete = DeleteCategoryUseCase(repository, transactions)

    @Test
    fun `elimina una categoria propia`() = runTest {
        assertEquals(Outcome.Success(Unit), delete(2))
        assertEquals(listOf(salud), repository.current)
    }

    @Test
    fun `no elimina una categoria predeterminada`() = runTest {
        assertEquals(Outcome.Failure(CategoryError.DefaultCannotBeDeleted), delete(1))
        assertEquals(2, repository.current.size)
    }

    @Test
    fun `no elimina una categoria con movimientos`() = runTest {
        transactions.insert(
            Transaction(
                amountCents = 4000,
                description = "Veterinaria",
                date = LocalDate.of(2026, 11, 5),
                type = TransactionType.EXPENSE,
                categoryId = 2,
            ),
        )
        assertEquals(Outcome.Failure(CategoryError.InUse(1)), delete(2))
        assertEquals(2, repository.current.size)
    }

    @Test
    fun `informa si la categoria no existe`() = runTest {
        assertEquals(Outcome.Failure(CategoryError.NotFound), delete(99))
    }
}
