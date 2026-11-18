package com.flowmoney.presentation.ui.advisor

import android.content.res.Configuration
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.flowmoney.R
import com.flowmoney.domain.advisor.AdvisorAnswer
import com.flowmoney.domain.advisor.AdvisorInput
import com.flowmoney.domain.advisor.AdvisorQuestions
import com.flowmoney.domain.advisor.AdvisorReport
import com.flowmoney.domain.advisor.FinancialAdvisor
import com.flowmoney.domain.advisor.HealthScore
import com.flowmoney.domain.advisor.Severity
import com.flowmoney.domain.advisor.SpendingSplit
import com.flowmoney.domain.model.DefaultCategories
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.presentation.format.DateFormat
import com.flowmoney.presentation.format.LocalMoneyFormatter
import com.flowmoney.presentation.format.MoneyFormatter
import com.flowmoney.presentation.theme.FlowMoneyTheme
import java.time.LocalDate
import java.time.YearMonth

@Composable
fun AdvisorScreen(viewModel: AdvisorViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    AdvisorContent(state = state, writer = rememberAdvisorWriter(), onEvent = viewModel::onEvent)
}

/** Redactor con la moneda elegida y el idioma del teléfono. */
@Composable
fun rememberAdvisorWriter(): AdvisorWriter {
    val money = LocalMoneyFormatter.current
    return remember(money) { AdvisorWriter(money = money::format, monthName = { DateFormat.monthName(it) }, currency = money.currency) }
}

/** UI sin estado: fácil de previsualizar y de probar. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdvisorContent(
    state: AdvisorUiState,
    writer: AdvisorWriter,
    onEvent: (AdvisorEvent) -> Unit,
    modifier: Modifier = Modifier,
) {
    Scaffold(
        modifier = modifier,
        topBar = { TopAppBar(title = { Text(stringResource(R.string.advisor_title)) }) },
    ) { padding ->
        Column(Modifier.padding(top = padding.calculateTopPadding()).fillMaxSize()) {
            TabSelector(state.tab) { onEvent(AdvisorEvent.TabSelected(it)) }
            val report = state.report
            when {
                report == null -> Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                state.tab == AdvisorTab.OVERVIEW -> AdvisorOverview(report, writer)
                else -> AdvisorChat(state, writer, onEvent)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TabSelector(selected: AdvisorTab, onSelect: (AdvisorTab) -> Unit) {
    val label = stringResource(R.string.advisor_tabs)
    val options = listOf(AdvisorTab.OVERVIEW to R.string.advisor_tab_overview, AdvisorTab.ASK to R.string.advisor_tab_ask)
    SingleChoiceSegmentedButtonRow(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp).semantics { contentDescription = label },
    ) {
        options.forEachIndexed { index, (tab, text) ->
            SegmentedButton(
                selected = tab == selected,
                onClick = { onSelect(tab) },
                shape = SegmentedButtonDefaults.itemShape(index = index, count = options.size),
            ) { Text(stringResource(text)) }
        }
    }
}

// -------------------------------------------------------------------------------------------
// Mi análisis
// -------------------------------------------------------------------------------------------

/** Nota de salud, cierre estimado, regla 50/30/20 y recomendaciones del mes. */
@Composable
fun AdvisorOverview(report: AdvisorReport, writer: AdvisorWriter, modifier: Modifier = Modifier) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (!report.hasData) {
            item(key = "empty") { EmptyAdvisor() }
            return@LazyColumn
        }
        item(key = "score") { ScoreCard(report.score, writer) }
        report.projection?.let { projection ->
            item(key = "projection") {
                AdviceCard(writer.answer(AdvisorAnswer.Projection(projection, report.summary)))
            }
        }
        if (report.split.incomeCents > 0) item(key = "split") { SplitCard(report.split) }
        if (report.insights.isNotEmpty()) {
            item(key = "header") {
                Text(
                    text = stringResource(R.string.advisor_recommendations),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(start = 4.dp, top = 4.dp).semantics { heading() },
                )
            }
            items(report.insights.size, key = { "insight-$it" }) { index ->
                val insight = report.insights[index]
                AdviceCard(writer.insight(insight), insight.severity)
            }
        }
        item(key = "disclaimer") { Disclaimer(writer.disclaimer) }
    }
}

