package com.flowmoney.presentation.format

import com.flowmoney.domain.model.TransactionType
import java.math.BigDecimal
import java.text.NumberFormat
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale
import kotlin.math.abs

/**
 * Montos con la moneda y el formato del teléfono ("S/ 12.50" en Perú, "12,50 €" en España).
 * Si el idioma no define una moneda, se muestra el número con 2 decimales.
 */
object MoneyFormat {
    private const val UNKNOWN_CURRENCY = "XXX"

    private fun formatter(locale: Locale): NumberFormat {
        val currency = NumberFormat.getCurrencyInstance(locale)
        if (currency.currency?.currencyCode != UNKNOWN_CURRENCY) return currency
        return NumberFormat.getNumberInstance(locale).apply {
            minimumFractionDigits = 2
            maximumFractionDigits = 2
        }
    }

    fun format(cents: Long, locale: Locale = Locale.getDefault()): String =
        formatter(locale).format(BigDecimal.valueOf(cents, 2))

    /** Con signo según el tipo: "+S/ 10.00" o "−S/ 10.00". */
    fun signed(cents: Long, type: TransactionType, locale: Locale = Locale.getDefault()): String {
        val sign = if (type == TransactionType.INCOME) "+" else "−"
        return sign + format(abs(cents), locale)
    }

    /** Símbolo para el prefijo del campo de monto ("S/", "€"); vacío si no hay moneda. */
    fun currencySymbol(locale: Locale = Locale.getDefault()): String =
        NumberFormat.getCurrencyInstance(locale).currency
            ?.takeIf { it.currencyCode != UNKNOWN_CURRENCY }
            ?.getSymbol(locale)
            .orEmpty()
}

object DateFormat {
    /** "Noviembre 2026" */
    fun month(month: YearMonth, locale: Locale = Locale.getDefault()): String =
        month.format(DateTimeFormatter.ofPattern("LLLL yyyy", locale)).replaceFirstChar { it.titlecase(locale) }

    /** "noviembre 2026", para usar dentro de una frase (en español los meses van en minúscula). */
    fun monthInSentence(month: YearMonth, locale: Locale = Locale.getDefault()): String =
        month.format(DateTimeFormatter.ofPattern("LLLL yyyy", locale))

    /** "Jueves, 12 de noviembre de 2026" (según el idioma del teléfono). */
    fun day(date: LocalDate, locale: Locale = Locale.getDefault()): String =
        date.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.FULL).withLocale(locale))
            .replaceFirstChar { it.titlecase(locale) }

    /** "12 nov 2026" para campos de formulario. */
    fun short(date: LocalDate, locale: Locale = Locale.getDefault()): String =
        date.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(locale))
}
