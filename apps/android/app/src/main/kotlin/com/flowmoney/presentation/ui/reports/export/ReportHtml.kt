package com.flowmoney.presentation.ui.reports.export

import java.util.Locale
import kotlin.math.PI

/**
 * Maqueta un [ReportDocument] como una página HTML autocontenida para imprimir en A4: sin
 * scripts, imágenes ni recursos externos. Los gráficos son SVG en línea (se imprimen siempre,
 * a diferencia de los fondos CSS).
 *
 * Seguridad: todo texto pasa por [escape] —los nombres de categorías los escribe el usuario y
 * no deben poder inyectar etiquetas— y los colores solo se aceptan con formato #RRGGBB.
 */
object ReportHtml {
    private const val INCOME_COLOR = "#1F4D3A"
    private const val EXPENSE_COLOR = "#C25A44"
    private const val FALLBACK_COLOR = "#8A94A6"
    private val HEX_COLOR = Regex("^#[0-9A-Fa-f]{6}$")

    // Dona: anillo de radio 58 y grosor 24 dentro de un lienzo de 160 × 160.
    private const val DONUT_SIZE = 160
    private const val DONUT_RADIUS = 58.0
    private const val DONUT_STROKE = 24

    // Barras: lienzo de 520 × 170; las barras ocupan de y = 14 a y = 134 y debajo van las etiquetas.
    private const val BARS_WIDTH = 520
    private const val BARS_HEIGHT = 170
    private const val BARS_TOP = 14.0
    private const val BARS_BASELINE = 134.0
    private const val BAR_MAX_WIDTH = 26.0
    private const val BAR_GAP = 4.0

