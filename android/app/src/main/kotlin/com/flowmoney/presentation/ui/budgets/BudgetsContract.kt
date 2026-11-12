package com.flowmoney.presentation.ui.budgets

import com.flowmoney.domain.model.Budget
import com.flowmoney.domain.model.BudgetError
import com.flowmoney.domain.model.BudgetOverview
import com.flowmoney.domain.model.BudgetStatus
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.CategorySpending
import com.flowmoney.domain.model.Money
import com.flowmoney.domain.usecase.budget.BudgetDraft
import java.time.YearMonth

/** Estado completo de la pantalla de presupuestos. */
data class BudgetsUiState(
    val month: YearMonth,
    val isLoading: Boolean = true,
    val overview: BudgetOverview = BudgetOverview(),
    val editor: BudgetEditorState? = null,
)

/** Formulario del límite de una categoría en un mes. El monto se guarda tal cual lo escribe el usuario. */
data class BudgetEditorState(
    val category: Category,
    val month: YearMonth,
    val spentCents: Long,
    val isNew: Boolean,
    val amountText: String = "",
    val error: BudgetError? = null,
    val isSaving: Boolean = false,
) {
    fun toDraft() = BudgetDraft(categoryId = category.id, month = month, limitCents = Money.parseToCents(amountText))

    companion object {
        fun create(spending: CategorySpending, month: YearMonth) = BudgetEditorState(
            category = spending.category,
            month = month,
            spentCents = spending.spentCents,
            isNew = true,
        )

        fun edit(status: BudgetStatus, month: YearMonth) = BudgetEditorState(
            category = status.category,
            month = month,
            spentCents = status.spentCents,
            isNew = false,
            amountText = Money.toInput(status.limitCents),
        )
    }
}

/** Intenciones del usuario (flujo unidireccional). */
sealed interface BudgetsEvent {
    data object PreviousMonth : BudgetsEvent

    data object NextMonth : BudgetsEvent

    /** Toque en una categoría sin presupuesto. */
    data class AddClicked(val spending: CategorySpending) : BudgetsEvent

    data class EditClicked(val status: BudgetStatus) : BudgetsEvent

    data class AmountChanged(val text: String) : BudgetsEvent

    data object SaveClicked : BudgetsEvent

    data object EditorDismissed : BudgetsEvent

    data object DeleteClicked : BudgetsEvent

    data class UndoDelete(val budget: Budget) : BudgetsEvent

    data object CopyClicked : BudgetsEvent
}

/** Avisos de una sola vez (snackbar). */
sealed interface BudgetsMessage {
    data class Saved(val categoryName: String) : BudgetsMessage

    /** Lleva el presupuesto borrado para ofrecer "Deshacer". */
    data class Deleted(val categoryName: String, val budget: Budget) : BudgetsMessage

    data class Copied(val count: Int) : BudgetsMessage

    data class Failed(val error: BudgetError) : BudgetsMessage
}
