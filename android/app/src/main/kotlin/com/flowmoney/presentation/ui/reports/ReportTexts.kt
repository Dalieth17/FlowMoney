package com.flowmoney.presentation.ui.reports

import android.content.res.Resources
import com.flowmoney.R
import com.flowmoney.domain.model.CategoryShare
import com.flowmoney.domain.model.MonthFlow
import com.flowmoney.domain.model.MonthlyReport
import com.flowmoney.domain.model.WeekFlow
import com.flowmoney.presentation.format.DateFormat

/** Una barra del gráfico "Ingresos y gastos" y su fila en la tabla: una semana o un mes. */
data class FlowBar(
    val shortLabel: String,
    val label: String,
    val incomeCents: Long,
    val expenseCents: Long,
) {
    val isEmpty: Boolean get() = incomeCents == 0L && expenseCents == 0L
}

/** "Sem 1" en el gráfico y "Semana 1 · 1–7" en la tabla. */
fun WeekFlow.toBar(resources: Resources) = FlowBar(
    shortLabel = resources.getString(R.string.reports_week_short, number),
    label = if (from == to) {
        resources.getString(R.string.reports_week_single, number, from.dayOfMonth)
    } else {
        resources.getString(R.string.reports_week_range, number, from.dayOfMonth, to.dayOfMonth)
    },
    incomeCents = incomeCents,
    expenseCents = expenseCents,
)

/** "nov" en el gráfico y "Noviembre 2026" en la tabla. */
fun MonthFlow.toBar() = FlowBar(
    shortLabel = DateFormat.monthShort(month),
    label = DateFormat.month(month),
    incomeCents = incomeCents,
    expenseCents = expenseCents,
)

/** "75 %", o "−50 %" con el signo menos tipográfico. */
fun percentText(percent: Int, resources: Resources): String =
    if (percent < 0) {
        resources.getString(R.string.percent_negative, -percent.toLong())
    } else {
        resources.getString(R.string.percent_value, percent)
    }

/** Parte del gasto: una categoría con gasto nunca se muestra como "0 %". */
fun CategoryShare.percentText(resources: Resources): String =
    if (percent == 0) resources.getString(R.string.percent_tiny) else resources.getString(R.string.percent_value, percent)

/** "Gastaste 20 % más que en octubre"; null si el mes anterior no tuvo gastos. */
fun MonthlyReport.expenseChangeText(resources: Resources): String? {
    val change = expenseChangePercent ?: return null
    val previousMonth = DateFormat.monthName(month.minusMonths(1))
    return when {
        change > 0 -> resources.getString(R.string.reports_expense_more, change, previousMonth)
        change < 0 -> resources.getString(R.string.reports_expense_less, -change.toLong(), previousMonth)
        else -> resources.getString(R.string.reports_expense_same, previousMonth)
    }
}