@Composable
private fun EmptyAdvisor() {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(stringResource(R.string.advisor_empty_title), style = MaterialTheme.typography.titleMedium)
            Text(
                text = stringResource(R.string.advisor_empty_body),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun ScoreCard(score: HealthScore, writer: AdvisorWriter) {
    val colors = MaterialTheme.colorScheme
    val tint = when (score.grade) {
        HealthScore.Grade.EXCELLENT, HealthScore.Grade.GOOD -> colors.primary
        HealthScore.Grade.FAIR -> colors.secondary
        HealthScore.Grade.NEEDS_ATTENTION -> colors.error
    }
    val scoreText = stringResource(R.string.advisor_score_value, score.score)
    Surface(shape = MaterialTheme.shapes.large, color = colors.surfaceContainerLow) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Box(Modifier.size(88.dp).clearAndSetSemantics { contentDescription = scoreText }, contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(
                        progress = { score.score / 100f },
                        modifier = Modifier.fillMaxSize(),
                        color = tint,
                        trackColor = colors.surfaceContainerHighest,
                        strokeWidth = 8.dp,
                        strokeCap = StrokeCap.Round,
                    )
                    Text("${score.score}", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold)
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(stringResource(R.string.advisor_score_label), style = MaterialTheme.typography.labelMedium, color = colors.onSurfaceVariant)
                    Text(writer.grade(score.grade), style = MaterialTheme.typography.titleLarge, color = tint)
                    Text(writer.verdict(score.grade), style = MaterialTheme.typography.bodyMedium)
                }
            }
            score.parts.forEach { part ->
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row {
                        Text(writer.scorePart(part.kind), style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
                        Text(
                            text = stringResource(R.string.advisor_score_part, part.points, part.max),
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.onSurfaceVariant,
                        )
                    }
                    LinearProgressIndicator(
                        progress = { if (part.max > 0) part.points.toFloat() / part.max else 0f },
                        modifier = Modifier.fillMaxWidth().height(6.dp),
                        color = tint,
                        trackColor = colors.surfaceContainerHighest,
                        strokeCap = StrokeCap.Round,
                    )
                }
            }
        }
    }
}

/** Reparto de los ingresos en necesidades, gustos y ahorro frente a la meta 50/30/20. */
@Composable
private fun SplitCard(split: SpendingSplit) {
    val colors = MaterialTheme.colorScheme
    val rows = listOf(
        Triple(R.string.advisor_split_needs, split.needsCents, 50),
        Triple(R.string.advisor_split_wants, split.wantsCents, FinancialAdvisor.WANTS_LIMIT_PERCENT),
        Triple(R.string.advisor_split_savings, split.savedCents + split.savingsCategoryCents, FinancialAdvisor.TARGET_SAVINGS_PERCENT),
    )
    Surface(shape = MaterialTheme.shapes.large, color = colors.surfaceContainerLow) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(stringResource(R.string.advisor_split_title), style = MaterialTheme.typography.titleMedium)
            Text(stringResource(R.string.advisor_split_body), style = MaterialTheme.typography.bodySmall, color = colors.onSurfaceVariant)
            rows.forEachIndexed { index, (label, cents, target) ->
                val percent = split.percentOfIncome(cents) ?: 0
                // Ahorro: más es mejor. Necesidades y gustos: pasarse de la meta es la alerta.
                val onTarget = if (index == 2) percent >= target else percent <= target
                val name = stringResource(label)
                val description = stringResource(R.string.advisor_split_description, name, percent, target)
                Column(Modifier.clearAndSetSemantics { contentDescription = description }, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row {
                        Text(name, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                        Text(stringResource(R.string.advisor_split_value, percent, target), style = MaterialTheme.typography.bodyMedium)
                    }
                    LinearProgressIndicator(
                        progress = { (percent / 100f).coerceIn(0f, 1f) },
                        modifier = Modifier.fillMaxWidth().height(8.dp),
                        color = if (onTarget) colors.primary else colors.error,
                        trackColor = colors.surfaceContainerHighest,
                        strokeCap = StrokeCap.Round,
                    )
                }
            }
        }
    }
}

