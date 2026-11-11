package com.flowmoney.data.repository

import com.flowmoney.data.local.dao.CategoryDao
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.repository.CategoryRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

/** Implementación con Room. Las funciones suspend de Room ya corren fuera del hilo principal. */
class CategoryRepositoryImpl @Inject constructor(
    private val dao: CategoryDao,
) : CategoryRepository {
    override fun observeAll(): Flow<List<Category>> =
        dao.observeAll().map { entities -> entities.map { it.toDomain() } }

    override suspend fun getById(id: Long): Category? = dao.getById(id)?.toDomain()

    override suspend fun existsByName(name: String, excludingId: Long?): Boolean =
        dao.existsByName(name, excludingId)

    override suspend fun insert(category: Category): Long = dao.insert(category.toEntity())

    override suspend fun update(category: Category) = dao.update(category.toEntity())

    override suspend fun delete(id: Long) {
        dao.deleteById(id)
    }
}
