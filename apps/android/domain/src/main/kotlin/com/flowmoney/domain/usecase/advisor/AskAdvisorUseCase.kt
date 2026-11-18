package com.flowmoney.domain.usecase.advisor

import com.flowmoney.domain.advisor.AdvisorAnswer
import com.flowmoney.domain.advisor.AdvisorQuestions
import com.flowmoney.domain.advisor.AdvisorReport
import javax.inject.Inject

/** Responde una pregunta en lenguaje natural con las cifras del análisis actual. */
class AskAdvisorUseCase @Inject constructor() {
    operator fun invoke(question: String, report: AdvisorReport): AdvisorAnswer = AdvisorQuestions.answer(question, report)
}