/** Un consejo o una respuesta: título, párrafos, datos y pasos. [severity] añade la etiqueta de urgencia. */
@Composable
fun AdviceCard(text: AdviceText, severity: Severity? = null, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    Surface(shape = MaterialTheme.shapes.large, color = colors.surfaceContainerLow, modifier = modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            severity?.let { SeverityBadge(it) }
            Text(text.title, style = MaterialTheme.typography.titleMedium)
            text.body.forEach { Text(it, style = MaterialTheme.typography.bodyMedium) }
            if (text.bullets.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    text.bullets.forEach { Text("•  $it", style = MaterialTheme.typography.bodyMedium, color = colors.onSurfaceVariant) }
                }
            }
            if (text.actions.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    text.actions.forEach { action ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("→", style = MaterialTheme.typography.bodyMedium, color = colors.primary, fontWeight = FontWeight.SemiBold)
                            Text(action, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SeverityBadge(severity: Severity) {
    val colors = MaterialTheme.colorScheme
    val (label, container, content) = when (severity) {
        Severity.CRITICAL -> Triple(R.string.advisor_severity_critical, colors.errorContainer, colors.onErrorContainer)
        Severity.WARNING -> Triple(R.string.advisor_severity_warning, colors.secondaryContainer, colors.onSecondaryContainer)
        Severity.TIP -> Triple(R.string.advisor_severity_tip, colors.surfaceContainerHighest, colors.onSurface)
        Severity.POSITIVE -> Triple(R.string.advisor_severity_positive, colors.primaryContainer, colors.onPrimaryContainer)
    }
    Surface(shape = CircleShape, color = container, contentColor = content) {
        Text(stringResource(label), style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp))
    }
}

@Composable
private fun Disclaimer(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(horizontal = 4.dp),
    )
}

// -------------------------------------------------------------------------------------------
// Preguntar
// -------------------------------------------------------------------------------------------

/** Caja de preguntas, sugerencias y conversación (la respuesta más reciente arriba). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AdvisorChat(state: AdvisorUiState, writer: AdvisorWriter, onEvent: (AdvisorEvent) -> Unit, modifier: Modifier = Modifier) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "input") {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = state.question,
                    onValueChange = { onEvent(AdvisorEvent.QuestionChanged(it)) },
                    label = { Text(stringResource(R.string.advisor_ask_label)) },
                    placeholder = { Text(stringResource(R.string.advisor_ask_placeholder)) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = { onEvent(AdvisorEvent.AskClicked) }),
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = { onEvent(AdvisorEvent.AskClicked) }, enabled = state.canAsk) {
                    Icon(Icons.AutoMirrored.Rounded.Send, contentDescription = stringResource(R.string.advisor_send))
                }
            }
        }
        item(key = "suggestions") {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(stringResource(R.string.advisor_try), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    writer.suggestedQuestions.forEach { question ->
                        SuggestionChip(onClick = { onEvent(AdvisorEvent.SuggestionClicked(question)) }, label = { Text(question) })
                    }
                }
            }
        }
        items(state.conversation, key = { "entry-${it.id}" }) { entry -> ChatItem(entry, writer) }
        if (state.conversation.isNotEmpty()) {
            item(key = "clear") {
                TextButton(onClick = { onEvent(AdvisorEvent.ClearConversation) }) { Text(stringResource(R.string.advisor_clear)) }
            }
        }
        item(key = "disclaimer") { Disclaimer(writer.disclaimer) }
    }
}

@Composable
private fun ChatItem(entry: ChatEntry, writer: AdvisorWriter) {
    val colors = MaterialTheme.colorScheme
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        // Pregunta del usuario, a la derecha como en un chat.
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
            Surface(shape = MaterialTheme.shapes.large, color = colors.secondaryContainer, contentColor = colors.onSecondaryContainer) {
                Column(Modifier.widthIn(max = 300.dp).padding(horizontal = 14.dp, vertical = 10.dp)) {
                    Text(stringResource(R.string.advisor_you_asked), style = MaterialTheme.typography.labelSmall)
                    Text(entry.question, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Rounded.AutoAwesome, contentDescription = null, tint = colors.primary, modifier = Modifier.padding(top = 16.dp).size(20.dp))
            AdviceCard(writer.answer(entry.answer))
        }
    }
}

// -------------------------------------------------------------------------------------------

private val previewReport: AdvisorReport by lazy {
    val categories = DefaultCategories.all.mapIndexed { index, category -> category.copy(id = index + 1L) }
    fun id(name: String) = categories.first { it.name == name }.id
    val today = LocalDate.of(2026, 11, 18)
    var nextId = 1L
    val transactions = buildList {
        for (month in 8..10) {
            val ym = YearMonth.of(2026, month)
            add(Transaction(nextId++, 350_000, "Sueldo", ym.atDay(1), TransactionType.INCOME, id("Salario")))
            add(Transaction(nextId++, 110_000, "Alquiler", ym.atDay(2), TransactionType.EXPENSE, id("Hogar")))
            add(Transaction(nextId++, 80_000, "Mercado", ym.atDay(6), TransactionType.EXPENSE, id("Alimentación")))
            add(Transaction(nextId++, 3_990, "Netflix", ym.atDay(12), TransactionType.EXPENSE, id("Entretenimiento")))
        }
        add(Transaction(nextId++, 350_000, "Sueldo", today.withDayOfMonth(1), TransactionType.INCOME, id("Salario")))
        add(Transaction(nextId++, 110_000, "Alquiler", today.withDayOfMonth(2), TransactionType.EXPENSE, id("Hogar")))
        add(Transaction(nextId++, 70_000, "Concierto", today.withDayOfMonth(13), TransactionType.EXPENSE, id("Entretenimiento")))
        add(Transaction(nextId, 3_990, "Netflix", today.withDayOfMonth(12), TransactionType.EXPENSE, id("Entretenimiento")))
    }
    FinancialAdvisor.analyze(AdvisorInput(today, categories, transactions, emptyList()))
}

private val previewWriter = AdvisorWriter(money = MoneyFormatter.Default::format, monthName = { DateFormat.monthName(it) })

@Preview(name = "Análisis", showBackground = true, heightDp = 1800)
@Preview(name = "Análisis oscuro", showBackground = true, heightDp = 1800, uiMode = Configuration.UI_MODE_NIGHT_YES)
@Composable
private fun AdvisorOverviewPreview() {
    FlowMoneyTheme { AdvisorContent(AdvisorUiState(report = previewReport), previewWriter, onEvent = {}) }
}

@Preview(name = "Preguntar", showBackground = true, heightDp = 1200)
@Composable
private fun AdvisorChatPreview() {
    val question = "¿Puedo comprar unas zapatillas de 350?"
    val entry = ChatEntry(1, question, AdvisorQuestions.answer(question, previewReport))
    FlowMoneyTheme {
        AdvisorContent(AdvisorUiState(report = previewReport, tab = AdvisorTab.ASK, conversation = listOf(entry)), previewWriter, onEvent = {})
    }
}
