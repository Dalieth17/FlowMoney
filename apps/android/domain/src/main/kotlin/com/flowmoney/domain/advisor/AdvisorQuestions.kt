package com.flowmoney.domain.advisor

import com.flowmoney.domain.model.BudgetStatus
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.MonthSummary
import com.flowmoney.domain.model.TransactionType
import kotlin.math.ceil

/** Qué tan buena idea es una compra según tus números del mes. */
enum class AffordVerdict {
    /** Te alcanza y sigues ahorrando al menos el 20 %. */
    COMFORTABLE,

    /** Te alcanza, pero ese mes ahorras menos de lo recomendado. */
    POSSIBLE_WITH_CARE,

    /** Te dejaría en rojo: mejor ahorrar antes. */
    NOT_NOW,
}

/** Un recorte concreto que propone el plan de ahorro. */
data class SavingCut(val kind: Kind, val amountCents: Long, val trend: CategoryTrend? = null) {
    enum class Kind {
        /** Bajar un 20 % un gusto (salidas, entretenimiento…). */
        TRIM_WANTS,

        /** Volver una categoría que se disparó a su promedio. */
        BACK_TO_AVERAGE,

        /** Reducir a la mitad los gastos hormiga. */
        SMALL_EXPENSES,

        /** Cancelar al menos una suscripción que no uses. */
        SUBSCRIPTION,
    }
}

/** Respuesta a una pregunta, con los datos ya calculados. La presentación la redacta. */
sealed interface AdvisorAnswer {
    /** Aún no hay movimientos para responder con cifras propias. */
    data object NoData : AdvisorAnswer

    /** No se entendió la pregunta. */
    data object Unknown : AdvisorAnswer

    data class Overview(val report: AdvisorReport) : AdvisorAnswer

    data class TotalSpending(val summary: MonthSummary, val averageExpenseCents: Long, val top: List<CategoryTrend>) : AdvisorAnswer

    /** [trend] es null si no hubo gasto en esa categoría este mes ni antes. */
    data class CategorySpending(val category: Category, val trend: CategoryTrend?, val monthExpenseCents: Long) : AdvisorAnswer

    data class TopCategories(val top: List<CategoryTrend>, val monthExpenseCents: Long) : AdvisorAnswer

    /**
     * Cuánto puedes gastar por día hasta fin de mes reservando el 20 % de ahorro.
     * [availableCents] puede ser negativo (ya te pasaste).
     */
    data class DailyAllowance(
        val expectedIncomeCents: Long,
        val spentCents: Long,
        val reservedSavingsCents: Long,
        val availableCents: Long,
        val daysLeft: Int,
    ) : AdvisorAnswer {
        val perDayCents: Long get() = if (availableCents > 0) availableCents / daysLeft.coerceAtLeast(1) else 0
    }

    data class SavingsPlan(
        val ratePercent: Int?,
        val currentMonthlyCents: Long,
        val targetMonthlyCents: Long,
        val cuts: List<SavingCut>,
    ) : AdvisorAnswer {
        val potentialCents: Long get() = cuts.sumOf { it.amountCents }
        val gapCents: Long get() = (targetMonthlyCents - currentMonthlyCents).coerceAtLeast(0)
    }

    data class Affordability(
        val priceCents: Long,
        val verdict: AffordVerdict,
        val freeCashCents: Long,
        val expectedIncomeCents: Long,
        val monthlySavingCents: Long,
        val monthsToSave: Int?,
        val ratePercentAfter: Int?,
    ) : AdvisorAnswer

    /** Preguntó si puede comprar algo pero sin decir el precio. */
    data object AffordabilityNeedsPrice : AdvisorAnswer

    data class Subscriptions(val items: List<RecurringExpense>) : AdvisorAnswer

    data class Budgets(val statuses: List<BudgetStatus>, val suggestions: List<Insight.SuggestBudget>) : AdvisorAnswer

    data class EmergencyFund(val plan: Insight.EmergencyFund?) : AdvisorAnswer

