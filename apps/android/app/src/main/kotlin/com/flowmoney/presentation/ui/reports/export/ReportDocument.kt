package com.flowmoney.presentation.ui.reports.export

/**
 * Contenido del reporte en PDF, ya traducido y con los montos formateados: [ReportHtml] solo
 * tiene que maquetarlo. No depende de Android, así que se puede probar y previsualizar aparte.
 */
data class ReportDocument(
    val languageTag: String,
    val title: String,
    val subtitle: String,
    val figures: List<Figure>,
    val note: String?,
    val categories: CategorySection,
    val flows: List<FlowSection>,
)

/** Una cifra destacada del encabezado ("Ingresos", "S/ 4,200.00"). */
data class Figure(val label: String, val value: String, val tone: Tone = Tone.NEUTRAL)

enum class Tone { NEUTRAL, INCOME, EXPENSE }

/** "Gastos por categoría": gráfico de dona y tabla. */
data class CategorySection(
    val title: String,
    val emptyText: String,
    val nameHeader: String,
    val amountHeader: String,
    val shareHeader: String,
    val totalLabel: String,
    val totalAmount: String,
    val rows: List<CategoryRow>,
)

/** @property weightCents monto sin formato: define el tamaño de su porción en la dona. */
data class CategoryRow(
    val name: String,
    val colorHex: String,
    val amount: String,
    val share: String,
    val weightCents: Long,
)

/** "Ingresos y gastos por semana" o "por mes": gráfico de barras y tabla. */
data class FlowSection(
    val title: String,
    val emptyText: String,
    val periodHeader: String,
    val incomeHeader: String,
    val expenseHeader: String,
    val rows: List<FlowRow>,
)

/** @property incomeCents y [expenseCents] sin formato: definen la altura de las barras. */
data class FlowRow(
    val label: String,
    val shortLabel: String,
    val income: String,
    val expense: String,
    val incomeCents: Long,
    val expenseCents: Long,
)
