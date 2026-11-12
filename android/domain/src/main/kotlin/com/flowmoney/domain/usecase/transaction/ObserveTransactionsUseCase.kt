package com.flowmoney.domain.usecase.transaction

import com.flowmoney.domain.model.TransactionDetails
import com.flowmoney.domain.model.TransactionFilter
import com.flowmoney.domain.repository.TransactionRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class ObserveTransactionsUseCase @Inject constructor(
    private val repository: TransactionRepository,
) {
    operator fun invoke(filter: TransactionFilter): Flow<List<TransactionDetails>> = repository.observe(filter)
}
