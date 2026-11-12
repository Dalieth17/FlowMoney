package com.flowmoney.domain.usecase.transaction

import com.flowmoney.domain.common.Outcome
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.TransactionError
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.domain.testing.FakeCategoryRepository
import com.flowmoney.domain.testing.FakeTransactionRepository
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class SaveTransactionUseCaseTest {
    private val comida = Category(id = 1, name = "Alimentación", icon = "restaurant", color = "#C25A44")
    private val categories = FakeCategoryRepository(listOf(comida))
    private val transactions = FakeTransactionRepository(categories)
    private val save = SaveTransactionUseCase(transactions, categories)

    private fun draft(
        amountCents: Long? = 1250,
        description: String = "Almuerzo",
        categoryId: Long? = 1,
        note: String? = null,
        id: Long? = null,
    ) = TransactionDraft(
        id = id,
        amountCents = amountCents,
        description = description,
        date = LocalDate.of(2026, 11, 12),
        type = TransactionType.EXPENSE,
        categoryId = categoryId,
        note = note,
    )

    @Test
    fun `crea un movimiento con textos normalizados`() = runTest {
        val result = save(draft(description = "  Almuerzo   de  trabajo ", note = "   "))
        assertTrue(result is Outcome.Success)
        val saved = transactions.current.single()
        assertEquals("Almuerzo de trabajo", saved.description)
        assertNull("una nota en blanco se guarda como null", saved.note)
        assertEquals(1250L, saved.amountCents)
    }

    @Test
    fun `valida monto, descripcion, nota y categoria`() = runTest {
        assertEquals(Outcome.Failure(TransactionError.InvalidAmount), save(draft(amountCents = null)))
        assertEquals(Outcome.Failure(TransactionError.AmountTooSmall), save(draft(amountCents = 0)))
        assertEquals(Outcome.Failure(TransactionError.BlankDescription), save(draft(description = "  ")))
        assertEquals(Outcome.Failure(TransactionError.NoteTooLong(200)), save(draft(note = "n".repeat(201))))
        assertEquals(Outcome.Failure(TransactionError.CategoryRequired), save(draft(categoryId = null)))
        assertEquals(Outcome.Failure(TransactionError.CategoryNotFound), save(draft(categoryId = 99)))
        assertTrue(transactions.current.isEmpty())
    }

    @Test
    fun `edita un movimiento existente y falla si ya no existe`() = runTest {
        val id = (save(draft()) as Outcome.Success).value
        assertEquals(Outcome.Success(id), save(draft(id = id, amountCents = 3000)))
        assertEquals(3000L, transactions.current.single().amountCents)
        assertEquals(Outcome.Failure(TransactionError.NotFound), save(draft(id = 404)))
    }
}
