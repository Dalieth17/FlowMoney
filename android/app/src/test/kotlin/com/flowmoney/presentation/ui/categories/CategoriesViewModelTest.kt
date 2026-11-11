package com.flowmoney.presentation.ui.categories

import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.CategoryError
import com.flowmoney.domain.model.DefaultCategories
import com.flowmoney.domain.testing.FakeCategoryRepository
import com.flowmoney.domain.usecase.category.DeleteCategoryUseCase
import com.flowmoney.domain.usecase.category.ObserveCategoriesUseCase
import com.flowmoney.domain.usecase.category.SaveCategoryUseCase
import com.flowmoney.testing.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CategoriesViewModelTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val defaults = DefaultCategories.all.mapIndexed { index, category -> category.copy(id = index + 1L) }
    private val repository = FakeCategoryRepository(defaults)

    // Se crea en @Before y no como propiedad: los inicializadores corren antes que las reglas
    // de JUnit, y viewModelScope necesita el Dispatchers.Main de test ya instalado.
    private lateinit var viewModel: CategoriesViewModel

    @Before
    fun setUp() {
        viewModel = CategoriesViewModel(
            ObserveCategoriesUseCase(repository),
            SaveCategoryUseCase(repository),
            DeleteCategoryUseCase(repository),
        )
    }

    /** uiState usa WhileSubscribed: hay que suscribirse para que emita. */
    private fun TestScope.subscribe(): MutableList<CategoriesMessage> {
        val messages = mutableListOf<CategoriesMessage>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect {} }
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.messages.toList(messages) }
        return messages
    }

    private val state get() = viewModel.uiState.value

    @Test
    fun `separa predeterminadas y propias`() = runTest {
        subscribe()
        assertFalse(state.isLoading)
        assertEquals(9, state.defaults.size)
        assertTrue(state.custom.isEmpty())
    }

    @Test
    fun `crear categoria cierra el editor y avisa`() = runTest {
        val messages = subscribe()
        viewModel.onEvent(CategoriesEvent.AddClicked)
        assertNotNull(state.editor)

        viewModel.onEvent(CategoriesEvent.NameChanged("  Mascotas "))
        viewModel.onEvent(CategoriesEvent.IconSelected("pets"))
        viewModel.onEvent(CategoriesEvent.ColorSelected("#B0506B"))
        viewModel.onEvent(CategoriesEvent.SaveClicked)

        assertNull(state.editor)
        assertEquals(listOf("Mascotas"), state.custom.map { it.name })
        assertEquals("pets", state.custom.single().icon)
        assertEquals(listOf<CategoriesMessage>(CategoriesMessage.Created("Mascotas")), messages)
    }

    @Test
    fun `un nombre repetido deja el editor abierto con el error`() = runTest {
        subscribe()
        viewModel.onEvent(CategoriesEvent.AddClicked)
        viewModel.onEvent(CategoriesEvent.NameChanged("salud"))
        viewModel.onEvent(CategoriesEvent.SaveClicked)

        val editor = state.editor
        assertNotNull(editor)
        assertEquals(CategoryError.DuplicateName, editor!!.error)
        assertFalse(editor.isSaving)

        // Al corregir el nombre, el error desaparece.
        viewModel.onEvent(CategoriesEvent.NameChanged("Salud mental"))
        assertNull(state.editor!!.error)
    }

    @Test
    fun `editar una predeterminada avisa cambios guardados`() = runTest {
        val messages = subscribe()
        val transporte = defaults.first { it.name == "Transporte" }

        viewModel.onEvent(CategoriesEvent.EditClicked(transporte))
        assertEquals("Transporte", state.editor!!.name)
        viewModel.onEvent(CategoriesEvent.ColorSelected("#4E86B0"))
        viewModel.onEvent(CategoriesEvent.SaveClicked)

        assertEquals("#4E86B0", repository.current.first { it.id == transporte.id }.color)
        assertTrue(repository.current.first { it.id == transporte.id }.isDefault)
        assertEquals(listOf<CategoriesMessage>(CategoriesMessage.Updated), messages)
    }

    @Test
    fun `eliminar pide confirmacion y luego borra`() = runTest {
        val messages = subscribe()
        val mascotas = Category(id = 50, name = "Mascotas", icon = "pets", color = "#B0506B")
        repository.insert(mascotas)
        val stored = state.custom.single()

        viewModel.onEvent(CategoriesEvent.DeleteClicked(stored))
        assertEquals(stored, state.pendingDelete)
        assertEquals(1, state.custom.size) // todavía no se borró

        viewModel.onEvent(CategoriesEvent.DeleteConfirmed)
        assertNull(state.pendingDelete)
        assertTrue(state.custom.isEmpty())
        assertEquals(listOf<CategoriesMessage>(CategoriesMessage.Deleted("Mascotas")), messages)
    }

    @Test
    fun `cancelar la eliminacion no borra nada`() = runTest {
        subscribe()
        viewModel.onEvent(CategoriesEvent.DeleteClicked(defaults.first()))
        viewModel.onEvent(CategoriesEvent.DeleteDismissed)
        assertNull(state.pendingDelete)
        assertEquals(9, state.defaults.size)
    }

    @Test
    fun `intentar borrar una predeterminada informa el error`() = runTest {
        val messages = subscribe()
        viewModel.onEvent(CategoriesEvent.DeleteClicked(defaults.first()))
        viewModel.onEvent(CategoriesEvent.DeleteConfirmed)

        assertEquals(9, state.defaults.size)
        assertEquals(
            listOf<CategoriesMessage>(CategoriesMessage.Failed(CategoryError.DefaultCannotBeDeleted)),
            messages,
        )
    }
}
