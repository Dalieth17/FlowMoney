package com.flowmoney.presentation.ui.reports

import android.content.res.Configuration
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.PictureAsPdf
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.flowmoney.R
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.CategoryShare
import com.flowmoney.domain.model.MonthFlow
import com.flowmoney.domain.model.MonthSummary
import com.flowmoney.domain.model.MonthlyReport
import com.flowmoney.domain.model.WeekFlow
import com.flowmoney.presentation.components.MonthSelector
import com.flowmoney.presentation.components.MonthTotals
import com.flowmoney.presentation.format.MoneyFormat
import com.flowmoney.presentation.theme.FlowMoneyTheme
import com.flowmoney.presentation.ui.reports.export.ReportHtml
import com.flowmoney.util.HtmlPrinter
import com.flowmoney.util.findActivity
import com.flowmoney.util.toColorOrNull
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.YearMonth

private val DonutSize = 176.dp
private val DonutStroke = 26.dp
private val BarsHeight = 140.dp

/** Separación entre porciones de la dona, en grados. */
private const val SEGMENT_GAP = 2f

/** Una porción nunca se dibuja más fina que esto: así las categorías pequeñas siguen viéndose. */
private const val MIN_SWEEP = 1f

/** La columna del periodo es algo más ancha que las de montos. */
private const val PERIOD_COLUMN_WEIGHT = 1.2f

@Composable
fun ReportsScreen(viewModel: ReportsViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    // Imprimir necesita la Activity; el ViewModel no la conoce (ni debe).
    val printer = remember(context) { context.findActivity()?.let { HtmlPrinter(it) } }

    ReportsContent(
        state = state,
        snackbarHostState = snackbarHostState,
        onEvent = viewModel::onEvent,
        onExport = { report ->
            val document = ReportDocumentFactory.create(report, context.resources, LocalDate.now())
            val started = printer?.print(jobName = document.title, html = ReportHtml.render(document)) == true
            if (!started) {
                scope.launch { snackbarHostState.showSnackbar(context.getString(R.string.reports_export_failed)) }
            }
        },
    )
}

/** UI sin estado: fácil de previsualizar y de probar. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportsContent(
    state: ReportsUiState,
    snackbarHostState: SnackbarHostState,
    onEvent: (ReportsEvent) -> Unit,
    onExport: (MonthlyReport) -> Unit,
    modifier: Modifier = Modifier,
) {
    val report = state.report
    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.reports_title)) },
                actions = {
                    // Un mes sin movimientos no tiene nada que exportar.
                    IconButton(onClick = { report?.let(onExport) }, enabled = report != null && !report.isEmpty) {
                        Icon(Icons.Rounded.PictureAsPdf, contentDescription = stringResource(R.string.reports_export_pdf))
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                start = 16.dp,
                end = 16.dp,
                top = padding.calculateTopPadding(),
                bottom = padding.calculateBottomPadding() + 24.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item(key = "month") {
                MonthSelector(
                    month = state.month,
                    onPrevious = { onEvent(ReportsEvent.PreviousMonth) },
                    onNext = { onEvent(ReportsEvent.NextMonth) },
                )
            }
            if (report == null) {
                item(key = "loading") {
                    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
            } else {
                if (report.isEmpty) {
                    item(key = "empty") { EmptyReport() }
                } else {
                    item(key = "summary") { SummaryCard(report) }
                    item(key = "categories") { CategoriesCard(report.expensesByCategory) }
                }
                // Aunque el mes esté vacío, "Por mes" sigue mostrando los meses anteriores.
                item(key = "flow") {
                    FlowCard(report, state.barsBy) { onEvent(ReportsEvent.BarsGroupingChanged(it)) }
                }
            }
        }
    }
}

@Composable
private fun ReportCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surfaceContainerLow) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.semantics { heading() })
            content()
        }
    }
}

@Composable
private fun EmptyReport() {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(stringResource(R.string.reports_empty_title), style = MaterialTheme.typography.titleMedium)
            Text(
                text = stringResource(R.string.reports_empty_body),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** Ingresos, gastos y balance del mes, con la tasa de ahorro y la comparación con el mes anterior. */
