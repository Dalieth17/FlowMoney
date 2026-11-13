package com.flowmoney.presentation.ui.advisor

import com.flowmoney.domain.advisor.AdvisorAnswer
import com.flowmoney.domain.advisor.AdvisorReport
import com.flowmoney.domain.advisor.AffordVerdict
import com.flowmoney.domain.advisor.CategoryTrend
import com.flowmoney.domain.advisor.FinancialAdvisor
import com.flowmoney.domain.advisor.HealthScore
import com.flowmoney.domain.advisor.Insight
import com.flowmoney.domain.advisor.RecurringExpense
import com.flowmoney.domain.advisor.SavingCut
import com.flowmoney.domain.advisor.ScorePart
import com.flowmoney.domain.model.BudgetLevel
import com.flowmoney.domain.model.BudgetStatus
import java.time.YearMonth

/** Un consejo o una respuesta ya redactados: título, párrafos, datos clave y pasos a seguir. */
data class AdviceText(
    val title: String,
    val body: List<String> = emptyList(),
    val bullets: List<String> = emptyList(),
    val actions: List<String> = emptyList(),
)

/**
 * Redacta en español los análisis del asesor, con tus cifras y acciones concretas.
 *
 * Es el único lugar con los textos del asesor. Se escriben aquí y no en strings.xml porque son
 * párrafos largos con muchas cifras y reglas de redacción (plurales, comparaciones); al ser Kotlin
 * puro se prueba en la JVM sin Android. Los montos y meses llegan ya formateados por [money] y
 * [monthName], con el idioma y la moneda del teléfono.
 */
