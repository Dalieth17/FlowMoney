package com.flowmoney.domain.usecase.category

import com.flowmoney.domain.common.Outcome
import com.flowmoney.domain.model.CategoryError
import com.flowmoney.domain.repository.CategoryRepository
import javax.inject.Inject

/**
 * Elimina una categoría propia. Las predeterminadas no se pueden borrar.
 * (Con el módulo de Movimientos se añadirá: tampoco se borran las que tienen movimientos.)
 */
class DeleteCategoryUseCase @Inject constructor(
    private val repository: CategoryRepository,
) {
    suspend operator fun invoke(id: Long): Outcome<Unit, CategoryError> {
        val category = repository.getById(id) ?: return Outcome.Failure(CategoryError.NotFound)
        if (category.isDefault) return Outcome.Failure(CategoryError.DefaultCannotBeDeleted)
        repository.delete(id)
        return Outcome.Success(Unit)
    }
}
