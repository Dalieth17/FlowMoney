package com.flowmoney.domain.usecase.category

import com.flowmoney.domain.model.Category
import com.flowmoney.domain.testing.FakeCategoryRepository
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class ObserveCategoriesUseCaseTest {
    @Test
    fun `entrega predeterminadas primero y luego por nombre`() = runTest {
        val repository = FakeCategoryRepository(
            listOf(
                Category(id = 1, name = "viajes", icon = "flight", color = "#3E78A8"),
                Category(id = 2, name = "Salud", icon = "medical_services", color = "#5B9E86", isDefault = true),
                Category(id = 3, name = "Arte", icon = "category", color = "#8A94A6"),
            ),
        )
        val names = ObserveCategoriesUseCase(repository)().first().map { it.name }
        assertEquals(listOf("Salud", "Arte", "viajes"), names)
    }
}
