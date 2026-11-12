package com.flowmoney.domain.usecase.transaction

import com.flowmoney.domain.common.Outcome
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionError
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.domain.testing.FakeCategoryRepository
import com.flowmoney.domain.testing.FakeTransactionRepository
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class DeleteTransactionUseCaseTest {
    private val existing = Transaction(
        id = 7,
        amountCents = 500,
        description = "Taxi",
        date = LocalDate.of(2026, 11, 2),
        type = TransactionType.EXPENSE,
        categoryId = 1,
    )
    private val repository = FakeTransactionRepository(FakeCategoryRepository(), listOf(existing))
    private val delete = DeleteTransactionUseCase(repository)

    @Test
    fun `elimina un movimiento`() = runTest {
        assertEquals(Outcome.Success(Unit), delete(7))
        assertTrue(repository.current.isEmpty())
    }

    @Test
    fun `informa si no existe`() = runTest {
        assertEquals(Outcome.Failure(TransactionError.NotFound), delete(8))
    }
}
