package com.flowmoney.presentation.ui.reports.export

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReportHtmlTest {
    private val food = CategoryRow("Alimentación", "#C25A44", "S/ 60.00", "100 %", weightCents = 6_000)
    private val week1 = FlowRow("Semana 1 · 1–7", "Sem 1", "S/ 100.00", "S/ 60.00", incomeCents = 10_000, expenseCents = 6_000)

    private fun document(
        categories: List<CategoryRow> = listOf(food),
        flowRows: List<FlowRow> = listOf(week1),
        note: String? = "Gastaste 20 % menos que en octubre",
    ) = ReportDocument(
        languageTag = "es-PE",
        title = "Reporte de noviembre 2026",
        subtitle = "FlowMoney · Generado el 12 nov 2026",
        figures = listOf(
            Figure("Ingresos", "S/ 100.00", Tone.INCOME),
            Figure("Gastos", "S/ 60.00", Tone.EXPENSE),
            Figure("Balance", "S/ 40.00"),
        ),
        note = note,
        categories = CategorySection(
            title = "Gastos por categoría",
            emptyText = "Sin gastos este mes",
            nameHeader = "Categoría",
            amountHeader = "Monto",
            shareHeader = "Parte",
            totalLabel = "Total",
            totalAmount = "S/ 60.00",
            rows = categories,
        ),
        flows = listOf(
            FlowSection(
                title = "Ingresos y gastos por semana",
                emptyText = "Sin movimientos en este periodo",
                periodHeader = "Periodo",
                incomeHeader = "Ingresos",
                expenseHeader = "Gastos",
                rows = flowRows,
            ),
        ),
    )

    private fun String.count(text: String) = windowed(text.length).count { it == text }

    @Test
    fun `incluye titulo cifras nota y tablas`() {
        val html = ReportHtml.render(document())

        assertTrue(html.startsWith("<!DOCTYPE html>"))
        assertTrue(html.contains("<html lang=\"es-PE\">"))
        assertTrue(html.contains("<h1>Reporte de noviembre 2026</h1>"))
        assertTrue(html.contains("<div class=\"value income\">S/ 100.00</div>"))
        assertTrue(html.contains("<div class=\"value expense\">S/ 60.00</div>"))
        assertTrue(html.contains("<div class=\"value neutral\">S/ 40.00</div>"))
        assertTrue(html.contains("<p class=\"note\">Gastaste 20 % menos que en octubre</p>"))
        assertTrue(html.contains("Alimentación</td><td class=\"num\">S/ 60.00</td><td class=\"num\">100 %</td>"))
        assertTrue(html.contains("<td>Semana 1 · 1–7</td><td class=\"num\">S/ 100.00</td><td class=\"num\">S/ 60.00</td>"))
        assertTrue(html.endsWith("</html>"))
    }

    @Test
    fun `sin nota no deja un parrafo vacio`() {
        assertFalse(ReportHtml.render(document(note = null)).contains("class=\"note\""))
    }

    @Test
    fun `el texto que escribe el usuario no puede inyectar etiquetas`() {
        val hostile = food.copy(name = "<script>alert(1)</script> & \"comillas\" 'simples'")
        val html = ReportHtml.render(document(categories = listOf(hostile)))

        assertFalse(html.contains("<script"))
        assertTrue(html.contains("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;comillas&quot; &#39;simples&#39;"))
    }

    @Test
    fun `un color que no es hexadecimal se cambia por uno seguro`() {
        val hostile = food.copy(colorHex = "red\" onload=\"alert(1)")
        val html = ReportHtml.render(document(categories = listOf(hostile)))

        assertFalse(html.contains("onload"))
        assertTrue(html.contains("stroke=\"#8A94A6\""))
    }

    @Test
    fun `no lleva scripts enlaces ni recursos externos`() {
        val html = ReportHtml.render(document())
        listOf("<script", "javascript:", "http", "src=", "href=", "url(", "@import").forEach { forbidden ->
            assertFalse("no debe contener $forbidden", html.contains(forbidden, ignoreCase = true))
        }
    }

    @Test
    fun `una sola categoria dibuja el anillo completo`() {
        val html = ReportHtml.render(document())
        // Circunferencia del anillo: 2 × pi × 58 = 364.42
        assertTrue(html.contains("stroke-dasharray=\"364.42 0.00\" stroke-dashoffset=\"0.00\""))
    }

    @Test
    fun `cada porcion de la dona empieza donde termina la anterior`() {
        val transport = CategoryRow("Transporte", "#3E78A8", "S/ 20.00", "25 %", weightCents = 2_000)
        val html = ReportHtml.render(document(categories = listOf(food, transport)))

        // 6000 de 8000 es 3/4 del anillo (273.32); el resto (91.11) empieza justo despues.
        assertTrue(html.contains("stroke=\"#C25A44\" stroke-width=\"24\" stroke-dasharray=\"273.32 91.11\" stroke-dashoffset=\"0.00\""))
        assertTrue(html.contains("stroke=\"#3E78A8\" stroke-width=\"24\" stroke-dasharray=\"91.11 273.32\" stroke-dashoffset=\"-273.32\""))
    }

    @Test
    fun `la barra mas alta ocupa todo el alto y las demas van a escala`() {
        val html = ReportHtml.render(document())
        // El area de barras mide 120 de alto (de y = 14 a y = 134).
        assertTrue(html.contains("y=\"14.00\" width=\"26.00\" height=\"120.00\" rx=\"2\" fill=\"#1F4D3A\""))
        assertTrue(html.contains("y=\"62.00\" width=\"26.00\" height=\"72.00\" rx=\"2\" fill=\"#C25A44\""))
        assertTrue(html.contains(">Sem 1</text>"))
    }

    @Test
    fun `con muchos periodos las barras se estrechan para caber`() {
        val rows = List(12) { week1.copy(shortLabel = "P${it + 1}") }
        val html = ReportHtml.render(document(flowRows = rows))
        // 520 / 12 = 43.33 por grupo; cada barra ocupa el 30 %: 13.00.
        assertEquals(24, html.count("width=\"13.00\""))
        assertEquals(0, html.count("width=\"26.00\""))
    }

    @Test
    fun `sin datos muestra los textos de vacio y no dibuja graficos`() {
        val emptyWeek = week1.copy(incomeCents = 0, expenseCents = 0)
        val html = ReportHtml.render(document(categories = emptyList(), flowRows = listOf(emptyWeek)))

        assertTrue(html.contains("<p class=\"muted\">Sin gastos este mes</p>"))
        assertTrue(html.contains("<p class=\"muted\">Sin movimientos en este periodo</p>"))
        assertFalse(html.contains("<svg"))
        assertFalse(html.contains("<table"))
    }

    @Test
    fun `escape cubre los caracteres con significado en HTML`() {
        assertEquals("&amp;&lt;&gt;&quot;&#39;", ReportHtml.escape("&<>\"'"))
        assertEquals("Año · Café 100 %", ReportHtml.escape("Año · Café 100 %"))
    }
}
