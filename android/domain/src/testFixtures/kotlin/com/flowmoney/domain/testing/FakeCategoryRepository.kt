package com.flowmoney.domain.testing

import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.CategoryRules
import com.flowmoney.domain.repository.CategoryRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update

/**
 * Repositorio en memoria para tests (dominio y ViewModels).
 * Respeta el mismo orden que la implementación real: predeterminadas primero, luego por nombre.
 */
class FakeCategoryRepository(initial: List<Category> = emptyList()) : CategoryRepository {
    private val state = MutableStateFlow(initial)
    private var nextId = (initial.maxOfOrNull { it.id } ?: 0L) + 1

    /** Contenido actual, para hacer aserciones. */
    val current: List<Category> get() = state.value

    override fun observeAll(): Flow<List<Category>> = state.map { list ->
        list.sortedWith(compareByDescending<Category> { it.isDefault }.thenBy { CategoryRules.nameKey(it.name) })
    }

    override suspend fun getById(id: Long): Category? = state.value.firstOrNull { it.id == id }

    override suspend fun existsByName(name: String, excludingId: Long?): Boolean {
        val key = CategoryRules.nameKey(name)
        return state.value.any { CategoryRules.nameKey(it.name) == key && it.id != excludingId }
    }

    override suspend fun insert(category: Category): Long {
        val id = nextId++
        state.update { it + category.copy(id = id) }
        return id
    }

    override suspend fun update(category: Category) {
        state.update { list -> list.map { if (it.id == category.id) category else it } }
    }

    override suspend fun delete(id: Long) {
        state.update { list -> list.filterNot { it.id == id } }
    }
}
