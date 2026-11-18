package com.flowmoney.presentation.ui.categories

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.flowmoney.domain.common.Outcome
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.CategoryRules
import com.flowmoney.domain.usecase.category.DeleteCategoryUseCase
import com.flowmoney.domain.usecase.category.ObserveCategoriesUseCase
import com.flowmoney.domain.usecase.category.SaveCategoryUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class CategoriesViewModel @Inject constructor(
    observeCategories: ObserveCategoriesUseCase,
    private val saveCategory: SaveCategoryUseCase,
    private val deleteCategory: DeleteCategoryUseCase,
) : ViewModel() {

    private val editor = MutableStateFlow<CategoryEditorState?>(null)
    private val pendingDelete = MutableStateFlow<Category?>(null)

    private val _messages = Channel<CategoriesMessage>(Channel.BUFFERED)
    val messages: Flow<CategoriesMessage> = _messages.receiveAsFlow()

    val uiState: StateFlow<CategoriesUiState> =
        combine(observeCategories(), editor, pendingDelete) { categories, editor, pendingDelete ->
            CategoriesUiState(
                isLoading = false,
                custom = categories.filterNot { it.isDefault },
                defaults = categories.filter { it.isDefault },
                editor = editor,
                pendingDelete = pendingDelete,
            )
        }.stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            initialValue = CategoriesUiState(),
        )

    fun onEvent(event: CategoriesEvent) {
        when (event) {
            CategoriesEvent.AddClicked -> editor.value = CategoryEditorState()
            is CategoriesEvent.EditClicked -> editor.value = CategoryEditorState.from(event.category)
            is CategoriesEvent.NameChanged -> editor.update { it?.copy(name = event.value, error = null) }
            is CategoriesEvent.IconSelected -> editor.update { it?.copy(icon = event.key, error = null) }
            is CategoriesEvent.ColorSelected -> editor.update { it?.copy(color = event.hex, error = null) }
            CategoriesEvent.SaveClicked -> save()
            CategoriesEvent.EditorDismissed -> editor.value = null
            is CategoriesEvent.DeleteClicked -> pendingDelete.value = event.category
            CategoriesEvent.DeleteDismissed -> pendingDelete.value = null
            CategoriesEvent.DeleteConfirmed -> confirmDelete()
        }
    }

    private fun save() {
        val current = editor.value ?: return
        if (current.isSaving) return // evita dobles toques
        editor.value = current.copy(isSaving = true, error = null)

        viewModelScope.launch {
            when (val result = saveCategory(current.toDraft())) {
                is Outcome.Success -> {
                    editor.value = null
                    val message = if (current.isNew) {
                        CategoriesMessage.Created(CategoryRules.normalizeName(current.name))
                    } else {
                        CategoriesMessage.Updated
                    }
                    _messages.send(message)
                }
                is Outcome.Failure -> editor.update { it?.copy(isSaving = false, error = result.error) }
            }
        }
    }

    private fun confirmDelete() {
        val category = pendingDelete.value ?: return
        pendingDelete.value = null
        viewModelScope.launch {
            val message = when (val result = deleteCategory(category.id)) {
                is Outcome.Success -> CategoriesMessage.Deleted(category.name)
                is Outcome.Failure -> CategoriesMessage.Failed(result.error)
            }
            _messages.send(message)
        }
    }

    private companion object {
        // Mantiene la suscripción viva durante una rotación de pantalla.
        const val STOP_TIMEOUT_MS = 5_000L
    }
}
