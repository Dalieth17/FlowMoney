package com.flowmoney.domain.usecase.transaction

import com.flowmoney.domain.common.Outcome
import com.flowmoney.domain.model.TransactionError
import com.flowmoney.domain.repository.TransactionRepository
import javax.inject.Inject

class DeleteTransactionUseCase @Inject constructor(
    private val repository: TransactionRepository,
) {
    suspend operator fun invoke(id: Long): Outcome<Unit, TransactionError> {
        if (repository.getById(id) == null) return Outcome.Failure(TransactionError.NotFound)
        repository.delete(id)
        return Outcome.Success(Unit)
    }
}
