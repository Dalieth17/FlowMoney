package com.flowmoney.domain.advisor

import java.text.Normalizer
import java.util.Locale

/** Texto comparable: minúsculas y sin tildes ("Clínica" = "clinica"), igual que en la web. */
object TextNormalizer {
    private val MARKS = Regex("\\p{M}+")
    private val SEPARATORS = Regex("[^a-z0-9]+")
    private val SPACES = Regex("\\s+")

    fun normalize(text: String): String =
        Normalizer.normalize(text.lowercase(Locale.ROOT), Normalizer.Form.NFD)
            .replace(MARKS, "")
            .replace(SPACES, " ")
            .trim()

    /** Palabras sueltas del texto ya normalizado ("uber eats!" → {uber, eats}). */
    fun tokens(text: String): Set<String> =
        normalize(text).split(SEPARATORS).filterTo(LinkedHashSet()) { it.isNotEmpty() }
}
