package com.flowmoney.domain.repository

import com.flowmoney.domain.model.Category
import kotlinx.coroutines.flow.Flow

/** Contrato de acceso a categorías. La capa de datos lo implementa (Room). */
interface CategoryRepository {
    /** Todas las categorías: primero las predeterminadas, luego las demás; cada grupo por nombre. */
    fun observeAll(): Flow<List<Category>>

    suspend fun getById(id: Long): Category?

    /** true si existe otra categoría con ese nombre según [com.flowmoney.domain.model.CategoryRules.nameKey]. */
    suspend fun existsByName(name: String, excludingId: Long? = null): Boolean

    /** Inserta y devuelve el id generado. */
    suspend fun insert(category: Category): Long

    suspend fun update(category: Category)

    suspend fun delete(id: Long)
}
