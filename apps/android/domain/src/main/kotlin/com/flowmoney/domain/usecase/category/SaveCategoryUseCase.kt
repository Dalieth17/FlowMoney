package com.flowmoney.domain.usecase.category

import com.flowmoney.domain.common.Outcome
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.CategoryError
import com.flowmoney.domain.model.CategoryRules
import com.flowmoney.domain.repository.CategoryRepository
import javax.inject.Inject

/** Datos que el usuario escribe en el formulario. [id] null = categoría nueva. */
data class CategoryDraft(
    val id: Long? = null,
    val name: String,
    val icon: String,
    val color: String,
)

/** Crea o edita una categoría aplicando las reglas de negocio. Devuelve el id guardado. */
class SaveCategoryUseCase @Inject constructor(
    private val repository: CategoryRepository,
) {
    suspend operator fun invoke(draft: CategoryDraft): Outcome<Long, CategoryError> {
        val name = CategoryRules.normalizeName(draft.name)
        val color = CategoryRules.normalizeColor(draft.color)
        CategoryRules.validate(name, draft.icon, color)?.let { return Outcome.Failure(it) }

        if (repository.existsByName(name, excludingId = draft.id)) {
            return Outcome.Failure(CategoryError.DuplicateName)
        }

        if (draft.id == null) {
            val id = repository.insert(Category(name = name, icon = draft.icon, color = color))
            return Outcome.Success(id)
        }

        // Al editar se conserva lo que el usuario no controla (p. ej. si es predeterminada).
        val current = repository.getById(draft.id) ?: return Outcome.Failure(CategoryError.NotFound)
        repository.update(current.copy(name = name, icon = draft.icon, color = color))
        return Outcome.Success(current.id)
    }
}