    /** [debtPaymentsCents]: lo pagado este mes en categorías de tarjeta, préstamos o deudas. */
    data class Debt(val debtPaymentsCents: Long, val ratePercent: Int?, val monthlySavingCents: Long) : AdvisorAnswer

    data class Investing(
        val ratePercent: Int?,
        val monthlySavingCents: Long,
        val emergencyTargetCents: Long,
        val hasDebtPayments: Boolean,
    ) : AdvisorAnswer

    data class Projection(val projection: MonthProjection?, val summary: MonthSummary) : AdvisorAnswer
}

/**
 * Entiende preguntas en español sobre tus finanzas ("¿cuánto gasté en comida?", "¿puedo comprar
 * un celular de 1500?", "¿cómo ahorro más?") y las responde con las cifras del [AdvisorReport].
 * Detecta la intención por palabras clave (sin tildes ni mayúsculas) y extrae montos y categorías.
 */
object AdvisorQuestions {
    private val AFFORD = listOf(
        "puedo comprar", "me alcanza", "alcanza para", "puedo pagar", "permitirme", "permitir", "darme el gusto",
        "comprarme", "deberia comprar", "vale la pena", "puedo gastar", "conviene comprar", "comprar",
    )
    private val SUBSCRIPTIONS = listOf("suscrip", "recurrent", "mensualidad", "pagos fijos", "cobros fijos", "se repite", "plataformas")
    private val EMERGENCY = listOf("emergencia", "imprevist", "colchon", "fondo de reserva", "reserva")
    private val DEBT = listOf("deuda", "lo que debo", "tarjeta", "credito", "prestamo", "intereses", "cuotas")
    private val INVEST = listOf("invert", "inversion", "bolsa", "acciones", "fondo mutuo", "fondos", "cripto", "bitcoin", "plazo fijo", "rentab", "multiplicar")
    private val SAVE = listOf("ahorr", "guardar dinero", "recortar", "reducir gastos", "reducir mis gastos", "gastar menos", "economizar")
    private val BUDGET = listOf("presupuest", "limite")
    private val PROJECTION = listOf("fin de mes", "fin del mes", "proyecc", "terminare", "cerrare", "llegare", "como cierro", "como termino", "como terminare")
    private val ALLOWANCE = listOf("por dia", "diario", "al dia", "cuanto puedo gastar", "me queda", "disponible", "cuanto tengo", "puedo gastar")
    private val TOP = listOf("en que gasto", "en que se me va", "donde se va", "mayor gasto", "mas gasto", "gasto mas", "categoria mas", "mis gastos principales")
    private val SPEND = listOf("cuanto gaste", "cuanto he gastado", "gaste", "gastado", "gasto en", "gastos en", "cuanto llevo")
    private val OVERVIEW = listOf(
        "como voy", "como estoy", "resumen", "salud", "puntaje", "nota", "estado", "consejo", "recomend", "analiz",
        "que hago", "ayuda", "mis finanzas", "como me va",
    )

    private val NUMBER = Regex("""(\d[\d.,]*)\s*(millones|millon|mil|m|k)?\b""", RegexOption.IGNORE_CASE)
    private val DEBT_WORDS = listOf("tarjeta", "deuda", "prestamo", "credito", "cuota")

    fun answer(question: String, report: AdvisorReport): AdvisorAnswer {
        val text = TextNormalizer.normalize(question)
        if (text.isBlank()) return AdvisorAnswer.Unknown
        fun has(words: List<String>) = words.any { text.contains(it) }

        // Lo general (deudas, inversión) se puede responder aunque aún no haya datos.
        if (has(DEBT)) return debt(report)
        if (has(INVEST)) return investing(report)
        if (!report.hasData) return AdvisorAnswer.NoData

        val amount = parseAmount(text)
        return when {
            has(AFFORD) && amount != null -> affordability(amount, report)
            has(SUBSCRIPTIONS) -> AdvisorAnswer.Subscriptions(report.recurring)
            has(EMERGENCY) -> AdvisorAnswer.EmergencyFund(report.insights.filterIsInstance<Insight.EmergencyFund>().firstOrNull())
            has(SAVE) -> savingsPlan(report)
            has(BUDGET) -> AdvisorAnswer.Budgets(report.budgets, report.insights.filterIsInstance<Insight.SuggestBudget>())
            has(PROJECTION) -> AdvisorAnswer.Projection(report.projection, report.summary)
            has(ALLOWANCE) -> dailyAllowance(report)
            has(AFFORD) -> AdvisorAnswer.AffordabilityNeedsPrice
            has(TOP) -> AdvisorAnswer.TopCategories(report.trends.filter { it.currentCents > 0 }.take(5), report.summary.expenseCents)
            else -> spendingOrOverview(text, has(SPEND), has(OVERVIEW), report)
        }
    }