    fun render(document: ReportDocument): String = buildString {
        appendLine("<!DOCTYPE html>")
        appendLine("<html lang=\"${escape(document.languageTag)}\">")
        appendLine("<head>")
        appendLine("<meta charset=\"utf-8\">")
        appendLine("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">")
        appendLine("<title>${escape(document.title)}</title>")
        appendLine("<style>$STYLE</style>")
        appendLine("</head>")
        appendLine("<body>")
        appendLine("<header>")
        appendLine("<h1>${escape(document.title)}</h1>")
        appendLine("<p class=\"muted\">${escape(document.subtitle)}</p>")
        appendLine("</header>")
        appendLine(figures(document.figures))
        document.note?.let { appendLine("<p class=\"note\">${escape(it)}</p>") }
        appendLine(categories(document.categories))
        document.flows.forEach { appendLine(flow(it)) }
        appendLine("</body>")
        append("</html>")
    }

    /** Sustituye los caracteres con significado en HTML (también las comillas, por los atributos). */
    fun escape(text: String): String = buildString(text.length) {
        for (char in text) {
            when (char) {
                '&' -> append("&amp;")
                '<' -> append("&lt;")
                '>' -> append("&gt;")
                '"' -> append("&quot;")
                '\'' -> append("&#39;")
                else -> append(char)
            }
        }
    }

    private fun figures(figures: List<Figure>): String = buildString {
        appendLine("<div class=\"figures\">")
        figures.forEach { figure ->
            val tone = figure.tone.name.lowercase(Locale.ROOT)
            append("<div class=\"figure\"><div class=\"label\">${escape(figure.label)}</div>")
            appendLine("<div class=\"value $tone\">${escape(figure.value)}</div></div>")
        }
        append("</div>")
    }

    private fun categories(section: CategorySection): String = buildString {
        appendLine("<section>")
        appendLine("<h2>${escape(section.title)}</h2>")
        if (section.rows.isEmpty()) {
            appendLine("<p class=\"muted\">${escape(section.emptyText)}</p>")
        } else {
            appendLine("<div class=\"split\">")
            appendLine(donut(section.rows))
            appendLine("<table>")
            append("<thead><tr><th>${escape(section.nameHeader)}</th>")
            appendLine("<th class=\"num\">${escape(section.amountHeader)}</th><th class=\"num\">${escape(section.shareHeader)}</th></tr></thead>")
            appendLine("<tbody>")
            section.rows.forEach { row ->
                append("<tr><td>${swatch(row.colorHex)}${escape(row.name)}</td>")
                appendLine("<td class=\"num\">${escape(row.amount)}</td><td class=\"num\">${escape(row.share)}</td></tr>")
            }
            appendLine("</tbody>")
            append("<tfoot><tr><td>${escape(section.totalLabel)}</td>")
            appendLine("<td class=\"num\">${escape(section.totalAmount)}</td><td></td></tr></tfoot>")
            appendLine("</table>")
            appendLine("</div>")
        }
        append("</section>")
    }

    private fun flow(section: FlowSection): String = buildString {
        appendLine("<section>")
        appendLine("<h2>${escape(section.title)}</h2>")
        if (section.rows.all { it.incomeCents == 0L && it.expenseCents == 0L }) {
            appendLine("<p class=\"muted\">${escape(section.emptyText)}</p>")
        } else {
            appendLine(bars(section.rows))
            appendLine("<table>")
            append("<thead><tr><th>${escape(section.periodHeader)}</th>")
            append("<th class=\"num\">${swatch(INCOME_COLOR)}${escape(section.incomeHeader)}</th>")
            appendLine("<th class=\"num\">${swatch(EXPENSE_COLOR)}${escape(section.expenseHeader)}</th></tr></thead>")
            appendLine("<tbody>")
            section.rows.forEach { row ->
                append("<tr><td>${escape(row.label)}</td>")
                appendLine("<td class=\"num\">${escape(row.income)}</td><td class=\"num\">${escape(row.expense)}</td></tr>")
            }
            appendLine("</tbody>")
            appendLine("</table>")
        }
        append("</section>")
    }

    /**
     * Cada porción es un círculo del que solo se dibuja un tramo del borde (`stroke-dasharray`),
     * desplazado hasta donde terminó la anterior. El giro de −90° hace que empiece arriba.
     */
    private fun donut(rows: List<CategoryRow>): String = buildString {
        val center = DONUT_SIZE / 2
        val circumference = 2 * PI * DONUT_RADIUS
        val total = rows.sumOf { it.weightCents.coerceAtLeast(0) }
        appendLine("<svg class=\"donut\" width=\"$DONUT_SIZE\" height=\"$DONUT_SIZE\" viewBox=\"0 0 $DONUT_SIZE $DONUT_SIZE\" aria-hidden=\"true\">")
        if (total > 0) {
            var drawn = 0.0
            rows.forEach { row ->
                // La fracción se calcula primero: así el 100 % da exactamente la circunferencia.
                val length = circumference * (row.weightCents.coerceAtLeast(0).toDouble() / total)
                append("<circle cx=\"$center\" cy=\"$center\" r=\"${number(DONUT_RADIUS)}\" fill=\"none\" ")
                append("stroke=\"${color(row.colorHex)}\" stroke-width=\"$DONUT_STROKE\" ")
                append("stroke-dasharray=\"${number(length)} ${number(circumference - length)}\" ")
                // El desplazamiento negativo hace avanzar las porciones en el sentido del reloj.
                appendLine("stroke-dashoffset=\"${number(-drawn)}\" transform=\"rotate(-90 $center $center)\"/>")
                drawn += length
            }
        }
        append("</svg>")
    }

    private fun bars(rows: List<FlowRow>): String = buildString {
        val max = rows.maxOf { maxOf(it.incomeCents, it.expenseCents) }.coerceAtLeast(1)
        val groupWidth = BARS_WIDTH.toDouble() / rows.size
        val barWidth = minOf(BAR_MAX_WIDTH, groupWidth * 0.3)
        val plotHeight = BARS_BASELINE - BARS_TOP

        appendLine("<svg class=\"bars\" viewBox=\"0 0 $BARS_WIDTH $BARS_HEIGHT\" aria-hidden=\"true\">")
        rows.forEachIndexed { index, row ->
            val center = groupWidth * index + groupWidth / 2
            appendLine(bar(center - BAR_GAP / 2 - barWidth, barWidth, plotHeight * row.incomeCents / max, INCOME_COLOR))
            appendLine(bar(center + BAR_GAP / 2, barWidth, plotHeight * row.expenseCents / max, EXPENSE_COLOR))
            appendLine("<text x=\"${number(center)}\" y=\"154\" text-anchor=\"middle\">${escape(row.shortLabel)}</text>")
        }
        appendLine("<line x1=\"0\" y1=\"${number(BARS_BASELINE)}\" x2=\"$BARS_WIDTH\" y2=\"${number(BARS_BASELINE)}\"/>")
        append("</svg>")
    }

    private fun bar(x: Double, width: Double, height: Double, color: String): String =
        "<rect x=\"${number(x)}\" y=\"${number(BARS_BASELINE - height)}\" width=\"${number(width)}\" " +
            "height=\"${number(height)}\" rx=\"2\" fill=\"$color\"/>"

    private fun swatch(colorHex: String): String =
        "<svg class=\"swatch\" width=\"10\" height=\"10\" aria-hidden=\"true\">" +
            "<rect width=\"10\" height=\"10\" rx=\"2\" fill=\"${color(colorHex)}\"/></svg>"

    private fun color(colorHex: String): String = if (HEX_COLOR.matches(colorHex)) colorHex else FALLBACK_COLOR

    /**
     * Números para SVG: punto decimal sea cual sea el idioma del teléfono y sin "-0.00" (un resto
     * de redondeo negativo sería un valor inválido en `stroke-dasharray`).
     */
    private fun number(value: Double): String {
        val text = String.format(Locale.ROOT, "%.2f", value)
        return if (text == "-0.00") "0.00" else text
    }

    private val STYLE = """
        @page { size: A4; margin: 16mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #16231E; font-family: Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 11pt; line-height: 1.4; }
        h1 { margin: 0; color: #1F4D3A; font-family: Georgia, "Times New Roman", serif; font-size: 22pt; font-weight: 600; }
        h2 { margin: 0 0 8pt; font-size: 12.5pt; }
        p { margin: 4pt 0 0; }
        .muted { color: #5B6B63; }
        .note { margin-top: 0; }
        header { border-bottom: 2pt solid #1F4D3A; padding-bottom: 10pt; }
        .figures { display: flex; gap: 8pt; margin: 14pt 0 10pt; }
        .figure { flex: 1; border: 1pt solid #D7DED3; border-radius: 8pt; padding: 8pt 10pt; }
        .figure .label { color: #5B6B63; font-size: 8.5pt; letter-spacing: .06em; text-transform: uppercase; }
        .figure .value { font-size: 14pt; font-weight: 600; white-space: nowrap; }
        .value.income { color: #1F4D3A; }
        .value.expense { color: #C25A44; }
        section { margin-top: 18pt; break-inside: avoid; page-break-inside: avoid; }
        .split { display: flex; align-items: center; gap: 18pt; }
        .split table { flex: 1; }
        .donut { flex: none; }
        .bars { display: block; width: 100%; height: auto; margin-bottom: 6pt; }
        .bars text { fill: #5B6B63; font-size: 10px; }
        .bars line { stroke: #16231E; stroke-width: 1; }
        .swatch { margin-right: 6pt; vertical-align: baseline; }
        table { width: 100%; border-collapse: collapse; }
        th { border-bottom: 1pt solid #16231E; color: #5B6B63; font-size: 8.5pt; font-weight: 600; letter-spacing: .06em; padding: 4pt 6pt; text-align: left; text-transform: uppercase; }
        td { border-bottom: 1pt solid #E3E8E0; padding: 5pt 6pt; }
        tfoot td { border-bottom: none; font-weight: 600; }
        .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    """.trimIndent()
}
