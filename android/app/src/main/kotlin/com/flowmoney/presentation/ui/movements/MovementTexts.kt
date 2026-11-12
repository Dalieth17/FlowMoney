package com.flowmoney.presentation.ui.movements

import android.content.res.Resources
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import com.flowmoney.R
import com.flowmoney.domain.model.BudgetStatus
import com.flowmoney.domain.model.TransactionError

fun TransactionError.text(resources: Resources): String = when (this) {
    TransactionError.InvalidAmount -> resources.getString(R.string.error_amount_invalid)
    TransactionError.AmountTooSmall -> resources.getString(R.string.error_amount_too_small)
    is TransactionError.AmountTooLarge -> resources.getString(R.string.error_amount_too_large)
    TransactionError.BlankDescription -> resources.getString(R.string.error_movement_blank_description)
    is TransactionError.DescriptionTooLong -> resources.getString(R.string.error_text_too_long, max)
    is TransactionError.NoteTooLong -> resources.getString(R.string.error_text_too_long, max)
    TransactionError.CategoryRequired -> resources.getString(R.string.error_movement_category_required)
    TransactionError.CategoryNotFound -> resources.getString(R.string.error_category_not_found)
    TransactionError.NotFound -> resources.getString(R.string.error_movement_not_found)
}

@Composable
fun TransactionError.text(): String = text(LocalContext.current.resources)

fun MovementsMessage.text(resources: Resources): String = when (this) {
    MovementsMessage.Created -> resources.getString(R.string.message_movement_created)
    MovementsMessage.Updated -> resources.getString(R.string.message_movement_updated)
    MovementsMessage.Deleted -> resources.getString(R.string.message_movement_deleted)
    is MovementsMessage.BudgetAlert -> budgetAlertText(status, resources)
    is MovementsMessage.Failed -> error.text(resources)
}

private fun budgetAlertText(status: BudgetStatus, resources: Resources): String = when {
    status.spentCents > status.limitCents ->
        resources.getString(R.string.message_movement_budget_over, status.category.name, status.percent)
    status.spentCents == status.limitCents ->
        resources.getString(R.string.message_movement_budget_reached, status.category.name)
    else -> resources.getString(R.string.message_movement_budget_near, status.category.name, status.percent)
}

/** Campo del formulario donde se muestra cada error (los demás van al pie). */
internal enum class MovementField { AMOUNT, DESCRIPTION, CATEGORY, NOTE, NONE }

internal val TransactionError.field: MovementField
    get() = when (this) {
        TransactionError.InvalidAmount, TransactionError.AmountTooSmall, is TransactionError.AmountTooLarge ->
            MovementField.AMOUNT
        TransactionError.BlankDescription, is TransactionError.DescriptionTooLong -> MovementField.DESCRIPTION
        TransactionError.CategoryRequired, TransactionError.CategoryNotFound -> MovementField.CATEGORY
        is TransactionError.NoteTooLong -> MovementField.NOTE
        TransactionError.NotFound -> MovementField.NONE
    }
