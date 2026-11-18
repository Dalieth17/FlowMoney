package com.flowmoney.domain.model

/** Errores de negocio al guardar o eliminar movimientos. */
sealed interface TransactionError {
    data object InvalidAmount : TransactionError

    data object AmountTooSmall : TransactionError

    data class AmountTooLarge(val maxCents: Long) : TransactionError

    data object BlankDescription : TransactionError

    data class DescriptionTooLong(val max: Int) : TransactionError

    data class NoteTooLong(val max: Int) : TransactionError

    data object CategoryRequired : TransactionError

    data object CategoryNotFound : TransactionError

    data object NotFound : TransactionError
}
