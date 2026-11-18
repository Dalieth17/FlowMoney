package com.flowmoney.domain.usecase.transaction

import com.flowmoney.domain.common.Outcome
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionError
import com.flowmoney.domain.model.TransactionRules
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.domain.repository.CategoryRepository
import com.flowmoney.domain.repository.TransactionRepository
import java.time.LocalDate
import javax.inject.Inject

/**
 * Datos del formulario. [amountCents] es null cuando lo escrito no es un monto válido
 * (ver `Money.parseToCents`); [categoryId] es null si aún no se eligió.
 */
data class TransactionDraft(
    val id: Long? = null,
    val amountCents: Long?,
    val description: String,
    val date: LocalDate,
    val type: TransactionType,
    val categoryId: Long?,
    val note: String? = null,
)

/** Crea o edita un movimiento aplicando las reglas de negocio. Devuelve el id guardado. */
class SaveTransactionUseCase @Inject constructor(
    private val transactions: TransactionRepository,
    private val categories: CategoryRepository,
) {
    suspend operator fun invoke(draft: TransactionDraft): Outcome<Long, TransactionError> {
        val amountCents = draft.amountCents ?: return Outcome.Failure(TransactionError.InvalidAmount)
        val description = TransactionRules.normalizeText(draft.description)
        val note = TransactionRules.normalizeNote(draft.note)
        TransactionRules.validate(amountCents, description, note)?.let { return Outcome.Failure(it) }

        val categoryId = draft.categoryId ?: return Outcome.Failure(TransactionError.CategoryRequired)
        if (categories.getById(categoryId) == null) return Outcome.Failure(TransactionError.CategoryNotFound)

        val transaction = Transaction(
            id = draft.id ?: 0,
            amountCents = amountCents,
            description = description,
            date = draft.date,
            type = draft.type,
            categoryId = categoryId,
            note = note,
        )
        if (draft.id == null) return Outcome.Success(transactions.insert(transaction))

        if (transactions.getById(draft.id) == null) return Outcome.Failure(TransactionError.NotFound)
        transactions.update(transaction)
        return Outcome.Success(draft.id)
    }
}
