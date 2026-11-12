package com.flowmoney.presentation.ui.reports

import android.content.res.Resources
import androidx.annotation.StringRes
import com.flowmoney.R
import com.flowmoney.domain.model.MonthlyReport
import com.flowmoney.presentation.format.DateFormat
import com.flowmoney.presentation.format.MoneyFormat
import com.flowmoney.presentation.ui.reports.export.CategoryRow
import com.flowmoney.presentation.ui.reports.export.CategorySection
import com.flowmoney.presentation.ui.reports.export.Figure
import com.flowmoney.presentation.ui.reports.export.FlowRow
import com.flowmoney.presentation.ui.reports.export.FlowSection
import com.flowmoney.presentation.ui.reports.export.ReportDocument
import com.flowmoney.presentation.ui.reports.export.Tone
import java.time.LocalDate
import java.util.Locale

/** Traduce un [MonthlyReport] al contenido del PDF: textos de recursos y montos con el formato del teléfono. */
object ReportDocumentFactory {
    fun create(report: MonthlyReport, resources: Resources, today: LocalDate): ReportDocument {
        val summary = report.summary
        val figures = buildList {
            add(Figure(resources.getString(R.string.summary_income), MoneyFormat.format(summary.incomeCents), Tone.INCOME))
            add(Figure(resources.getString(R.string.summary_expense), MoneyFormat.format(summary.expenseCents), Tone.EXPENSE))
            add(
                Figure(
                    label = resources.getString(R.string.summary_balance),
                    value = MoneyFormat.format(summary.balanceCents),
                    tone = if (summary.balanceCents < 0) Tone.EXPENSE else Tone.NEUTRAL,
                ),
            )
            report.savingsRatePercent?.let { rate ->
                add(
                    Figure(
                        label = resources.getString(R.string.reports_savings_rate),
                        value = percentText(rate, resources),
                        tone = if (rate < 0) Tone.EXPENSE else Tone.NEUTRAL,
                    ),
                )
            }
        }

        return ReportDocument(
            languageTag = Locale.getDefault().toLanguageTag(),
            title = resources.getString(R.string.report_doc_title, DateFormat.monthInSentence(report.month)),
            subtitle = resources.getString(R.string.report_doc_generated, DateFormat.short(today)),
            figures = figures,
            note = report.expenseChangeText(resources),
            categories = CategorySection(
                title = resources.getString(R.string.reports_by_category_title),
                emptyText = resources.getString(R.string.reports_by_category_empty),
                nameHeader = resources.getString(R.string.report_doc_category),
                amountHeader = resources.getString(R.string.report_doc_amount),
                shareHeader = resources.getString(R.string.report_doc_share),
                totalLabel = resources.getString(R.string.reports_total),
                totalAmount = MoneyFormat.format(report.expensesByCategory.sumOf { it.amountCents }),
                rows = report.expensesByCategory.map { share ->
                    CategoryRow(
                        name = share.category.name,
                        colorHex = share.category.color,
                        amount = MoneyFormat.format(share.amountCents),
                        share = share.percentText(resources),
                        weightCents = share.amountCents,
                    )
                },
            ),
            flows = listOf(
                flowSection(R.string.report_doc_flow_by_week, report.weeks.map { it.toBar(resources) }, resources),
                flowSection(R.string.report_doc_flow_by_month, report.months.map { it.toBar() }, resources),
            ),
        )
    }

    private fun flowSection(@StringRes title: Int, bars: List<FlowBar>, resources: Resources) = FlowSection(
        title = resources.getString(title),
        emptyText = resources.getString(R.string.reports_flow_empty),
        periodHeader = resources.getString(R.string.reports_flow_period),
        incomeHeader = resources.getString(R.string.summary_income),
        expenseHeader = resources.getString(R.string.summary_expense),
        rows = bars.map { bar ->
            FlowRow(
                label = bar.label,
                shortLabel = bar.shortLabel,
                income = MoneyFormat.format(bar.incomeCents),
                expense = MoneyFormat.format(bar.expenseCents),
                incomeCents = bar.incomeCents,
                expenseCents = bar.expenseCents,
            )
        },
    )
}
