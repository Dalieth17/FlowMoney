package com.flowmoney.data.repository

import com.flowmoney.data.local.entity.TransactionEntity
import com.flowmoney.data.local.entity.TransactionWithCategoryRow
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionDetails
import java.time.LocalDate

internal fun TransactionEntity.toDomain() = Transaction(
    id = id,
    amountCents = amountCents,
    description = description,
    date = LocalDate.ofEpochDay(dateEpochDay),
    type = type,
    categoryId = categoryId,
    note = note,
)

internal fun Transaction.toEntity() = TransactionEntity(
    id = id,
    amountCents = amountCents,
    description = description,
    dateEpochDay = date.toEpochDay(),
    type = type,
    categoryId = categoryId,
    note = note,
)

internal fun TransactionWithCategoryRow.toDomain() = TransactionDetails(
    transaction = transaction.toDomain(),
    category = category.toDomain(),
)
