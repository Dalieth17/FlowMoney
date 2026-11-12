package com.flowmoney.presentation.ui.budgets

import android.content.res.Resources
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import com.flowmoney.R
import com.flowmoney.domain.model.BudgetError

fun BudgetError.text(resources: Resources): String = when (this) {
    BudgetError.InvalidAmount -> resources.getString(R.string.error_amount_invalid)
    BudgetError.AmountTooSmall -> resources.getString(R.string.error_amount_too_small)
    is BudgetError.AmountTooLarge -> resources.getString(R.string.error_amount_too_large)
    BudgetError.CategoryNotFound -> resources.getString(R.string.error_category_not_found)
    BudgetError.NotFound -> resources.getString(R.string.error_budget_not_found)
}

@Composable
fun BudgetError.text(): String = text(LocalContext.current.resources)

fun BudgetsMessage.text(resources: Resources): String = when (this) {
    is BudgetsMessage.Saved -> resources.getString(R.string.message_budget_saved, categoryName)
    is BudgetsMessage.Deleted -> resources.getString(R.string.message_budget_deleted, categoryName)
    is BudgetsMessage.Copied ->
        if (count == 0) {
            resources.getString(R.string.message_budgets_nothing_to_copy)
        } else {
            resources.getQuantityString(R.plurals.message_budgets_copied, count, count)
        }
    is BudgetsMessage.Failed -> error.text(resources)
}
