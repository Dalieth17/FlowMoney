package com.flowmoney.presentation.ui.advisor

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.flowmoney.domain.usecase.advisor.AskAdvisorUseCase
import com.flowmoney.domain.usecase.advisor.ObserveAdvisorReportUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import java.time.Clock
import java.time.LocalDate
import javax.inject.Inject

/**
 * El análisis se recalcula solo cuando cambian movimientos, categorías o presupuestos. Las
 * preguntas se responden al instante con ese análisis: todo ocurre en el teléfono, sin red.
 */
@HiltViewModel
class AdvisorViewModel @Inject constructor(
    observeReport: ObserveAdvisorReportUseCase,
    private val ask: AskAdvisorUseCase,
    clock: Clock,
) : ViewModel() {

    private val tab = MutableStateFlow(AdvisorTab.OVERVIEW)
    private val question = MutableStateFlow("")
    private val conversation = MutableStateFlow<List<ChatEntry>>(emptyList())
    private var nextEntryId = 1L

    private val report = observeReport(LocalDate.now(clock))
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), null)

    val uiState: StateFlow<AdvisorUiState> =
        combine(report, tab, question, conversation) { currentReport, currentTab, text, entries ->
            AdvisorUiState(report = currentReport, tab = currentTab, question = text, conversation = entries)
        }.stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            initialValue = AdvisorUiState(),
        )

    fun onEvent(event: AdvisorEvent) {
        when (event) {
            is AdvisorEvent.TabSelected -> tab.value = event.tab
            is AdvisorEvent.QuestionChanged -> question.value = event.text.take(MAX_QUESTION_LENGTH)
            AdvisorEvent.AskClicked -> submit(question.value)
            is AdvisorEvent.SuggestionClicked -> submit(event.question)
            AdvisorEvent.ClearConversation -> conversation.value = emptyList()
        }
    }

    private fun submit(text: String) {
        val trimmed = text.trim()
        val currentReport = report.value
        if (trimmed.isEmpty() || currentReport == null) return
        val entry = ChatEntry(nextEntryId++, trimmed, ask(trimmed, currentReport))
        conversation.update { (listOf(entry) + it).take(MAX_ENTRIES) }
        question.value = ""
        tab.value = AdvisorTab.ASK
    }

    private companion object {
        const val STOP_TIMEOUT_MS = 5_000L
        const val MAX_QUESTION_LENGTH = 200
        const val MAX_ENTRIES = 20
    }
}
