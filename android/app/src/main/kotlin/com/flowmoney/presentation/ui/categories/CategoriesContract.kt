package com.flowmoney.presentation.ui.categories

import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.CategoryError
import com.flowmoney.domain.usecase.category.CategoryDraft
import com.flowmoney.presentation.components.CategoryPalette
import com.flowmoney.presentation.components.DEFAULT_CATEGORY_ICON

/** Estado completo de la pantalla: la UI solo dibuja lo que hay aquí. */
data class CategoriesUiState(
    val isLoading: Boolean = true,
    val custom: List<Category> = emptyList(),
    val defaults: List<Category> = emptyList(),
    val editor: CategoryEditorState? = null,
    val pendingDelete: Category? = null,
)

/** Formulario abierto (crear si [id] es null, editar si no). */
data class CategoryEditorState(
    val id: Long? = null,
    val name: String = "",
    val icon: String = DEFAULT_CATEGORY_ICON,
    val color: String = CategoryPalette.DEFAULT_COLOR,
    val error: CategoryError? = null,
    val isSaving: Boolean = false,
) {
    val isNew: Boolean get() = id == null

    fun toDraft() = CategoryDraft(id = id, name = name, icon = icon, color = color)

    companion object {
        fun from(category: Category) = CategoryEditorState(
            id = category.id,
            name = category.name,
            icon = category.icon,
            color = category.color,
        )
    }
}

/** Intenciones del usuario (flujo unidireccional: UI → ViewModel). */
sealed interface CategoriesEvent {
    data object AddClicked : CategoriesEvent

    data class EditClicked(val category: Category) : CategoriesEvent

    data class NameChanged(val value: String) : CategoriesEvent

    data class IconSelected(val key: String) : CategoriesEvent

    data class ColorSelected(val hex: String) : CategoriesEvent

    data object SaveClicked : CategoriesEvent

    data object EditorDismissed : CategoriesEvent

    data class DeleteClicked(val category: Category) : CategoriesEvent

    data object DeleteConfirmed : CategoriesEvent

    data object DeleteDismissed : CategoriesEvent
}

/** Avisos de una sola vez (snackbar). Sin textos: la UI los traduce con recursos. */
sealed interface CategoriesMessage {
    data class Created(val name: String) : CategoriesMessage

    data object Updated : CategoriesMessage

    data class Deleted(val name: String) : CategoriesMessage

    data class Failed(val error: CategoryError) : CategoriesMessage
}
