package com.flowmoney.presentation.ui.movements

import com.flowmoney.domain.model.BudgetStatus
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.Money
import com.flowmoney.domain.model.MonthSummary
import com.flowmoney.domain.model.TransactionDetails
import com.flowmoney.domain.model.TransactionError
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.domain.usecase.transaction.TransactionDraft
import java.time.LocalDate
import java.time.YearMonth

/** Estado completo de la pantalla de movimientos. */
data class MovementsUiState(
    val month: YearMonth,
    val today: LocalDate,
    val isLoading: Boolean = true,
    val typeFilter: TransactionType? = null,
    val categoryFilter: Long? = null,
    val categories: List<Category> = emptyList(),
    val days: List<DayGroup> = emptyList(),
    val summary: MonthSummary = MonthSummary(),
    val editor: MovementEditorState? = null,
    val pendingDelete: DeleteRequest? = null,
) {
    val isFiltered: Boolean get() = typeFilter != null || categoryFilter != null
}

/** Movimientos de un mismo día (la lista se muestra agrupada por fecha). */
data class DayGroup(val date: LocalDate, val items: List<TransactionDetails>)

data class DeleteRequest(val id: Long, val description: String)

/** Formulario de movimiento. El monto se guarda como texto tal cual lo escribe el usuario. */
data class MovementEditorState(
    val date: LocalDate,
    val id: Long? = null,
    val type: TransactionType = TransactionType.EXPENSE,
    val amountText: String = "",
    val description: String = "",
    val categoryId: Long? = null,
    val note: String = "",
    val error: TransactionError? = null,
    val isSaving: Boolean = false,
) {
    val isNew: Boolean get() = id == null

    fun toDraft() = TransactionDraft(
        id = id,
        amountCents = Money.parseToCents(amountText),
        description = description,
        date = date,
        type = type,
        categoryId = categoryId,
        note = note,
    )

    companion object {
        fun from(details: TransactionDetails) = with(details.transaction) {
            MovementEditorState(
                id = id,
                date = date,
                type = type,
                amountText = Money.toInput(amountCents),
                description = description,
                categoryId = categoryId,
                note = note.orEmpty(),
            )
        }
    }
}

/** Intenciones del usuario (flujo unidireccional). */
sealed interface MovementsEvent {
    data object PreviousMonth : MovementsEvent

    data object NextMonth : MovementsEvent

    data class TypeFilterChanged(val type: TransactionType?) : MovementsEvent

    data class CategoryFilterChanged(val categoryId: Long?) : MovementsEvent

    data object ClearFilters : MovementsEvent

    data object AddClicked : MovementsEvent

    data class EditClicked(val details: TransactionDetails) : MovementsEvent

    data class TypeChanged(val type: TransactionType) : MovementsEvent

    data class AmountChanged(val text: String) : MovementsEvent

    data class DescriptionChanged(val text: String) : MovementsEvent

    data class CategorySelected(val categoryId: Long) : MovementsEvent

    data class DateSelected(val date: LocalDate) : MovementsEvent

    data class NoteChanged(val text: String) : MovementsEvent

    data object SaveClicked : MovementsEvent

    data object EditorDismissed : MovementsEvent

    data object DeleteClicked : MovementsEvent

    data object DeleteConfirmed : MovementsEvent

    data object DeleteDismissed : MovementsEvent
}

/** Avisos de una sola vez (snackbar). */
sealed interface MovementsMessage {
    data object Created : MovementsMessage

    data object Updated : MovementsMessage

    data object Deleted : MovementsMessage

    /** Se guardó un gasto y su categoría llegó al aviso del presupuesto (80 % o más). */
    data class BudgetAlert(val status: BudgetStatus) : MovementsMessage

    data class Failed(val error: TransactionError) : MovementsMessage
}
