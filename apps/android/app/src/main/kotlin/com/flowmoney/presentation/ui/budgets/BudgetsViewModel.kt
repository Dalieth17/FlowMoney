package com.flowmoney.presentation.ui.budgets

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.flowmoney.domain.common.Outcome
import com.flowmoney.domain.model.Budget
import com.flowmoney.domain.usecase.budget.BudgetDraft
import com.flowmoney.domain.usecase.budget.CopyBudgetsUseCase
import com.flowmoney.domain.usecase.budget.DeleteBudgetUseCase
import com.flowmoney.domain.usecase.budget.ObserveBudgetOverviewUseCase
import com.flowmoney.domain.usecase.budget.SaveBudgetUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Clock
import java.time.YearMonth
import javax.inject.Inject

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class BudgetsViewModel @Inject constructor(
    private val observeOverview: ObserveBudgetOverviewUseCase,
    private val saveBudget: SaveBudgetUseCase,
    private val deleteBudget: DeleteBudgetUseCase,
    private val copyBudgets: CopyBudgetsUseCase,
    clock: Clock,
) : ViewModel() {

    private val month = MutableStateFlow(YearMonth.now(clock))
    private val editor = MutableStateFlow<BudgetEditorState?>(null)

    private val _messages = Channel<BudgetsMessage>(Channel.BUFFERED)
    val messages: Flow<BudgetsMessage> = _messages.receiveAsFlow()

    // El mes viaja junto a su resumen: la pantalla nunca muestra un mes con datos de otro.
    private val overview = month.flatMapLatest { selected -> observeOverview(selected).map { selected to it } }

    val uiState: StateFlow<BudgetsUiState> =
        combine(overview, editor) { (selectedMonth, summary), openEditor ->
            BudgetsUiState(month = selectedMonth, isLoading = false, overview = summary, editor = openEditor)
        }.stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            initialValue = BudgetsUiState(month = month.value),
        )

    fun onEvent(event: BudgetsEvent) {
        when (event) {
            BudgetsEvent.PreviousMonth -> month.update { it.minusMonths(1) }
            BudgetsEvent.NextMonth -> month.update { it.plusMonths(1) }
            is BudgetsEvent.AddClicked -> editor.value = BudgetEditorState.create(event.spending, month.value)
            is BudgetsEvent.EditClicked -> editor.value = BudgetEditorState.edit(event.status, month.value)
            is BudgetsEvent.AmountChanged -> editor.update { it?.copy(amountText = event.text, error = null) }
            BudgetsEvent.SaveClicked -> save()
            BudgetsEvent.EditorDismissed -> editor.value = null
            BudgetsEvent.DeleteClicked -> delete()
            is BudgetsEvent.UndoDelete -> restore(event.budget)
            BudgetsEvent.CopyClicked -> copy()
        }
    }

    private fun save() {
        val current = editor.value ?: return
        if (current.isSaving) return // evita dobles toques
        editor.value = current.copy(isSaving = true, error = null)

        viewModelScope.launch {
            when (val result = saveBudget(current.toDraft())) {
                is Outcome.Success -> {
                    editor.value = null
                    _messages.send(BudgetsMessage.Saved(current.category.name))
                }
                is Outcome.Failure -> editor.update { it?.copy(isSaving = false, error = result.error) }
            }
        }
    }

    /** Sin diálogo de confirmación: el aviso ofrece "Deshacer", que es más rápido y igual de seguro. */
    private fun delete() {
        val current = editor.value ?: return
        if (current.isNew || current.isSaving) return
        editor.value = null

        viewModelScope.launch {
            when (val result = deleteBudget(current.category.id, current.month)) {
                is Outcome.Success -> _messages.send(BudgetsMessage.Deleted(current.category.name, result.value))
                is Outcome.Failure -> _messages.send(BudgetsMessage.Failed(result.error))
            }
        }
    }

    private fun restore(budget: Budget) {
        viewModelScope.launch {
            val result = saveBudget(BudgetDraft(budget.categoryId, budget.month, budget.limitCents))
            if (result is Outcome.Failure) _messages.send(BudgetsMessage.Failed(result.error))
        }
    }

    private fun copy() {
        val target = month.value
        viewModelScope.launch { _messages.send(BudgetsMessage.Copied(copyBudgets(target))) }
    }

    private companion object {
        const val STOP_TIMEOUT_MS = 5_000L
    }
}
