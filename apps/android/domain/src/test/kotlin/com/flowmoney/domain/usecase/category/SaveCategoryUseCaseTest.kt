package com.flowmoney.domain.usecase.category

import com.flowmoney.domain.common.Outcome
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.CategoryError
import com.flowmoney.domain.testing.FakeCategoryRepository
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SaveCategoryUseCaseTest {
    private val salud = Category(id = 1, name = "Salud", icon = "medical_services", color = "#5B9E86", isDefault = true)
    private val repository = FakeCategoryRepository(listOf(salud))
    private val save = SaveCategoryUseCase(repository)

    @Test
    fun `crea una categoria con nombre y color normalizados`() = runTest {
        val result = save(CategoryDraft(name = "  Mascotas  ", icon = "pets", color = "#b0506b"))

        assertTrue(result is Outcome.Success)
        val created = repository.current.single { it.id == (result as Outcome.Success).value }
        assertEquals("Mascotas", created.name)
        assertEquals("#B0506B", created.color)
        assertEquals(false, created.isDefault)
    }

    @Test
    fun `rechaza datos invalidos sin tocar el repositorio`() = runTest {
        assertEquals(Outcome.Failure(CategoryError.BlankName), save(CategoryDraft(name = "   ", icon = "pets", color = "#B0506B")))
        assertEquals(Outcome.Failure(CategoryError.InvalidColor), save(CategoryDraft(name = "Mascotas", icon = "pets", color = "azul")))
        assertEquals(1, repository.current.size)
    }

    @Test
    fun `no permite nombres repetidos aunque cambien las mayusculas`() = runTest {
        val result = save(CategoryDraft(name = "SALUD", icon = "pets", color = "#B0506B"))
        assertEquals(Outcome.Failure(CategoryError.DuplicateName), result)
    }

    @Test
    fun `no permite duplicados que solo difieren en mayusculas con tilde (QA 5)`() = runTest {
        save(CategoryDraft(name = "Educación", icon = "school", color = "#D9A648"))
        val result = save(CategoryDraft(name = "EDUCACIÓN", icon = "school", color = "#3E78A8"))
        assertEquals(Outcome.Failure(CategoryError.DuplicateName), result)
    }

    @Test
    fun `editar conserva si es predeterminada y permite su propio nombre`() = runTest {
        val result = save(CategoryDraft(id = 1, name = "Salud", icon = "fitness_center", color = "#3E78A8"))

        assertEquals(Outcome.Success(1L), result)
        val edited = repository.current.single()
        assertEquals("fitness_center", edited.icon)
        assertEquals("#3E78A8", edited.color)
        assertEquals(true, edited.isDefault)
    }

    @Test
    fun `editar una categoria que ya no existe falla`() = runTest {
        val result = save(CategoryDraft(id = 99, name = "Fantasma", icon = "pets", color = "#B0506B"))
        assertEquals(Outcome.Failure(CategoryError.NotFound), result)
    }
}