@Composable
private fun SummaryCard(report: MonthlyReport) {
    val resources = LocalContext.current.resources
    val colors = MaterialTheme.colorScheme
    val savingsRate = report.savingsRatePercent
    val expenseChange = report.expenseChangeText(resources)

    Surface(shape = MaterialTheme.shapes.large, color = colors.surfaceContainerLow) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            MonthTotals(report.summary)
            if (savingsRate != null || expenseChange != null) {
                HorizontalDivider(color = colors.outlineVariant)
            }
            if (savingsRate != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = stringResource(R.string.reports_savings_rate),
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.onSurfaceVariant,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        text = percentText(savingsRate, resources),
                        style = MaterialTheme.typography.titleMedium,
                        color = if (savingsRate < 0) colors.error else colors.onSurface,
                    )
                }
            }
            if (expenseChange != null) {
                Text(expenseChange, style = MaterialTheme.typography.bodyMedium, color = colors.onSurfaceVariant)
            }
        }
    }
}

@Composable
internal fun CategoriesCard(shares: List<CategoryShare>) {
    ReportCard(title = stringResource(R.string.reports_by_category_title)) {
        if (shares.isEmpty()) {
            Text(
                text = stringResource(R.string.reports_by_category_empty),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            DonutChart(shares, Modifier.align(Alignment.CenterHorizontally))
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                shares.forEach { ShareRow(it) }
            }
        }
    }
}

/** Gráfico de dona: una porción por categoría, empezando arriba y en el sentido del reloj. */
@Composable
private fun DonutChart(shares: List<CategoryShare>, modifier: Modifier = Modifier) {
    val fallbackColor = MaterialTheme.colorScheme.secondary
    val segmentColors = shares.map { it.category.color.toColorOrNull() ?: fallbackColor }
    val totalCents = shares.sumOf { it.amountCents }

    Box(modifier.size(DonutSize), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            if (totalCents <= 0L) return@Canvas
            val strokeWidth = DonutStroke.toPx()
            val diameter = size.minDimension - strokeWidth
            val topLeft = Offset((size.width - diameter) / 2f, (size.height - diameter) / 2f)
            // Con una sola categoría el anillo se cierra completo, sin separación.
            val gap = if (shares.size > 1) SEGMENT_GAP else 0f
            var startAngle = -90f
            shares.forEachIndexed { index, share ->
                val sweep = (share.amountCents.toDouble() / totalCents * 360.0).toFloat()
                drawArc(
                    color = segmentColors[index],
                    startAngle = startAngle + gap / 2f,
                    sweepAngle = (sweep - gap).coerceAtLeast(MIN_SWEEP),
                    useCenter = false,
                    topLeft = topLeft,
                    size = Size(diameter, diameter),
                    style = Stroke(width = strokeWidth),
                )
                startAngle += sweep
            }
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = stringResource(R.string.reports_total),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = MoneyFormat.format(totalCents),
                style = MaterialTheme.typography.titleMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.widthIn(max = DonutSize - DonutStroke * 2 - 16.dp),
            )
        }
    }
}

