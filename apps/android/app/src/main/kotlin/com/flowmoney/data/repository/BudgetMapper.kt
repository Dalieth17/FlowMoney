package com.flowmoney.data.repository

import com.flowmoney.data.local.entity.BudgetEntity
import com.flowmoney.domain.model.Budget
import java.time.YearMonth

/** 2026-11 → 202611 (así se guarda el mes en la tabla `budgets`). */
internal fun YearMonth.toMonthKey(): Int = year * 100 + monthValue

internal fun Int.toYearMonth(): YearMonth = YearMonth.of(this / 100, this % 100)

internal fun BudgetEntity.toDomain() = Budget(categoryId = categoryId, month = month.toYearMonth(), limitCents = limitCents)

internal fun Budget.toEntity() = BudgetEntity(month = month.toMonthKey(), categoryId = categoryId, limitCents = limitCents)
