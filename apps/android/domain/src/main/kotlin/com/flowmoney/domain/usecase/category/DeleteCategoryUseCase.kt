package com.flowmoney.domain.usecase.category

import com.flowmoney.domain.common.Outcome
import com.flowmoney.domain.model.CategoryError
import com.flowmoney.domain.repository.CategoryRepository
import com.flowmoney.domain.repository.TransactionRepository
import javax.inject.Inject

/**
 * Elimina una categoría propia. No se borran las predeterminadas ni las que tienen
 * movimientos (borrarlas dejaría movimientos sin categoría).
 */
class DeleteCategoryUseCase @Inject constructor(
    private val repository: CategoryRepository,
    private val transactions: TransactionRepository,
) {
    suspend operator fun invoke(id: Long): Outcome<Unit, CategoryError> {
        val category = repository.getById(id) ?: return Outcome.Failure(CategoryError.NotFound)
        if (category.isDefault) return Outcome.Failure(CategoryError.DefaultCannotBeDeleted)
        val inUse = transactions.countByCategory(id)
        if (inUse > 0) return Outcome.Failure(CategoryError.InUse(inUse))
        repository.delete(id)
        return Outcome.Success(Unit)
    }
}
