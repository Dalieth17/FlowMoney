package com.flowmoney.presentation.ui.advisor

import com.flowmoney.domain.advisor.AdvisorAnswer
import com.flowmoney.domain.advisor.AdvisorInput
import com.flowmoney.domain.advisor.AdvisorQuestions
import com.flowmoney.domain.advisor.AdvisorReport
import com.flowmoney.domain.advisor.FinancialAdvisor
import com.flowmoney.domain.advisor.Insight
import com.flowmoney.domain.model.DefaultCategories
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.YearMonth

/** El redactor es Kotlin puro: se prueba sin Android, con un formato de dinero fijo y legible. */
class AdvisorWriterTest {
    private val writer = AdvisorWriter(
        money = { cents -> "S/ %d.%02d".format(cents / 100, kotlin.math.abs(cents % 100)) },
        monthName = { month -> month.month.name.lowercase() },
    )

    private val categories = DefaultCategories.all.mapIndexed { index, category -> category.copy(id = index + 1L) }
    private fun id(name: String) = categories.first { it.name == name }.id
    private val today = LocalDate.of(2026, 11, 20)

    private fun report(vararg transactions: Transaction): AdvisorReport =
        FinancialAdvisor.analyze(AdvisorInput(today, categories, transactions.toList(), emptyList()))

    private fun tx(id: Long, cents: Long, day: LocalDate, type: TransactionType, category: String, description: String = "x") =
        Transaction(id, cents, description, day, type, id(category))

    private val healthy by lazy {
        val history = (8..10).flatMap { m ->
            val month = YearMonth.of(2026, m)
            listOf(
                tx(m * 10L + 1, 400_000, month.atDay(1), TransactionType.INCOME, "Salario"),
                tx(m * 10L + 2, 250_000, month.atDay(5), TransactionType.EXPENSE, "Hogar"),
            )
        }
        report(
            *history.toTypedArray(),
            tx(1, 400_000, today.withDayOfMonth(1), TransactionType.INCOME, "Salario"),
            tx(2, 120_000, today.withDayOfMonth(2), TransactionType.EXPENSE, "Hogar"),
            tx(3, 30_000, today.withDayOfMonth(9), TransactionType.EXPENSE, "Entretenimiento", "Cine"),
        )
    }

    @Test
    fun `cada recomendacion tiene titulo cuerpo y al menos una accion`() {
        val overspent = report(
            tx(1, 100_000, today.withDayOfMonth(1), TransactionType.INCOME, "Salario"),
            tx(2, 150_000, today.withDayOfMonth(3), TransactionType.EXPENSE, "Entretenimiento"),
        )
        val all = healthy.insights + overspent.insights
        assertTrue(all.isNotEmpty())
        all.forEach { insight ->
            val text = writer.insight(insight)
            assertTrue("titulo vacio en $insight", text.title.isNotBlank())
            assertTrue("sin cuerpo en $insight", text.body.isNotEmpty())
            assertTrue("sin acciones en $insight", text.actions.isNotEmpty())
        }
        val overspending = writer.insight(overspent.insights.first { it is Insight.Overspending })
        assertEquals("Este mes gastas más de lo que ganas", overspending.title)
        assertTrue(overspending.body.single().contains("te faltan S/ 500.00"))
    }

    @Test
    fun `responde con las cifras del usuario`() {
        val daily = writer.answer(AdvisorQuestions.answer("¿Cuánto puedo gastar por día?", healthy))
        // Ingreso 4000 − gastado 1500 − reserva 800 = 1700 para 11 días.
        assertEquals("Puedes gastar S/ 154.54 por día", daily.title)
        assertTrue(daily.body.any { it.contains("S/ 1700.00") })

        val afford = writer.answer(AdvisorQuestions.answer("¿Puedo comprar una tele de 5000?", healthy))
        assertEquals("Mejor no por ahora", afford.title)
        assertTrue(afford.body.joinToString().contains("Es una compra grande"))
    }

    @Test
    fun `el resumen incluye la nota y los primeros pasos`() {
        val text = writer.answer(AdvisorAnswer.Overview(healthy))
        assertTrue(text.title.startsWith("Tu salud financiera: ${healthy.score.score}/100"))
        assertTrue(text.body.any { it.contains("november") })
        assertTrue(text.bullets.isNotEmpty())
    }

    @Test
    fun `todas las respuestas tienen texto`() {
        val questions = writer.suggestedQuestions + listOf("hola", "¿Me conviene comprar algo?", "¿Cuánto gasté en comida?")
        questions.forEach { question ->
            val text = writer.answer(AdvisorQuestions.answer(question, healthy))
            assertTrue("sin titulo para «$question»", text.title.isNotBlank())
            assertTrue("respuesta vacia para «$question»", text.body.isNotEmpty() || text.bullets.isNotEmpty())
        }
        val empty = report()
        assertEquals("Aún no tengo datos tuyos", writer.answer(AdvisorQuestions.answer("¿Cómo voy?", empty)).title)
    }

    @Test
    fun `el plan de ahorro suma sus recortes`() {
        val plan = AdvisorQuestions.answer("¿Cómo ahorro más?", healthy) as AdvisorAnswer.SavingsPlan
        val text = writer.answer(plan)
        assertTrue(text.bullets.any { it.startsWith("Gastar un 20 % menos en Entretenimiento: +S/ 60.00") })
        assertTrue(text.body.any { it.contains(writerMoney(plan.potentialCents)) })
    }

    private fun writerMoney(cents: Long) = "S/ %d.%02d".format(cents / 100, cents % 100)

    @Test
    fun `los ejemplos de compra usan cifras de la moneda elegida`() {
        fun purchase(currency: com.flowmoney.domain.model.AppCurrency) =
            AdvisorWriter(money = { it.toString() }, monthName = { it.toString() }, currency = currency)
                .suggestedQuestions.single { "comprar" in it }
        assertEquals("¿Puedo comprar algo de 500.000?", purchase(com.flowmoney.domain.model.AppCurrency.COP))
        assertEquals("¿Puedo comprar algo de 500?", purchase(com.flowmoney.domain.model.AppCurrency.USD))
    }
}
