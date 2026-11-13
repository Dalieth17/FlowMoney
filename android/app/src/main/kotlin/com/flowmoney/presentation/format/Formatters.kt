package com.flowmoney.presentation.format

import androidx.compose.runtime.staticCompositionLocalOf
import com.flowmoney.domain.model.AppCurrency
import com.flowmoney.domain.model.TransactionType
import java.math.BigDecimal
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale
import kotlin.math.abs

/**
 * Montos en la moneda que eligió la persona (no la del teléfono):
 * - COP: "$ 4.500.000" (punto de miles; centavos ",50" solo si los hay).
 * - USD: "US$ 1,234.56" (coma de miles y siempre 2 decimales).
 * Los símbolos se fijan a mano para que el resultado no dependa del idioma del teléfono.
 */
class MoneyFormatter(val currency: AppCurrency) {
    private val symbols = when (currency) {
        AppCurrency.COP -> DecimalFormatSymbols(Locale.ROOT).apply {
            groupingSeparator = '.'
            decimalSeparator = ','
        }
        AppCurrency.USD -> DecimalFormatSymbols(Locale.ROOT).apply {
            groupingSeparator = ','
            decimalSeparator = '.'
        }
    }
    private val withCents = DecimalFormat("#,##0.00", symbols)
    private val wholeUnits = DecimalFormat("#,##0", symbols)

    /** Prefijo del campo de monto y de cada cifra. */
    val symbol: String = when (currency) {
        AppCurrency.COP -> "$"
        AppCurrency.USD -> "US$"
    }

    fun format(cents: Long): String {
        val value = BigDecimal.valueOf(abs(cents), 2)
        val number = if (currency == AppCurrency.COP && cents % 100 == 0L) wholeUnits.format(value) else withCents.format(value)
        return (if (cents < 0) "-" else "") + "$symbol $number"
    }

    /** Con signo según el tipo: "+$ 10.000" o "−$ 10.000". */
    fun signed(cents: Long, type: TransactionType): String {
        val sign = if (type == TransactionType.INCOME) "+" else "−"
        return sign + format(abs(cents))
    }

    companion object {
        /** Moneda por defecto (la misma que la web): peso colombiano. */
        val Default = MoneyFormatter(AppCurrency.COP)

        fun of(currency: AppCurrency): MoneyFormatter = if (currency == AppCurrency.COP) Default else MoneyFormatter(currency)
    }
}

/** Formateador de la moneda activa; lo provee la raíz de la app. */
val LocalMoneyFormatter = staticCompositionLocalOf { MoneyFormatter.Default }

object DateFormat {
    /** "Noviembre 2026" */
    fun month(month: YearMonth, locale: Locale = Locale.getDefault()): String =
        month.format(DateTimeFormatter.ofPattern("LLLL yyyy", locale)).replaceFirstChar { it.titlecase(locale) }

    /** "noviembre 2026", para usar dentro de una frase (en español los meses van en minúscula). */
    fun monthInSentence(month: YearMonth, locale: Locale = Locale.getDefault()): String =
        month.format(DateTimeFormatter.ofPattern("LLLL yyyy", locale))

    /** "octubre": solo el nombre del mes, para frases como "más que en octubre". */
    fun monthName(month: YearMonth, locale: Locale = Locale.getDefault()): String =
        month.format(DateTimeFormatter.ofPattern("LLLL", locale))

    /** "oct": etiqueta corta para ejes de gráficos (sin el punto que añaden algunos idiomas). */
    fun monthShort(month: YearMonth, locale: Locale = Locale.getDefault()): String =
        month.format(DateTimeFormatter.ofPattern("LLL", locale)).trimEnd('.')

    /** "Jueves, 12 de noviembre de 2026" (según el idioma del teléfono). */
    fun day(date: LocalDate, locale: Locale = Locale.getDefault()): String =
        date.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.FULL).withLocale(locale))
            .replaceFirstChar { it.titlecase(locale) }

    /** "12 nov 2026" para campos de formulario. */
    fun short(date: LocalDate, locale: Locale = Locale.getDefault()): String =
        date.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(locale))
}