class AdvisorWriter(
    private val money: (Long) -> String,
    private val monthName: (YearMonth) -> String,
) {
    val disclaimer: String =
        "Consejos generados en tu teléfono a partir de tus movimientos: tus datos no salen del dispositivo. " +
            "Son orientativos y educativos; para decisiones grandes consulta a un asesor financiero certificado."

    /** Preguntas de ejemplo para empezar la conversación. */
    val suggestedQuestions: List<String> = listOf(
        "¿Cómo voy este mes?",
        "¿Cuánto puedo gastar por día?",
        "¿Cómo ahorro más?",
        "¿En qué gasto más?",
        "¿Puedo comprar algo de 500?",
        "¿Cómo cierro el mes?",
        "¿Qué suscripciones tengo?",
        "¿Cuánto necesito de fondo de emergencia?",
        "¿Cómo pago mis deudas?",
        "¿Debería invertir?",
    )

    fun grade(grade: HealthScore.Grade): String = when (grade) {
        HealthScore.Grade.EXCELLENT -> "Excelente"
        HealthScore.Grade.GOOD -> "Buena"
        HealthScore.Grade.FAIR -> "Regular"
        HealthScore.Grade.NEEDS_ATTENTION -> "Necesita atención"
    }

    fun verdict(grade: HealthScore.Grade): String = when (grade) {
        HealthScore.Grade.EXCELLENT -> "Tus finanzas están en muy buena forma. Mantén el hábito y pon tu ahorro a trabajar."
        HealthScore.Grade.GOOD -> "Vas bien, con algunos puntos por ajustar. Revisa las recomendaciones para subir tu nota."
        HealthScore.Grade.FAIR -> "Hay señales de alerta. Empieza por las primeras recomendaciones: son las que más pesan."
        HealthScore.Grade.NEEDS_ATTENTION -> "Tus finanzas necesitan atención ahora. Sigue la primera recomendación hoy mismo."
    }

    fun scorePart(kind: ScorePart.Kind): String = when (kind) {
        ScorePart.Kind.SAVINGS -> "Ahorro (meta: 20 % de tus ingresos)"
        ScorePart.Kind.BUDGETS -> "Presupuestos en control"
        ScorePart.Kind.TREND -> "Gasto frente a tu promedio"
        ScorePart.Kind.BALANCE -> "Gustos frente a necesidades"
        ScorePart.Kind.CUSHION -> "Cierre del mes en positivo"
    }

    // ---------------------------------------------------------------------------------------
    // Recomendaciones
    // ---------------------------------------------------------------------------------------

    fun insight(insight: Insight): AdviceText = when (insight) {
        is Insight.Overspending -> AdviceText(
            title = "Este mes gastas más de lo que ganas",
            body = listOf(
                "Llevas ${money(insight.expenseCents)} en gastos frente a ${money(insight.incomeCents)} de ingresos: " +
                    "te faltan ${money(insight.deficitCents)}. Si se repite, ese faltante sale de tus ahorros o se " +
                    "convierte en deuda, y la deuda de consumo suele cobrar intereses altos.",
            ),
            actions = listOf(
                "Congela los gastos no esenciales (salidas, compras, antojos) hasta fin de mes.",
                "Revisa tus 3 categorías más grandes y ponles un límite en Presupuestos.",
                "Si pagaste con tarjeta de crédito, intenta pagar el total del mes para no generar intereses.",
            ),
        )

        is Insight.IncomeNotRecorded -> AdviceText(
            title = "Aún no registras ingresos este mes",
            body = listOf(
                "Llevas ${money(insight.expenseCents)} en gastos y ningún ingreso anotado. Sueles recibir " +
                    "${money(insight.usualIncomeCents)} al mes; mientras no lo registres, uso ese monto para proyectar.",
            ),
            actions = listOf("Registra tu ingreso en Movimientos (tipo Ingreso) para que el análisis sea exacto."),
        )

        is Insight.ProjectedDeficit -> {
            val projection = insight.projection
            AdviceText(
                title = "A este ritmo cerrarás el mes en rojo",
                body = listOf(
                    "Proyecto que terminarás el mes con ${money(projection.projectedExpenseCents)} en gastos frente a " +
                        "${money(projection.expectedIncomeCents)} de ingresos: faltarían " +
                        "${money(-projection.projectedBalanceCents)}. Aún quedan ${days(projection.daysLeft)} para corregirlo.",
                ),
                actions = listOf(
                    "Recorta ${money(insight.dailyCutCents)} por día en lo que queda del mes para cerrar en cero.",
                    "Pospón al próximo mes las compras que no sean urgentes.",
                    "Prioriza lo esencial: comida, transporte, servicios y deudas.",
                ),
            )
        }

        is Insight.BudgetExceeded -> {
            val status = insight.status
            val over = status.spentCents - status.limitCents
            AdviceText(
                title = "Superaste el presupuesto de ${status.category.name}",
                body = listOf(
                    "Gastaste ${money(status.spentCents)} de un límite de ${money(status.limitCents)} (${status.percent} %)" +
                        if (over > 0) ": ${money(over)} por encima." else ".",
                ),
                actions = listOf(
                    "Evita más gastos en ${status.category.name} hasta fin de mes.",
                    "Si el límite no era realista, ajústalo en Presupuestos para el próximo mes según tu promedio.",
                ),
            )
        }

        is Insight.BudgetAtRisk -> {
            val status = insight.status
            AdviceText(
                title = "${status.category.name} va camino de pasarse",
                body = listOf(
                    "Llevas ${money(status.spentCents)} de ${money(status.limitCents)} (${status.percent} %). " +
                        "A este ritmo cerrarías el mes en ${money(insight.projectedCents)}.",
                ),
                actions = listOf(
                    "Para no pasarte, gasta como máximo ${money(insight.dailyAllowanceCents)} por día en " +
                        "${status.category.name} durante los próximos ${days(insight.daysLeft)}.",
                ),
            )
        }

        is Insight.CategorySpike -> {
            val name = insight.trend.category.name
            AdviceText(
                title = "$name subió ${insight.increasePercent} % frente a tu promedio",
                body = listOf(
                    "Este mes llevas ${money(insight.trend.currentCents)} en $name, cuando sueles gastar " +
                        "${money(insight.trend.averageCents)}: ${money(insight.extraCents)} de más.",
                ),
                actions = listOf(
                    "Filtra Movimientos por $name para ver qué cambió.",
                    "Si fue algo puntual, compénsalo recortando otra categoría; si se va a repetir, ponle un presupuesto.",
                ),
            )
        }

        is Insight.LowSavings -> AdviceText(
            title = "Estás ahorrando el ${insight.ratePercent} % de tus ingresos",
            body = listOf(
                "Lo recomendado es al menos el ${FinancialAdvisor.TARGET_SAVINGS_PERCENT} %. Para llegar te faltan " +
                    "unos ${money(insight.gapToTargetCents)} al mes.",
            ),
            actions = listOf(
                "Págate primero: el día que cobres, separa el ahorro en una cuenta aparte antes de gastar.",
                "Automatiza esa transferencia para no depender de la fuerza de voluntad.",
                "Pregúntame «¿Cómo ahorro más?» y te propongo recortes con tus números.",
            ),
        )

        is Insight.WantsTooHigh -> AdviceText(
            title = "Tus gustos se llevan el ${insight.wantsPercent} % de tus ingresos",
            body = listOf(
                "La regla 50/30/20 sugiere no destinar más del ${FinancialAdvisor.WANTS_LIMIT_PERCENT} % a gustos. " +
                    "Este mes estás ${money(insight.excessCents)} por encima.",
            ),
            bullets = insight.topWants.map { "${it.category.name}: ${money(it.currentCents)}" },
            actions = listOf(
                "Elige un gusto para pausar este mes (por ejemplo, salidas o compras por internet).",
                "Antes de una compra no planificada, espera 48 horas: muchas ganas se pasan solas.",
            ),
        )

        is Insight.SmallExpenses -> AdviceText(
            title = "Gastos hormiga: ${insight.count} compras pequeñas suman ${money(insight.totalCents)}",
            body = listOf(
                "Son gastos chicos que pasan desapercibidos" +
                    (insight.topCategory?.let { ", sobre todo en ${it.name}" } ?: "") +
                    ". A este ritmo serían unos ${money(insight.yearlyCents)} al año.",
            ),
            actions = listOf(
                "Ponles un tope semanal (por ejemplo, para cafés y snacks).",
                "Reducirlos a la mitad liberaría ${money(insight.totalCents / 2)} este mes.",
            ),
        )

        is Insight.Subscriptions -> subscriptions(insight.items)

        is Insight.SuggestBudget -> {
            val trend = insight.trend
            val reference = if (trend.averageCents > 0) {
                "Gastas en promedio ${money(trend.averageCents)} al mes en ${trend.category.name}"
            } else {
                "Este mes llevas ${money(trend.currentCents)} en ${trend.category.name}"
            }
            AdviceText(
                title = "Ponle un límite a ${trend.category.name}",
                body = listOf(
                    "$reference y no tiene presupuesto. Un límite de ${money(insight.suggestedLimitCents)} (un 10 % " +
                        "menos de lo habitual) te ayuda a controlarlo, y te aviso al llegar al 80 %.",
                ),
                actions = listOf("Créalo en la pestaña Presupuestos."),
            )
        }

        is Insight.EmergencyFund -> emergencyFund(insight)

        is Insight.GoodSavings -> AdviceText(
            title = "¡Bien! Ahorras el ${insight.ratePercent} % de tus ingresos",
            body = listOf("Superas el ${FinancialAdvisor.TARGET_SAVINGS_PERCENT} % recomendado. Ese margen es el motor de tus metas grandes."),
            actions = listOf(
                "Si aún no tienes fondo de emergencia, complétalo primero.",
                "Con el fondo listo, considera invertir a largo plazo lo que supere tu meta.",
            ),
        )

        is Insight.SpendingDown -> AdviceText(
            title = "Vas a gastar ${insight.decreasePercent} % menos que tu promedio",
            body = listOf(
                "Proyecto ${money(insight.projectedCents)} en gastos este mes frente a " +
                    "${money(insight.averageCents)} habituales.",
            ),
            actions = listOf(
                "Lleva la diferencia (${money(insight.averageCents - insight.projectedCents)}) directo a tu ahorro antes de que se gaste.",
            ),
        )

        is Insight.BudgetsOnTrack -> AdviceText(
            title = if (insight.count == 1) "Tu presupuesto va en control" else "Tus ${insight.count} presupuestos van en control",
            body = listOf("Ninguno llega al 80 % ni va camino de pasarse."),
            actions = listOf("Revisa los límites a fin de mes y ajústalos si te sobró mucho."),
        )
    }

    private fun subscriptions(items: List<RecurringExpense>): AdviceText {
        val monthly = items.sumOf { it.monthlyCents }
        val count = items.size
        return AdviceText(
            title = if (count == 1) "Tienes 1 suscripción activa" else "Tienes $count suscripciones activas",
            body = listOf("Suman ${money(monthly)} al mes, es decir ${money(monthly * 12)} al año."),
            bullets = items.map { "${it.description}: ${money(it.monthlyCents)} al mes (${money(it.yearlyCents)} al año)" },
            actions = listOf(
                "Cancela las que no usaste el último mes.",
                "Revisa si hay planes familiares o anuales: suelen salir más baratos.",
                "Anótalas siempre con el mismo nombre para que te avise si cambian de precio.",
            ),
        )
    }

    /** Suscripciones (cancelables) y pagos fijos (renegociables), cada uno con su consejo. */
    private fun recurring(items: List<RecurringExpense>): AdviceText {
        if (items.isEmpty()) {
            return AdviceText(
                title = "No detecto pagos que se repitan",
                body = listOf(
                    "Busco gastos con la misma descripción y casi el mismo importe en al menos 2 de los últimos 3 " +
                        "meses. Anota tus suscripciones siempre con el mismo nombre (por ejemplo, «Netflix») para detectarlas.",
                ),
            )
        }
        val subscriptions = items.filter { it.isSubscription }
        val fixed = items.filterNot { it.isSubscription }
        val fixedTotal = fixed.sumOf { it.monthlyCents }
        val fixedBullets = fixed.map { "${it.description}: ${money(it.monthlyCents)} al mes (pago fijo)" }
        if (subscriptions.isEmpty()) {
            return AdviceText(
                title = "Tus pagos fijos suman ${money(fixedTotal)} al mes",
                body = listOf("Son gastos necesarios que se repiten cada mes con el mismo importe; no veo suscripciones de ocio."),
                bullets = fixedBullets,
                actions = listOf(
                    "Una vez al año, compara precios o renegocia: internet, telefonía, seguros y alquiler suelen tener margen.",
                    "Programa estos pagos para el día después de cobrar y así nunca te atrasas.",
                ),
            )
        }
        val base = subscriptions(subscriptions)
        return if (fixed.isEmpty()) {
            base
        } else {
            base.copy(
                body = base.body + "Además tienes ${fixed.size} ${if (fixed.size == 1) "pago fijo" else "pagos fijos"} " +
                    "necesarios por ${money(fixedTotal)} al mes; esos no se cancelan, pero se pueden renegociar.",
                bullets = base.bullets + fixedBullets,
            )
        }
    }

    private fun emergencyFund(plan: Insight.EmergencyFund): AdviceText {
        val months = plan.monthsToTarget
        val oneMonth = plan.targetCents / FinancialAdvisor.EMERGENCY_MONTHS
        val pace = if (months != null) {
            "Ahorrando ${money(plan.monthlySavingCents)} al mes, como en los últimos meses, juntarías el mínimo en ${monthsText(months)}."
        } else {
            "Hoy no te queda ahorro mensual: el primer paso es gastar menos de lo que ganas."
        }
        return AdviceText(
            title = "Tu fondo de emergencia: entre ${money(plan.targetCents)} y ${money(plan.idealCents)}",
            body = listOf(
                "Lo recomendable es tener guardados de ${FinancialAdvisor.EMERGENCY_MONTHS} a " +
                    "${FinancialAdvisor.EMERGENCY_IDEAL_MONTHS} meses de gastos para imprevistos: quedarte sin " +
                    "ingresos, salud o reparaciones. Te evita endeudarte cuando pasa algo.",
                pace,
            ),
            actions = listOf(
                "Empieza con una meta pequeña: un mes de gastos (${money(oneMonth)}).",
                "Guárdalo en una cuenta separada, segura y de fácil acceso; no en inversiones que puedan bajar.",
                "Úsalo solo para emergencias reales y repónlo después.",
            ),
        )
    }

    // ---------------------------------------------------------------------------------------
    // Respuestas a preguntas
    // ---------------------------------------------------------------------------------------

    fun answer(answer: AdvisorAnswer): AdviceText = when (answer) {
        AdvisorAnswer.NoData -> AdviceText(
            title = "Aún no tengo datos tuyos",
            body = listOf(
                "Registra tus ingresos y gastos en Movimientos y podré responderte con tus propias cifras: cuánto " +
                    "gastas, cuánto puedes gastar por día, si te alcanza para una compra y cómo ahorrar más.",
            ),
        )

        AdvisorAnswer.Unknown -> AdviceText(
            title = "No entendí la pregunta",
            body = listOf("Puedo ayudarte con preguntas como estas:"),
            bullets = suggestedQuestions.take(6),
        )

        is AdvisorAnswer.Overview -> overview(answer.report)
        is AdvisorAnswer.TotalSpending -> totalSpending(answer)
        is AdvisorAnswer.CategorySpending -> categorySpending(answer)
        is AdvisorAnswer.TopCategories -> topCategories(answer)
        is AdvisorAnswer.DailyAllowance -> dailyAllowance(answer)
        is AdvisorAnswer.SavingsPlan -> savingsPlan(answer)
        is AdvisorAnswer.Affordability -> affordability(answer)

        AdvisorAnswer.AffordabilityNeedsPrice -> AdviceText(
            title = "¿Cuánto cuesta?",
            body = listOf(
                "Dime el precio y lo comparo con tus números del mes. Por ejemplo: «¿Puedo comprar un celular de 1500?».",
            ),
        )

        is AdvisorAnswer.Subscriptions -> recurring(answer.items)

        is AdvisorAnswer.Budgets -> budgets(answer)

        is AdvisorAnswer.EmergencyFund -> answer.plan?.let(::emergencyFund) ?: AdviceText(
            title = "Tu fondo de emergencia",
            body = listOf(
                "Lo recomendable es guardar de 3 a 6 meses de gastos. Registra los gastos de al menos un mes y te digo la cifra exacta.",
            ),
        )

        is AdvisorAnswer.Debt -> debt(answer)
        is AdvisorAnswer.Investing -> investing(answer)
        is AdvisorAnswer.Projection -> projection(answer)
    }

    private fun overview(report: AdvisorReport): AdviceText {
        val summary = report.summary
        val rate = report.savingsRatePercent
        val month = monthName(report.month)
        val numbers = buildString {
            append("En $month llevas ${money(summary.incomeCents)} de ingresos y ${money(summary.expenseCents)} de gastos ")
            append("(balance ${money(summary.balanceCents)})")
            if (rate != null) append("; estás ahorrando el $rate %")
            append(".")
        }
        val top = report.insights.take(3)
        return AdviceText(
            title = "Tu salud financiera: ${report.score.score}/100 (${grade(report.score.grade).lowercase()})",
            body = listOf(verdict(report.score.grade), numbers),
            bullets = top.map { insight(it).title },
            actions = top.mapNotNull { insight(it).actions.firstOrNull() }.take(2),
        )
    }

    private fun totalSpending(answer: AdvisorAnswer.TotalSpending): AdviceText {
        val expense = answer.summary.expenseCents
        val comparison = if (answer.averageExpenseCents > 0) {
            "Tu promedio mensual de los meses anteriores es ${money(answer.averageExpenseCents)}."
        } else {
            "Aún no tengo meses anteriores para comparar."
        }
        return AdviceText(
            title = "Llevas ${money(expense)} en gastos este mes",
            body = listOf(comparison),
            bullets = answer.top.map { "${it.category.name}: ${money(it.currentCents)} (${share(it.currentCents, expense)})" },
        )
    }

    private fun categorySpending(answer: AdvisorAnswer.CategorySpending): AdviceText {
        val name = answer.category.name
        val trend = answer.trend
        if (trend == null || (trend.currentCents == 0L && trend.averageCents == 0L)) {
            return AdviceText(title = "$name: sin gastos", body = listOf("No registras gastos en $name este mes ni en los anteriores."))
        }
        val body = mutableListOf<String>()
        if (answer.monthExpenseCents > 0 && trend.currentCents > 0) {
            body += "Es el ${share(trend.currentCents, answer.monthExpenseCents)} de todo lo que gastaste este mes."
        }
        if (trend.averageCents > 0) {
            val change = percentChange(trend.currentCents, trend.averageCents)
            body += when {
                change > 10 -> "Vas $change % por encima de tu promedio (${money(trend.averageCents)} al mes)."
                change < -10 -> "Vas ${-change} % por debajo de tu promedio (${money(trend.averageCents)} al mes). ¡Bien!"
                else -> "Estás en línea con tu promedio (${money(trend.averageCents)} al mes)."
            }
        }
        trend.budget?.let { status ->
            body += when (status.level) {
                BudgetLevel.OVER_LIMIT -> "Superaste su presupuesto de ${money(status.limitCents)} (${status.percent} %)."
                BudgetLevel.NEAR_LIMIT -> "Estás cerca de su presupuesto de ${money(status.limitCents)} (${status.percent} %): " +
                    "te quedan ${money(status.remainingCents)}."
                BudgetLevel.ON_TRACK -> "Vas en control de su presupuesto de ${money(status.limitCents)} (${status.percent} %)."
            }
        }
        val actions = if (trend.budget == null && trend.currentCents > 0) {
            listOf("Ponle un presupuesto a $name y te aviso al llegar al 80 %.")
        } else {
            emptyList()
        }
        return AdviceText(title = "$name: ${money(trend.currentCents)} este mes", body = body, actions = actions)
    }

    private fun topCategories(answer: AdvisorAnswer.TopCategories): AdviceText {
        if (answer.top.isEmpty()) return AdviceText(title = "Aún no tienes gastos este mes")
        val first = answer.top.first()
        return AdviceText(
            title = "Tu dinero se va sobre todo en ${first.category.name}",
            body = listOf("Estas son tus categorías con más gasto este mes, sobre un total de ${money(answer.monthExpenseCents)}:"),
            bullets = answer.top.mapIndexed { index, trend ->
                "${index + 1}. ${trend.category.name}: ${money(trend.currentCents)} (${share(trend.currentCents, answer.monthExpenseCents)})"
            },
            actions = listOf("Un 10 % menos en la primera (${money(first.currentCents / 10)}) es el recorte que más se nota."),
        )
    }

    private fun dailyAllowance(answer: AdvisorAnswer.DailyAllowance): AdviceText {
        if (answer.expectedIncomeCents <= 0) {
            return AdviceText(
                title = "Necesito tu ingreso para calcularlo",
                body = listOf("Registra tus ingresos del mes en Movimientos y te digo cuánto puedes gastar por día."),
            )
        }
        val explanation = "De tus ingresos (${money(answer.expectedIncomeCents)}) ya gastaste ${money(answer.spentCents)} " +
            "y reservo ${money(answer.reservedSavingsCents)} (el ${FinancialAdvisor.TARGET_SAVINGS_PERCENT} %) para tu ahorro."
        return if (answer.availableCents > 0) {
            AdviceText(
                title = "Puedes gastar ${money(answer.perDayCents)} por día",
                body = listOf(explanation, "Te quedan ${money(answer.availableCents)} para ${days(answer.daysLeft)}, contando hoy."),
                actions = listOf(
                    "Si un día gastas menos, el sobrante pasa al siguiente.",
                    "Separa ya el ahorro reservado para no gastarlo sin darte cuenta.",
                ),
            )
        } else {
            AdviceText(
                title = "Este mes ya no te queda margen",
                body = listOf(explanation, "Con esa reserva te pasas por ${money(-answer.availableCents)}."),
                actions = listOf(
                    "Limítate a lo esencial hasta fin de mes.",
                    "Si no puedes recortar, ahorra menos este mes, pero evita endeudarte.",
                ),
            )
        }
    }

    private fun savingsPlan(answer: AdvisorAnswer.SavingsPlan): AdviceText {
        val status = when {
            answer.ratePercent == null -> "Registra tus ingresos para medir tu ahorro."
            answer.currentMonthlyCents < 0 ->
                "Este mes vas camino de gastar ${money(-answer.currentMonthlyCents)} más de lo que ganas. Para ahorrar el " +
                    "${FinancialAdvisor.TARGET_SAVINGS_PERCENT} % (${money(answer.targetMonthlyCents)}) necesitas liberar ${money(answer.gapCents)} al mes."
            answer.gapCents > 0 ->
                "Hoy ahorras ${money(answer.currentMonthlyCents)} al mes (${answer.ratePercent} %). " +
                    "La meta del ${FinancialAdvisor.TARGET_SAVINGS_PERCENT} % es ${money(answer.targetMonthlyCents)}: te faltan ${money(answer.gapCents)}."
            else ->
                "Ya alcanzas la meta del ${FinancialAdvisor.TARGET_SAVINGS_PERCENT} % (${money(answer.targetMonthlyCents)}); " +
                    "estos recortes te darían todavía más margen."
        }
        if (answer.cuts.isEmpty()) {
            return AdviceText(
                title = "Tu plan para ahorrar más",
                body = listOf(
                    status,
                    "Tus gastos ya son bastante ajustados. La palanca ahora es aumentar ingresos: horas extra, vender lo " +
                        "que no usas o un ingreso adicional.",
                ),
                actions = listOf("Págate primero: separa el ahorro apenas cobres."),
            )
        }
        return AdviceText(
            title = "Tu plan para ahorrar más",
            body = listOf(
                status,
                "Con estos cambios podrías liberar ${money(answer.potentialCents)} al mes, unos " +
                    "${money(answer.potentialCents * 12)} al año:",
            ),
            bullets = answer.cuts.map(::cutText),
            actions = listOf(
                "Págate primero: el día que cobres, separa el ahorro en otra cuenta.",
                "Pon presupuesto a las categorías de la lista y te aviso antes de pasarte.",
            ),
        )
    }

    private fun cutText(cut: SavingCut): String {
        val name = cut.trend?.category?.name
        return when (cut.kind) {
            SavingCut.Kind.TRIM_WANTS -> "Gastar un 20 % menos en $name: +${money(cut.amountCents)} al mes"
            SavingCut.Kind.BACK_TO_AVERAGE -> "Volver $name a su promedio: +${money(cut.amountCents)} al mes"
            SavingCut.Kind.SMALL_EXPENSES -> "Reducir a la mitad los gastos hormiga: +${money(cut.amountCents)} al mes"
            SavingCut.Kind.SUBSCRIPTION -> "Cancelar una suscripción que no uses: +${money(cut.amountCents)} al mes"
        }
    }

    private fun affordability(answer: AdvisorAnswer.Affordability): AdviceText {
        val price = money(answer.priceCents)
        val big = answer.expectedIncomeCents > 0 && answer.priceCents * 2 > answer.expectedIncomeCents
        val bigNote = if (big) " Es una compra grande: más de la mitad de tu ingreso mensual." else ""
        val saveFor = answer.monthsToSave?.let { months ->
            "Con lo que sueles ahorrar (${money(answer.monthlySavingCents)} al mes), lo juntarías en ${monthsText(months)}."
        }
        return when (answer.verdict) {
            AffordVerdict.COMFORTABLE -> AdviceText(
                title = "Sí, te alcanza para $price",
                body = listOf(
                    "Según mi proyección te quedan unos ${money(answer.freeCashCents)} libres este mes. Después de la " +
                        "compra seguirías ahorrando el ${answer.ratePercentAfter ?: 0} % de tus ingresos.$bigNote",
                ),
                actions = listOf("Págala al contado o con tarjeta, pero cancélala completa para no pagar intereses."),
            )

            AffordVerdict.POSSIBLE_WITH_CARE -> AdviceText(
                title = "Te alcanza, pero con cuidado",
                body = listOf(
                    "Tienes unos ${money(answer.freeCashCents)} libres este mes. Con la compra de $price tu ahorro del mes " +
                        "bajaría al ${answer.ratePercentAfter ?: 0} %, por debajo del ${FinancialAdvisor.TARGET_SAVINGS_PERCENT} % recomendado.$bigNote",
                ),
                actions = listOfNotNull(
                    "Si no es urgente, espera 48 horas y confirma que la necesitas.",
                    saveFor?.let { "Otra opción: júntalo con calma. $it" },
                ),
            )

            AffordVerdict.NOT_NOW -> AdviceText(
                title = "Mejor no por ahora",
                body = listOfNotNull(
                    if (answer.freeCashCents > 0) {
                        "$price supera lo que te queda libre este mes (${money(answer.freeCashCents)}). " +
                            "Comprarlo ahora te dejaría en rojo o con deuda.$bigNote"
                    } else {
                        "Este mes ya vas camino de cerrar en rojo (faltarían ${money(-answer.freeCashCents)}), así que no hay " +
                            "margen para una compra de $price.$bigNote"
                    },
                    saveFor,
                ),
                actions = listOf(
                    "Crea una meta: separa cada mes una parte hasta juntarlo.",
                    "Evita financiarlo con tarjeta: los intereses pueden encarecerlo mucho.",
                    "Compara precios o busca una alternativa más económica o de segunda mano.",
                ),
            )
        }
    }

    private fun budgets(answer: AdvisorAnswer.Budgets): AdviceText {
        if (answer.statuses.isEmpty()) {
            return AdviceText(
                title = "Aún no tienes presupuestos este mes",
                body = listOf(
                    if (answer.suggestions.isEmpty()) {
                        "Ponle un límite mensual a tus categorías más grandes en la pestaña Presupuestos."
                    } else {
                        "Te sugiero empezar por estos límites, un 10 % por debajo de lo que sueles gastar:"
                    },
                ),
                bullets = answer.suggestions.map { "${it.trend.category.name}: ${money(it.suggestedLimitCents)}" },
                actions = listOf("Créalos en la pestaña Presupuestos; te aviso al llegar al 80 %."),
            )
        }
        val over = answer.statuses.count { it.level == BudgetLevel.OVER_LIMIT }
        val near = answer.statuses.count { it.level == BudgetLevel.NEAR_LIMIT }
        val title = when {
            over > 0 -> if (over == 1) "1 presupuesto superado" else "$over presupuestos superados"
            near > 0 -> if (near == 1) "1 presupuesto cerca del límite" else "$near presupuestos cerca del límite"
            else -> "Todos tus presupuestos van en control"
        }
        return AdviceText(title = title, bullets = answer.statuses.map(::budgetLine))
    }

    private fun budgetLine(status: BudgetStatus): String {
        val state = when (status.level) {
            BudgetLevel.ON_TRACK -> "en control"
            BudgetLevel.NEAR_LIMIT -> "cerca del límite"
            BudgetLevel.OVER_LIMIT -> "superado"
        }
        return "${status.category.name}: ${money(status.spentCents)} de ${money(status.limitCents)} (${status.percent} %), $state"
    }

    private fun debt(answer: AdvisorAnswer.Debt): AdviceText {
        val body = mutableListOf<String>()
        if (answer.debtPaymentsCents > 0) body += "Este mes pagaste ${money(answer.debtPaymentsCents)} en tarjetas, préstamos o deudas."
        body += "Un orden que funciona para salir de deudas:"
        val actions = mutableListOf(
            "Paga siempre al menos el mínimo de todas, para no generar moras ni dañar tu historial.",
            "Elige el método: avalancha (el dinero extra va a la deuda de mayor tasa: ahorras más intereses) o bola de " +
                "nieve (va a la más pequeña: cerrarlas rápido motiva).",
            "En tarjetas de crédito, paga el total del mes y evita el avance en efectivo: es de lo más caro.",
            "Si tienes varias deudas caras, pregunta en tu banco por consolidarlas en un préstamo de menor tasa.",
        )
        if (answer.monthlySavingCents > 0) {
            actions += "Puedes destinar parte de tus ${money(answer.monthlySavingCents)} de ahorro mensual a adelantar " +
                "pagos, manteniendo un pequeño fondo para imprevistos."
        } else {
            actions += "Hoy no te sobra dinero al mes: primero ajusta gastos para liberar algo cada mes y destinarlo a la deuda."
        }
        return AdviceText(
            title = "Cómo salir de deudas más rápido",
            body = body,
            bullets = listOf("Haz una lista de tus deudas con saldo, tasa de interés anual y cuota mínima."),
            actions = actions,
        )
    }

    private fun investing(answer: AdvisorAnswer.Investing): AdviceText {
        val personal = buildList {
            if (answer.ratePercent != null) {
                add("Hoy ahorras unos ${money(answer.monthlySavingCents)} al mes (${answer.ratePercent} % de tus ingresos).")
            }
            if (answer.hasDebtPayments) add("Veo pagos de deudas este mes: revisa sus tasas antes de invertir.")
        }
        return AdviceText(
            title = "Antes de invertir, en este orden",
            body = personal + "Invertir funciona mejor cuando lo básico ya está cubierto:",
            bullets = listOf(
                "1. Sin deudas caras: pagar una tarjeta con interés alto «rinde» más que casi cualquier inversión.",
                "2. Fondo de emergencia: al menos 3 meses de gastos" +
                    (if (answer.emergencyTargetCents > 0) " (${money(answer.emergencyTargetCents)})" else "") +
                    " en un lugar seguro y disponible.",
                "3. Invierte a largo plazo solo lo que no necesitarás en 5 años o más, diversificado y con comisiones " +
                    "bajas (por ejemplo, fondos indexados o fondos mutuos de bajo costo).",
                "4. Aporta un monto fijo cada mes: reduce el riesgo de entrar en un mal momento.",
            ),
            actions = listOf(
                "Desconfía de quien promete rentabilidades altas garantizadas: suele ser una estafa.",
                "Es información educativa, no una recomendación personalizada: para invertir sumas importantes, consulta a un asesor certificado.",
            ),
        )
    }

    private fun projection(answer: AdvisorAnswer.Projection): AdviceText {
        val projection = answer.projection ?: return AdviceText(
            title = "Aún es pronto para proyectar",
            body = listOf("Necesito al menos 5 días de movimientos este mes, o un mes anterior registrado, para estimar el cierre."),
        )
        val balance = projection.projectedBalanceCents
        return AdviceText(
            title = if (balance >= 0) {
                "Cerrarías el mes con ${money(balance)} a favor"
            } else {
                "Cerrarías el mes con ${money(-balance)} en contra"
            },
            body = listOf(
                "Proyecto ${money(projection.projectedExpenseCents)} en gastos frente a ${money(projection.expectedIncomeCents)} " +
                    "de ingresos esperados. Lo calculo con tu ritmo de este mes y tu promedio de meses anteriores.",
            ),
            bullets = listOf(
                "Llevas ${money(answer.summary.expenseCents)} gastados en ${days(projection.daysElapsed)}.",
                "Quedan ${days(projection.daysLeft)} del mes.",
            ),
            actions = if (balance >= 0) {
                listOf("Lleva lo que sobre a tu ahorro apenas termine el mes.")
            } else {
                listOf("Recorta ${money(-balance / projection.daysLeft.coerceAtLeast(1))} por día para cerrar en cero.")
            },
        )
    }

    // ---------------------------------------------------------------------------------------

    private fun share(part: Long, total: Long): String = if (total > 0) "${(part * 100 / total)} %" else "0 %"

    private fun percentChange(value: Long, base: Long): Int = if (base <= 0) 0 else (((value - base) * 100.0) / base).toInt()

    private fun days(n: Int) = if (n == 1) "1 día" else "$n días"

    private fun monthsText(n: Int) = if (n == 1) "1 mes" else "$n meses"

    /** Título breve de una tendencia para listas. */
    fun trendLine(trend: CategoryTrend): String = "${trend.category.name}: ${money(trend.currentCents)}"
}