/** Leyenda de la dona: color, categoría, monto y porcentaje. */
@Composable
private fun ShareRow(share: CategoryShare) {
    val resources = LocalContext.current.resources
    val color = share.category.color.toColorOrNull() ?: MaterialTheme.colorScheme.secondary
    val amount = MoneyFormat.format(share.amountCents)
    val percent = share.percentText(resources)
    val description = stringResource(R.string.reports_share_description, share.category.name, amount, percent)

    Row(
        modifier = Modifier.fillMaxWidth().clearAndSetSemantics { contentDescription = description },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(Modifier.size(12.dp).clip(CircleShape).background(color))
        Text(
            text = share.category.name,
            style = MaterialTheme.typography.bodyMedium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        Text(amount, style = MaterialTheme.typography.bodyMedium)
        Text(
            text = percent,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.End,
            modifier = Modifier.widthIn(min = 44.dp),
        )
    }
}

@Composable
private fun FlowCard(report: MonthlyReport, grouping: BarsGrouping, onGroupingChange: (BarsGrouping) -> Unit) {
    val resources = LocalContext.current.resources
    val bars = when (grouping) {
        BarsGrouping.WEEKS -> report.weeks.map { it.toBar(resources) }
        BarsGrouping.MONTHS -> report.months.map { it.toBar() }
    }

    ReportCard(title = stringResource(R.string.reports_flow_title)) {
        GroupingSelector(grouping, onGroupingChange)
        if (bars.all { it.isEmpty }) {
            Text(
                text = stringResource(R.string.reports_flow_empty),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            FlowBarChart(bars)
            FlowTable(bars)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun GroupingSelector(selected: BarsGrouping, onSelect: (BarsGrouping) -> Unit) {
    val label = stringResource(R.string.reports_flow_grouping)
    val options = listOf(
        BarsGrouping.WEEKS to R.string.reports_flow_by_week,
        BarsGrouping.MONTHS to R.string.reports_flow_by_month,
    )
    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().semantics { contentDescription = label }) {
        options.forEachIndexed { index, (grouping, text) ->
            SegmentedButton(
                selected = grouping == selected,
                onClick = { onSelect(grouping) },
                shape = SegmentedButtonDefaults.itemShape(index = index, count = options.size),
            ) { Text(stringResource(text)) }
        }
    }
}

/**
 * Barras de ingresos y gastos por periodo, a escala del valor más alto (que se muestra arriba).
 * Es decorativo para los lectores de pantalla: la tabla de debajo da los mismos datos en texto.
 */
@Composable
private fun FlowBarChart(bars: List<FlowBar>) {
    val colors = MaterialTheme.colorScheme
    val maxCents = bars.maxOf { maxOf(it.incomeCents, it.expenseCents) }.coerceAtLeast(1L)

    Column(Modifier.fillMaxWidth().clearAndSetSemantics { }, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(MoneyFormat.format(maxCents), style = MaterialTheme.typography.labelSmall, color = colors.onSurfaceVariant)
        HorizontalDivider(color = colors.outlineVariant)
        Row(Modifier.fillMaxWidth().height(BarsHeight), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            bars.forEach { bar ->
                Row(
                    modifier = Modifier.weight(1f).fillMaxHeight(),
                    horizontalArrangement = Arrangement.spacedBy(3.dp),
                    verticalAlignment = Alignment.Bottom,
                ) {
                    Bar(bar.incomeCents, maxCents, colors.primary)
                    Bar(bar.expenseCents, maxCents, colors.error)
                }
            }
        }
        HorizontalDivider(color = colors.outline)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            bars.forEach { bar ->
                Text(
                    text = bar.shortLabel,
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun RowScope.Bar(valueCents: Long, maxCents: Long, color: Color) {
    val fraction = (valueCents.toDouble() / maxCents).toFloat().coerceIn(0f, 1f)
    Box(
        Modifier
            .weight(1f)
            // Un valor pequeño frente al máximo se sigue viendo; el cero no dibuja nada.
            .then(if (valueCents > 0) Modifier.heightIn(min = 2.dp) else Modifier)
            .fillMaxHeight(fraction)
            .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
            .background(color),
    )
}

/** Mismos datos que el gráfico, en números. El encabezado hace de leyenda de colores. */
@Composable
private fun FlowTable(bars: List<FlowBar>) {
    val colors = MaterialTheme.colorScheme
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = stringResource(R.string.reports_flow_period),
                style = MaterialTheme.typography.labelMedium,
                color = colors.onSurfaceVariant,
                modifier = Modifier.weight(PERIOD_COLUMN_WEIGHT),
            )
            HeaderCell(colors.primary, stringResource(R.string.summary_income))
            HeaderCell(colors.error, stringResource(R.string.summary_expense))
        }
        bars.forEach { FlowTableRow(it) }
    }
}

@Composable
private fun RowScope.HeaderCell(color: Color, label: String) {
    Row(
        modifier = Modifier.weight(1f),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.End),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(10.dp).clip(RoundedCornerShape(3.dp)).background(color))
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun FlowTableRow(bar: FlowBar) {
    val income = MoneyFormat.format(bar.incomeCents)
    val expense = MoneyFormat.format(bar.expenseCents)
    val description = stringResource(R.string.reports_flow_row_description, bar.label, income, expense)

    // Una sola frase para TalkBack: "Semana 1 · 1–7: ingresos …, gastos …".
    Row(Modifier.fillMaxWidth().clearAndSetSemantics { contentDescription = description }) {
        Text(
            text = bar.label,
            style = MaterialTheme.typography.bodySmall,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(PERIOD_COLUMN_WEIGHT),
        )
        AmountCell(income)
        AmountCell(expense)
    }
}

@Composable
private fun RowScope.AmountCell(amount: String) {
    Text(
        text = amount,
        style = MaterialTheme.typography.bodySmall,
        textAlign = TextAlign.End,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier.weight(1f),
    )
}

private val previewFood = Category(id = 1, name = "Alimentación", icon = "restaurant", color = "#C25A44", isDefault = true)
private val previewHome = Category(id = 7, name = "Hogar", icon = "home", color = "#A86A54", isDefault = true)
private val previewTransport = Category(id = 2, name = "Transporte", icon = "directions_bus", color = "#3E78A8", isDefault = true)
private val previewMonth = YearMonth.of(2026, 11)

private val previewReport = MonthlyReport(
    month = previewMonth,
    summary = MonthSummary(incomeCents = 435_000, expenseCents = 143_040),
    previousSummary = MonthSummary(incomeCents = 420_000, expenseCents = 178_800),
    expensesByCategory = listOf(
        CategoryShare(previewFood, 79_740, 56),
        CategoryShare(previewHome, 45_000, 31),
        CategoryShare(previewTransport, 18_300, 13),
    ),
    weeks = listOf(
        WeekFlow(1, previewMonth.atDay(1), previewMonth.atDay(7), incomeCents = 420_000, expenseCents = 38_000),
        WeekFlow(2, previewMonth.atDay(8), previewMonth.atDay(14), expenseCents = 51_200),
        WeekFlow(3, previewMonth.atDay(15), previewMonth.atDay(21), expenseCents = 22_340),
        WeekFlow(4, previewMonth.atDay(22), previewMonth.atDay(28), incomeCents = 15_000, expenseCents = 29_500),
        WeekFlow(5, previewMonth.atDay(29), previewMonth.atDay(30), expenseCents = 2_000),
    ),
    months = listOf(
        MonthFlow(previewMonth.minusMonths(5), 380_000, 151_000),
        MonthFlow(previewMonth.minusMonths(4), 380_000, 240_500),
        MonthFlow(previewMonth.minusMonths(3)),
        MonthFlow(previewMonth.minusMonths(2), 400_000, 133_000),
        MonthFlow(previewMonth.minusMonths(1), 420_000, 178_800),
        MonthFlow(previewMonth, 435_000, 143_040),
    ),
)

@Preview(name = "Claro", showBackground = true, heightDp = 1300)
@Preview(name = "Oscuro", showBackground = true, heightDp = 1300, uiMode = Configuration.UI_MODE_NIGHT_YES)
@Composable
private fun ReportsContentPreview() {
    FlowMoneyTheme {
        ReportsContent(
            state = ReportsUiState(month = previewMonth, report = previewReport),
            snackbarHostState = remember { SnackbarHostState() },
            onEvent = {},
            onExport = {},
        )
    }
}

@Preview(name = "Por mes", showBackground = true, heightDp = 1300)
@Composable
private fun ReportsByMonthPreview() {
    FlowMoneyTheme {
        ReportsContent(
            state = ReportsUiState(month = previewMonth, report = previewReport, barsBy = BarsGrouping.MONTHS),
            snackbarHostState = remember { SnackbarHostState() },
            onEvent = {},
            onExport = {},
        )
    }
}

@Preview(name = "Mes vacío", showBackground = true)
@Composable
private fun ReportsEmptyPreview() {
    FlowMoneyTheme {
        ReportsContent(
            state = ReportsUiState(month = previewMonth, report = MonthlyReport(previewMonth)),
            snackbarHostState = remember { SnackbarHostState() },
            onEvent = {},
            onExport = {},
        )
    }
}
