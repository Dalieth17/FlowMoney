package com.flowmoney.presentation.ui.advisor

import com.flowmoney.domain.advisor.AdvisorAnswer
import com.flowmoney.domain.advisor.AdvisorReport

/** Secciones de la pantalla del asesor. */
enum class AdvisorTab { OVERVIEW, ASK }

/** Una pregunta y su respuesta (con las cifras del momento en que se preguntó). */
data class ChatEntry(val id: Long, val question: String, val answer: AdvisorAnswer)

/** Estado completo de la pantalla del asesor. [report] es null solo mientras carga. */
data class AdvisorUiState(
    val report: AdvisorReport? = null,
    val tab: AdvisorTab = AdvisorTab.OVERVIEW,
    val question: String = "",
    /** Conversación, de la más reciente a la más antigua. */
    val conversation: List<ChatEntry> = emptyList(),
) {
    val isLoading: Boolean get() = report == null
    val canAsk: Boolean get() = report != null && question.isNotBlank()
}

/** Intenciones del usuario (flujo unidireccional). */
sealed interface AdvisorEvent {
    data class TabSelected(val tab: AdvisorTab) : AdvisorEvent

    data class QuestionChanged(val text: String) : AdvisorEvent

    data object AskClicked : AdvisorEvent

    data class SuggestionClicked(val question: String) : AdvisorEvent

    data object ClearConversation : AdvisorEvent
}
