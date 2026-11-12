package com.flowmoney.presentation.ui.movements

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.flowmoney.domain.common.Outcome
import com.flowmoney.domain.model.MonthSummary
import com.flowmoney.domain.model.TransactionFilter
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.domain.usecase.category.ObserveCategoriesUseCase
import com.flowmoney.domain.usecase.transaction.DeleteTransactionUseCase
import com.flowmoney.domain.usecase.transaction.ObserveTransactionsUseCase
import com.flowmoney.domain.usecase.transaction.SaveTransactionUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Clock
import java.time.LocalDate
import java.time.YearMonth
import javax.inject.Inject

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class MovementsViewModel @Inject constructor(
    private val observeTransactions: ObserveTransactionsUseCase,
    observeCategories: ObserveCategoriesUseCase,
    private val saveTransaction: SaveTransactionUseCase,
    private val deleteTransaction: DeleteTransactionUseCase,
    private val clock: Clock,
) : ViewModel() {

    private val today: LocalDate get() = LocalDate.now(clock)

    private val filter = MutableStateFlow(TransactionFilter(month = YearMonth.from(today)))
    private val editor = MutableStateFlow<MovementEditorState?>(null)
    private val pendingDelete = MutableStateFlow<DeleteRequest?>(null)

    private val _messages = Channel<MovementsMessage>(Channel.BUFFERED)
    val messages: Flow<MovementsMessage> = _messages.receiveAsFlow()

    // Cambiar de mes o de filtro cancela la consulta anterior y abre una nueva.
    private val transactions = filter.flatMapLatest { observeTransactions(it) }

    val uiState: StateFlow<MovementsUiState> =
        combine(filter, transactions, observeCategories(), editor, pendingDelete) { filter, items, categories, editor, pending ->
            MovementsUiState(
                month = filter.month,
                today = today,
                isLoading = false,
                typeFilter = filter.type,
                categoryFilter = filter.categoryId,
                categories = categories,
                // La lista ya viene ordenada por fecha descendente; groupBy conserva ese orden.
                days = items.groupBy { it.transaction.date }.map { (date, dayItems) -> DayGroup(date, dayItems) },
                summary = MonthSummary.of(items.map { it.transaction }),
                editor = editor,
                pendingDelete = pending,
            )
        }.stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            initialValue = MovementsUiState(month = YearMonth.from(today), today = today),
        )

    fun onEvent(event: MovementsEvent) {
        when (event) {
            MovementsEvent.PreviousMonth -> filter.update { it.copy(month = it.month.minusMonths(1)) }
            MovementsEvent.NextMonth -> filter.update { it.copy(month = it.month.plusMonths(1)) }
            is MovementsEvent.TypeFilterChanged -> filter.update { it.copy(type = event.type) }
            is MovementsEvent.CategoryFilterChanged -> filter.update { it.copy(categoryId = event.categoryId) }
            MovementsEvent.ClearFilters -> filter.update { it.copy(type = null, categoryId = null) }

            MovementsEvent.AddClicked -> editor.value = newEditor()
            is MovementsEvent.EditClicked -> editor.value = MovementEditorState.from(event.details)
            is MovementsEvent.TypeChanged -> editor.update { it?.copy(type = event.type, error = null) }
            is MovementsEvent.AmountChanged -> editor.update { it?.copy(amountText = event.text, error = null) }
            is MovementsEvent.DescriptionChanged -> editor.update { it?.copy(description = event.text, error = null) }
            is MovementsEvent.CategorySelected -> editor.update { it?.copy(categoryId = event.categoryId, error = null) }
            is MovementsEvent.DateSelected -> editor.update { it?.copy(date = event.date, error = null) }
            is MovementsEvent.NoteChanged -> editor.update { it?.copy(note = event.text, error = null) }
            MovementsEvent.SaveClicked -> save()
            MovementsEvent.EditorDismissed -> editor.value = null

            MovementsEvent.DeleteClicked -> editor.value?.let { current ->
                current.id?.let { pendingDelete.value = DeleteRequest(it, current.description) }
            }
            MovementsEvent.DeleteDismissed -> pendingDelete.value = null
            MovementsEvent.DeleteConfirmed -> confirmDelete()
        }
    }

    /** Formulario nuevo con lo que el usuario ya está viendo: mes, tipo y categoría filtrados. */
    private fun newEditor(): MovementEditorState {
        val current = filter.value
        val date = if (YearMonth.from(today) == current.month) today else current.month.atDay(1)
        return MovementEditorState(
            date = date,
            type = current.type ?: TransactionType.EXPENSE,
            categoryId = current.categoryId,
        )
    }

    private fun save() {
        val current = editor.value ?: return
        if (current.isSaving) return // evita dobles toques
        editor.value = current.copy(isSaving = true, error = null)

        viewModelScope.launch {
            when (val result = saveTransaction(current.toDraft())) {
                is Outcome.Success -> {
                    editor.value = null
                    // Mostrar el mes donde quedó el movimiento, para que el usuario lo vea.
                    filter.update { it.copy(month = YearMonth.from(current.date)) }
                    _messages.send(if (current.isNew) MovementsMessage.Created else MovementsMessage.Updated)
                }
                is Outcome.Failure -> editor.update { it?.copy(isSaving = false, error = result.error) }
            }
        }
    }

    private fun confirmDelete() {
        val request = pendingDelete.value ?: return
        pendingDelete.value = null
        viewModelScope.launch {
            when (val result = deleteTransaction(request.id)) {
                is Outcome.Success -> {
                    editor.value = null
                    _messages.send(MovementsMessage.Deleted)
                }
                is Outcome.Failure -> _messages.send(MovementsMessage.Failed(result.error))
            }
        }
    }

    private companion object {
        const val STOP_TIMEOUT_MS = 5_000L
    }
}
