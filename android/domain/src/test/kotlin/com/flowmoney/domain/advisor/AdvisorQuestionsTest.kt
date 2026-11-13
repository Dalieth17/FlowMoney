package com.flowmoney.domain.advisor

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class AdvisorQuestionsTest {
    private val data = AdvisorTestData()
    private fun day(d: Int): LocalDate = data.november.atDay(d)

    private fun healthyReport(): AdvisorReport {
        data.steadyHistory()
        data.income(400_000, day(1))
        data.expense(60_000, day(5), data.food, "Mercado")
        data.expense(120_000, day(2), data.home, "Alquiler")
        data.expense(20_000, day(10), data.transport, "Uber")
        data.expense(30_000, day(12), data.fun_, "Cine")
        return data.report()
    }

    private fun ask(question: String, report: AdvisorReport = healthyReport()) = AdvisorQuestions.answer(question, report)

    @Test
    fun `cuanto gaste en una categoria por nombre o por comercio`() {
        val report = healthyReport()
        val food = AdvisorQuestions.answer("¿Cuánto gasté en comida?", report) as AdvisorAnswer.CategorySpending
        assertEquals(data.food, food.category)
        assertEquals(60_000L, food.trend!!.currentCents)
        assertEquals(100_000L, food.trend!!.averageCents)

        val transport = AdvisorQuestions.answer("cuanto llevo en uber", report) as AdvisorAnswer.CategorySpending
        assertEquals(data.transport, transport.category)
    }

    @Test
    fun `cuanto gaste en total`() {
        val answer = ask("¿Cuánto he gastado este mes?") as AdvisorAnswer.TotalSpending
        assertEquals(230_000L, answer.summary.expenseCents)
        assertEquals(data.home, answer.top.first().category)
    }

    @Test
    fun `en que gasto mas`() {
        val answer = ask("¿En qué gasto más?") as AdvisorAnswer.TopCategories
        assertEquals(listOf(data.home, data.food, data.fun_, data.transport), answer.top.map { it.category })
    }

    @Test
    fun `puedo comprar algo con precio`() {
        val report = healthyReport()
        // Proyección: ingreso 4000, gasto 2975 → quedan 1025 libres; reservar el 20 % (800) deja 225 cómodos.
        assertEquals(102_500L, report.projection!!.projectedBalanceCents)
        val cheap = AdvisorQuestions.answer("¿Puedo comprar unos audífonos de 200?", report) as AdvisorAnswer.Affordability
        assertEquals(20_000L, cheap.priceCents)
        assertEquals(AffordVerdict.COMFORTABLE, cheap.verdict)

        val medium = AdvisorQuestions.answer("me alcanza para un celular de 900", report) as AdvisorAnswer.Affordability
        assertEquals(AffordVerdict.POSSIBLE_WITH_CARE, medium.verdict)

        val expensive = AdvisorQuestions.answer("¿puedo comprar una laptop de 3,500?", report) as AdvisorAnswer.Affordability
        assertEquals(350_000L, expensive.priceCents)
        assertEquals(AffordVerdict.NOT_NOW, expensive.verdict)
        assertEquals(3, expensive.monthsToSave) // ahorras 1500 al mes de promedio
    }

    @Test
    fun `sin precio pide el monto`() {
        assertEquals(AdvisorAnswer.AffordabilityNeedsPrice, ask("¿Me conviene comprar un auto?"))
    }

    @Test
    fun `cuanto puedo gastar por dia`() {
        val answer = ask("¿Cuánto puedo gastar por día?") as AdvisorAnswer.DailyAllowance
        assertEquals(11, answer.daysLeft) // del 20 al 30 incluidos
        assertEquals(80_000L, answer.reservedSavingsCents)
        assertEquals(400_000L - 230_000L - 80_000L, answer.availableCents)
        assertEquals(90_000L / 11, answer.perDayCents)
    }

    @Test
    fun `plan de ahorro con recortes concretos`() {
        val plan = ask("¿Cómo puedo ahorrar más?") as AdvisorAnswer.SavingsPlan
        assertEquals(80_000L, plan.targetMonthlyCents)
        assertTrue(plan.cuts.isNotEmpty())
        val trim = plan.cuts.first { it.kind == SavingCut.Kind.TRIM_WANTS }
        assertEquals(data.fun_, trim.trend!!.category)
        assertEquals(6_000L, trim.amountCents) // 20 % de 300
    }

    @Test
    fun `debo ahorrar no se confunde con deudas`() {
        assertTrue(ask("¿Debo ahorrar?") is AdvisorAnswer.SavingsPlan)
    }

    @Test
    fun `temas especificos`() {
        assertTrue(ask("¿Qué suscripciones tengo?") is AdvisorAnswer.Subscriptions)
        assertTrue(ask("¿Cuánto necesito para un fondo de emergencia?") is AdvisorAnswer.EmergencyFund)
        assertTrue(ask("¿Cómo van mis presupuestos?") is AdvisorAnswer.Budgets)
        assertTrue(ask("¿Cómo cierro el mes?") is AdvisorAnswer.Projection)
        assertTrue(ask("Tengo deudas en la tarjeta") is AdvisorAnswer.Debt)
        assertTrue(ask("¿Debería invertir?") is AdvisorAnswer.Investing)
        assertTrue(ask("¿Cómo voy?") is AdvisorAnswer.Overview)
        assertEquals(AdvisorAnswer.Unknown, ask("hola"))
    }

    @Test
    fun `sin datos responde lo general y pide registrar movimientos`() {
        val empty = data.report()
        assertEquals(AdvisorAnswer.NoData, AdvisorQuestions.answer("¿Cuánto gasté?", empty))
        assertTrue(AdvisorQuestions.answer("quiero invertir", empty) is AdvisorAnswer.Investing)
    }

    @Test
    fun `entiende montos en varios formatos`() {
        fun amount(text: String) = AdvisorQuestions.parseAmount(text)
        assertEquals(150_000L, amount("1500"))
        assertEquals(150_000L, amount("1.500"))
        assertEquals(150_000L, amount("1,500"))
        assertEquals(150_050L, amount("1,500.50"))
        assertEquals(150_050L, amount("1.500,50"))
        assertEquals(80_050L, amount("800.5"))
        assertEquals(9_990L, amount("99,90"))
        assertEquals(200_000L, amount("2 mil"))
        assertEquals(200_000L, amount("2k"))
        assertNull(amount("sin numeros"))
    }
}
