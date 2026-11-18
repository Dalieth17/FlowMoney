package com.flowmoney.domain.usecase.category

import com.flowmoney.domain.model.Category
import com.flowmoney.domain.repository.CategoryRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

/** Lista de categorías que se actualiza sola cuando cambian los datos. */
class ObserveCategoriesUseCase @Inject constructor(
    private val repository: CategoryRepository,
) {
    operator fun invoke(): Flow<List<Category>> = repository.observeAll()
}
