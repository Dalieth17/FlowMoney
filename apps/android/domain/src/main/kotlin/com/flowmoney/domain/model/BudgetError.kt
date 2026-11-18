package com.flowmoney.domain.model

/** Errores de negocio al guardar o quitar presupuestos. */
sealed interface BudgetError {
    data object InvalidAmount : BudgetError

    data object AmountTooSmall : BudgetError

    data class AmountTooLarge(val maxCents: Long) : BudgetError

    data object CategoryNotFound : BudgetError

    data object NotFound : BudgetError
}