    private fun spendingOrOverview(text: String, asksSpending: Boolean, asksOverview: Boolean, report: AdvisorReport): AdvisorAnswer {
        val category = findCategory(text, report.categories)
        return when {
            category != null -> AdvisorAnswer.CategorySpending(
                category = category,
                trend = report.trends.firstOrNull { it.category.id == category.id },
                monthExpenseCents = report.summary.expenseCents,
            )
            asksSpending -> AdvisorAnswer.TotalSpending(report.summary, report.averageExpenseCents, report.trends.filter { it.currentCents > 0 }.take(3))
            asksOverview -> AdvisorAnswer.Overview(report)
            else -> AdvisorAnswer.Unknown
        }
    }

    /** La categoría que menciona la pregunta: por su nombre o por un comercio conocido ("uber"). */
    internal fun findCategory(text: String, categories: List<Category>): Category? {
        val suggestion = CategoryClassifier.suggest(text, TransactionType.EXPENSE, categories) ?: return null
        val reliable = suggestion.source == SuggestionSource.CATEGORY_NAME ||
            (suggestion.source == SuggestionSource.KEYWORD && suggestion.confidence >= 0.9)
        return if (reliable) suggestion.category else null
    }

    /**
     * Primer monto de la pregunta. Acepta "1500", "1,500", "1.500,50", "800.5", "2 mil", "2k", "3 millones" y "1.5M".
     * Un único separador seguido de exactamente 3 dígitos se toma como de miles.
     */
    internal fun parseAmount(text: String): Long? {
        val match = NUMBER.find(text) ?: return null
        val raw = match.groupValues[1].trimEnd('.', ',')
        val multiplier = when (match.groupValues[2].lowercase()) {
            "" -> 1L
            "mil", "k" -> 1_000L
            else -> 1_000_000L
        }
        val lastDot = raw.lastIndexOf('.')
        val lastComma = raw.lastIndexOf(',')
        val decimalAt = when {
            lastDot >= 0 && lastComma >= 0 -> maxOf(lastDot, lastComma)
            lastDot >= 0 || lastComma >= 0 -> {
                val at = maxOf(lastDot, lastComma)
                val separators = raw.count { it == '.' || it == ',' }
                if (separators == 1 && raw.length - at - 1 in 1..2) at else -1
            }
            else -> -1
        }
        val units = (if (decimalAt >= 0) raw.substring(0, decimalAt) else raw).filter { it.isDigit() }
        val decimals = if (decimalAt >= 0) raw.substring(decimalAt + 1).filter { it.isDigit() }.padEnd(2, '0').take(2) else "00"
        if (units.isEmpty() || units.length > 12) return null
        val cents = units.toLong() * 100 + decimals.toLong()
        return (cents * multiplier).takeIf { it > 0 }
    }

    private fun expectedIncome(report: AdvisorReport): Long = report.projection?.expectedIncomeCents ?: report.summary.incomeCents

    private fun expectedBalance(report: AdvisorReport): Long =
        report.projection?.projectedBalanceCents ?: report.summary.balanceCents

    private fun monthlySaving(report: AdvisorReport): Long =
        (if (report.historyMonths > 0) report.averageIncomeCents - report.averageExpenseCents else expectedBalance(report)).coerceAtLeast(0)

    private fun rate(report: AdvisorReport): Int? {
        val income = expectedIncome(report)
        return if (income > 0) ((expectedBalance(report) * 100.0) / income).toInt() else null
    }

