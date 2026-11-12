package com.flowmoney.domain.model

/** Reglas de validación de movimientos. */
object TransactionRules {
    const val DESCRIPTION_MAX_LENGTH = 120
    const val NOTE_MAX_LENGTH = 200
    const val MIN_AMOUNT_CENTS = 1L

    private val WHITESPACE = Regex("\\s+")

    fun normalizeText(raw: String): String = raw.trim().replace(WHITESPACE, " ")

    /** Nota vacía = sin nota (null), para no guardar cadenas en blanco. */
    fun normalizeNote(raw: String?): String? = raw?.trim()?.takeIf { it.isNotEmpty() }

    /** Primer error encontrado en datos ya normalizados, o null si son válidos. */
    fun validate(amountCents: Long, description: String, note: String?): TransactionError? = when {
        amountCents < MIN_AMOUNT_CENTS -> TransactionError.AmountTooSmall
        amountCents > Money.MAX_CENTS -> TransactionError.AmountTooLarge(Money.MAX_CENTS)
        description.isEmpty() -> TransactionError.BlankDescription
        description.length > DESCRIPTION_MAX_LENGTH -> TransactionError.DescriptionTooLong(DESCRIPTION_MAX_LENGTH)
        note != null && note.length > NOTE_MAX_LENGTH -> TransactionError.NoteTooLong(NOTE_MAX_LENGTH)
        else -> null
    }
}
