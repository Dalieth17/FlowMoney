package com.flowmoney.domain.usecase.advisor

import com.flowmoney.domain.advisor.CategoryClassifier
import com.flowmoney.domain.advisor.CategorySuggestion
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.domain.repository.TransactionRepository
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate
import javax.inject.Inject

/** Sugiere la categoría de un movimiento a partir de su descripción y de tu historial. */
class SuggestCategoryUseCase @Inject constructor(
    private val transactions: TransactionRepository,
) {
    /** Historial con el que aprende: los últimos [HISTORY_MONTHS] meses. */
    fun observeHistory(today: LocalDate): Flow<List<Transaction>> =
        transactions.observeRange(today.minusMonths(HISTORY_MONTHS), today.plusYears(1))

    operator fun invoke(
        description: String,
        type: TransactionType,
        categories: List<Category>,
        history: List<Transaction>,
    ): CategorySuggestion? = CategoryClassifier.suggest(description, type, categories, history)

    private companion object {
        const val HISTORY_MONTHS = 6L
    }
}