    private fun affordability(price: Long, report: AdvisorReport): AdvisorAnswer.Affordability {
        val income = expectedIncome(report)
        val freeCash = expectedBalance(report)
        val reserve = income * FinancialAdvisor.TARGET_SAVINGS_PERCENT / 100
        val verdict = when {
            price <= freeCash - reserve -> AffordVerdict.COMFORTABLE
            price <= freeCash -> AffordVerdict.POSSIBLE_WITH_CARE
            else -> AffordVerdict.NOT_NOW
        }
        val saving = monthlySaving(report)
        val months = if (saving > 0) ceil(price.toDouble() / saving).toInt() else null
        val rateAfter = if (income > 0) (((freeCash - price) * 100.0) / income).toInt() else null
        return AdvisorAnswer.Affordability(price, verdict, freeCash, income, saving, months, rateAfter)
    }

    private fun dailyAllowance(report: AdvisorReport): AdvisorAnswer.DailyAllowance {
        val income = expectedIncome(report)
        val spent = report.summary.expenseCents
        val reserve = income * FinancialAdvisor.TARGET_SAVINGS_PERCENT / 100
        val daysLeft = report.today.lengthOfMonth() - report.today.dayOfMonth + 1 // hoy cuenta
        return AdvisorAnswer.DailyAllowance(income, spent, reserve, income - spent - reserve, daysLeft)
    }

    private fun savingsPlan(report: AdvisorReport): AdvisorAnswer.SavingsPlan {
        val income = expectedIncome(report)
        val cuts = mutableListOf<SavingCut>()
        val covered = mutableSetOf<Long>()

        // Primero, lo que se disparó vuelve a su nivel normal.
        report.insights.filterIsInstance<Insight.CategorySpike>().forEach { spike ->
            cuts += SavingCut(SavingCut.Kind.BACK_TO_AVERAGE, spike.extraCents, spike.trend)
            covered += spike.trend.category.id
        }
        // Después, un 20 % menos en los gustos más grandes.
        report.trends
            .filter { it.kind == SpendingKind.WANTS && it.category.id !in covered }
            .map { it to maxOf(it.currentCents, it.averageCents) }
            .filter { (_, reference) -> reference > 0 }
            .sortedByDescending { (_, reference) -> reference }
            .take(3)
            .forEach { (trend, reference) -> cuts += SavingCut(SavingCut.Kind.TRIM_WANTS, reference / 5, trend) }
        report.insights.filterIsInstance<Insight.SmallExpenses>().firstOrNull()?.let {
            cuts += SavingCut(SavingCut.Kind.SMALL_EXPENSES, it.totalCents / 2)
        }
        report.recurring.filter { it.isSubscription }.minByOrNull { it.monthlyCents }?.let {
            cuts += SavingCut(SavingCut.Kind.SUBSCRIPTION, it.monthlyCents)
        }
        return AdvisorAnswer.SavingsPlan(
            ratePercent = rate(report),
            currentMonthlyCents = expectedBalance(report),
            targetMonthlyCents = income * FinancialAdvisor.TARGET_SAVINGS_PERCENT / 100,
            cuts = cuts.filter { it.amountCents > 0 },
        )
    }

    private fun debt(report: AdvisorReport): AdvisorAnswer.Debt {
        val payments = report.trends
            .filter { trend ->
                trend.category.icon == "credit_card" ||
                    DEBT_WORDS.any { it in TextNormalizer.normalize(trend.category.name) }
            }
            .sumOf { it.currentCents }
        return AdvisorAnswer.Debt(payments, rate(report), monthlySaving(report))
    }

    private fun investing(report: AdvisorReport): AdvisorAnswer.Investing {
        val monthlyExpense = if (report.averageExpenseCents > 0) report.averageExpenseCents else report.summary.expenseCents
        return AdvisorAnswer.Investing(
            ratePercent = rate(report),
            monthlySavingCents = monthlySaving(report),
            emergencyTargetCents = monthlyExpense * FinancialAdvisor.EMERGENCY_MONTHS,
            hasDebtPayments = debt(report).debtPaymentsCents > 0,
        )
    }
}
