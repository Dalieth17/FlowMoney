package com.flowmoney.domain.model

import java.text.Normalizer
import java.util.Locale

/** Reglas de validación de categorías (únicas para toda la app). */
object CategoryRules {
    const val NAME_MAX_LENGTH = 40

    private val HEX_COLOR = Regex("^#[0-9A-F]{6}$")
    private val WHITESPACE = Regex("\\s+")

    /** Quita espacios sobrantes: "  Comida   rápida " → "Comida rápida". */
    fun normalizeName(raw: String): String = raw.trim().replace(WHITESPACE, " ")

    /**
     * Clave para comparar nombres sin distinguir mayúsculas en cualquier alfabeto:
     * "Educación", "EDUCACIÓN" y "educación" comparten clave.
     *
     * - NFC: "ó" escrita como un carácter o como "o" + tilde combinada es lo mismo.
     * - mayúsculas→minúsculas con Locale.ROOT: plegado de mayúsculas Unicode estable
     *   (incluye ß/SS) e independiente del idioma del teléfono.
     * - Las tildes SÍ cuentan: "año" y "ano" son palabras distintas en español.
     */
    fun nameKey(name: String): String =
        Normalizer.normalize(normalizeName(name), Normalizer.Form.NFC)
            .uppercase(Locale.ROOT)
            .lowercase(Locale.ROOT)

    /** Normaliza el color a mayúsculas para compararlo y guardarlo siempre igual. */
    fun normalizeColor(raw: String): String = raw.trim().uppercase()

    /** Devuelve el primer error encontrado, o null si los datos (ya normalizados) son válidos. */
    fun validate(name: String, icon: String, color: String): CategoryError? = when {
        name.isEmpty() -> CategoryError.BlankName
        name.length > NAME_MAX_LENGTH -> CategoryError.NameTooLong(NAME_MAX_LENGTH)
        icon.isBlank() -> CategoryError.InvalidIcon
        !HEX_COLOR.matches(color) -> CategoryError.InvalidColor
        else -> null
    }
}
