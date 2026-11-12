package com.flowmoney.presentation.ui.budgets

import android.content.res.Configuration
import androidx.annotation.StringRes
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.flowmoney.R
import com.flowmoney.domain.model.BudgetLevel
import com.flowmoney.domain.model.BudgetOverview
import com.flowmoney.domain.model.BudgetRules
import com.flowmoney.domain.model.BudgetStatus
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.CategorySpending
import com.flowmoney.presentation.components.CategoryAvatar
import com.flowmoney.presentation.components.MonthSelector
import com.flowmoney.presentation.format.DateFormat
import com.flowmoney.presentation.format.MoneyFormat
import com.flowmoney.presentation.theme.FlowMoneyTheme
import java.time.YearMonth

@Composable
fun BudgetsScreen(viewModel: BudgetsViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val resources = LocalContext.current.resources

    LaunchedEffect(viewModel) {
        viewModel.messages.collect { message ->
            val deleted = message as? BudgetsMessage.Deleted
            val result = snackbarHostState.showSnackbar(
                message = message.text(resources),
                actionLabel = deleted?.let { resources.getString(R.string.action_undo) },
                duration = if (deleted != null) SnackbarDuration.Long else SnackbarDuration.Short,
            )
            if (deleted != null && result == SnackbarResult.ActionPerformed) {
                viewModel.onEvent(BudgetsEvent.UndoDelete(deleted.budget))
            }
        }
    }

    BudgetsContent(state = state, snackbarHostState = snackbarHostState, onEvent = viewModel::onEvent)
}

/** UI sin estado: fácil de previsualizar y de probar. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BudgetsContent(
    state: BudgetsUiState,
    snackbarHostState: SnackbarHostState,
    onEvent: (BudgetsEvent) -> Unit,
    modifier: Modifier = Modifier,
) {
    Scaffold(
        modifier = modifier,
        topBar = { TopAppBar(title = { Text(stringResource(R.string.budgets_title)) }) },
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
                    onPrevious = { onEvent(BudgetsEvent.PreviousMonth) },
                    onNext = { onEvent(BudgetsEvent.NextMonth) },
                )
            }
            if (state.isLoading) {
                item(key = "loading") {
                    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
            } else {
                overviewItems(state.overview, onEvent)
            }
        }
    }

    state.editor?.let { BudgetEditorSheet(editor = it, onEvent = onEvent) }
}

private fun LazyListScope.overviewItems(overview: BudgetOverview, onEvent: (BudgetsEvent) -> Unit) {
    if (overview.budgets.isNotEmpty()) {
        item(key = "summary") { BudgetSummaryCard(overview) }
    }
    overview.copySource?.let { source ->
        item(key = "copy") {
            CopyBudgetsCard(source = source, count = overview.copyableCount) { onEvent(BudgetsEvent.CopyClicked) }
        }
    }

    if (overview.budgets.isEmpty()) {
        item(key = "empty") { EmptyBudgets() }
    } else {
        item(key = "header-budgets") { SectionHeader(R.string.budgets_section_yours) }
        items(overview.budgets, key = { "budget-${it.category.id}" }) { status ->
            BudgetCard(status) { onEvent(BudgetsEvent.EditClicked(status)) }
        }
    }

    if (overview.unbudgeted.isNotEmpty()) {
        item(key = "header-unbudgeted") { SectionHeader(R.string.budgets_section_unbudgeted) }
        item(key = "unbudgeted") { UnbudgetedCard(overview.unbudgeted, onEvent) }
    }
}

@Composable
private fun SectionHeader(@StringRes text: Int) {
    Text(
        text = stringResource(text),
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(start = 4.dp, top = 4.dp).semantics { heading() },
    )
}

@Composable
private fun BudgetSummaryCard(overview: BudgetOverview) {
    val resources = LocalContext.current.resources
    val alerts = buildList {
        if (overview.overLimitCount > 0) {
            add(resources.getQuantityString(R.plurals.budgets_alert_over, overview.overLimitCount, overview.overLimitCount))
        }
        if (overview.nearLimitCount > 0) {
            add(resources.getQuantityString(R.plurals.budgets_alert_near, overview.nearLimitCount, overview.nearLimitCount))
        }
    }

    Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surfaceContainerLow) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.budgets_summary_spent),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = stringResource(
                    R.string.budgets_amount_of_limit,
                    MoneyFormat.format(overview.spentCents),
                    MoneyFormat.format(overview.limitCents),
                ),
                style = MaterialTheme.typography.titleLarge,
            )
            BudgetProgressBar(overview.spentCents, overview.limitCents, overview.level ?: BudgetLevel.ON_TRACK)
            Text(remainingText(overview.remainingCents), style = MaterialTheme.typography.bodyMedium)
            if (alerts.isNotEmpty()) AlertNote(alerts.joinToString(" · "))
            if (overview.unbudgetedSpentCents > 0) {
                Text(
                    text = stringResource(R.string.budgets_unbudgeted_extra, MoneyFormat.format(overview.unbudgetedSpentCents)),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** Aviso con fondo de error: el texto rojo sobre claro no tendría contraste suficiente. */
@Composable
private fun AlertNote(text: String) {
    Surface(
        shape = MaterialTheme.shapes.small,
        color = MaterialTheme.colorScheme.errorContainer,
        contentColor = MaterialTheme.colorScheme.onErrorContainer,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(Icons.Rounded.Warning, contentDescription = null, modifier = Modifier.size(18.dp))
            Text(text, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun BudgetCard(status: BudgetStatus, onClick: () -> Unit) {
    val category = status.category
    Surface(
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surfaceContainerLow,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier
                .clickable(onClickLabel = stringResource(R.string.action_edit_named, category.name), onClick = onClick)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                CategoryAvatar(iconKey = category.icon, colorHex = category.color)
                Column(Modifier.weight(1f)) {
                    Text(
                        text = category.name,
                        style = MaterialTheme.typography.titleMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = stringResource(
                            R.string.budgets_amount_of_limit,
                            MoneyFormat.format(status.spentCents),
                            MoneyFormat.format(status.limitCents),
                        ),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(stringResource(R.string.budgets_percent, status.percent), style = MaterialTheme.typography.titleMedium)
            }
            BudgetProgressBar(status.spentCents, status.limitCents, status.level)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = remainingText(status.remainingCents),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                LevelBadge(status.level)
            }
        }
    }
}

@Composable
private fun BudgetProgressBar(spentCents: Long, limitCents: Long, level: BudgetLevel) {
    val fraction = if (limitCents > 0) (spentCents.toDouble() / limitCents).coerceIn(0.0, 1.0).toFloat() else 0f
    val color = when (level) {
        BudgetLevel.ON_TRACK -> MaterialTheme.colorScheme.primary
        BudgetLevel.NEAR_LIMIT -> MaterialTheme.colorScheme.secondary
        BudgetLevel.OVER_LIMIT -> MaterialTheme.colorScheme.error
    }
    LinearProgressIndicator(
        progress = { fraction },
        modifier = Modifier.fillMaxWidth().height(8.dp),
        color = color,
        trackColor = MaterialTheme.colorScheme.surfaceContainerHighest,
        strokeCap = StrokeCap.Round,
    )
}

/** Etiqueta del nivel (solo cuando hay que llamar la atención). */
@Composable
private fun LevelBadge(level: BudgetLevel) {
    val colors = MaterialTheme.colorScheme
    val (text, container, content) = when (level) {
        BudgetLevel.ON_TRACK -> return
        BudgetLevel.NEAR_LIMIT -> Triple(R.string.budgets_badge_near, colors.secondaryContainer, colors.onSecondaryContainer)
        BudgetLevel.OVER_LIMIT -> Triple(R.string.budgets_badge_over, colors.errorContainer, colors.onErrorContainer)
    }
    Surface(shape = CircleShape, color = container, contentColor = content) {
        Text(
            text = stringResource(text),
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
        )
    }
}

@Composable
private fun remainingText(remainingCents: Long): String = when {
    remainingCents > 0 -> stringResource(R.string.budgets_remaining, MoneyFormat.format(remainingCents))
    remainingCents == 0L -> stringResource(R.string.budgets_limit_reached)
    else -> stringResource(R.string.budgets_over_by, MoneyFormat.format(-remainingCents))
}

@Composable
private fun CopyBudgetsCard(source: YearMonth, count: Int, onCopy: () -> Unit) {
    val resources = LocalContext.current.resources
    OutlinedCard(Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = stringResource(R.string.budgets_copy_title, DateFormat.monthInSentence(source)),
                    style = MaterialTheme.typography.titleSmall,
                )
                Text(
                    text = resources.getQuantityString(R.plurals.budgets_copy_body, count, count),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            FilledTonalButton(onClick = onCopy) { Text(stringResource(R.string.budgets_copy_action)) }
        }
    }
}

@Composable
private fun EmptyBudgets() {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(stringResource(R.string.budgets_empty_title), style = MaterialTheme.typography.titleMedium)
            Text(
                text = stringResource(R.string.budgets_empty_body, BudgetRules.WARNING_PERCENT),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun UnbudgetedCard(items: List<CategorySpending>, onEvent: (BudgetsEvent) -> Unit) {
    Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surfaceContainerLow) {
        Column {
            items.forEachIndexed { index, spending ->
                if (index > 0) {
                    HorizontalDivider(Modifier.padding(start = 72.dp), color = MaterialTheme.colorScheme.outlineVariant)
                }
                UnbudgetedRow(spending) { onEvent(BudgetsEvent.AddClicked(spending)) }
            }
        }
    }
}

@Composable
private fun UnbudgetedRow(spending: CategorySpending, onClick: () -> Unit) {
    val category = spending.category
    val supporting = if (spending.spentCents > 0) {
        stringResource(R.string.budgets_unbudgeted_spent, MoneyFormat.format(spending.spentCents))
    } else {
        stringResource(R.string.budgets_unbudgeted_none)
    }
    ListItem(
        headlineContent = { Text(category.name, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        supportingContent = { Text(supporting) },
        leadingContent = { CategoryAvatar(iconKey = category.icon, colorHex = category.color) },
        trailingContent = { Icon(Icons.Rounded.Add, contentDescription = null) },
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
        modifier = Modifier.clickable(
            onClickLabel = stringResource(R.string.budgets_set_limit_for, category.name),
            onClick = onClick,
        ),
    )
}

private val previewFood = Category(id = 1, name = "Alimentación", icon = "restaurant", color = "#C25A44", isDefault = true)
private val previewTransport = Category(id = 2, name = "Transporte", icon = "directions_bus", color = "#3E78A8", isDefault = true)
private val previewHome = Category(id = 7, name = "Hogar", icon = "home", color = "#A86A54", isDefault = true)
private val previewLeisure = Category(id = 3, name = "Entretenimiento", icon = "movie", color = "#7A5BA8", isDefault = true)

private val previewState = BudgetsUiState(
    month = YearMonth.of(2026, 11),
    isLoading = false,
    overview = BudgetOverview(
        budgets = listOf(
            BudgetStatus(previewFood, limitCents = 60_000, spentCents = 51_000),
            BudgetStatus(previewTransport, limitCents = 15_000, spentCents = 16_250),
            BudgetStatus(previewHome, limitCents = 80_000, spentCents = 21_000),
        ),
        unbudgeted = listOf(CategorySpending(previewLeisure, 4_500)),
        copySource = YearMonth.of(2026, 10),
        copyableCount = 1,
    ),
)

@Preview(name = "Claro", showBackground = true, heightDp = 1100)
@Preview(name = "Oscuro", showBackground = true, heightDp = 1100, uiMode = Configuration.UI_MODE_NIGHT_YES)
@Composable
private fun BudgetsContentPreview() {
    FlowMoneyTheme {
        BudgetsContent(state = previewState, snackbarHostState = remember { SnackbarHostState() }, onEvent = {})
    }
}

@Preview(name = "Sin presupuestos", showBackground = true)
@Composable
private fun BudgetsEmptyPreview() {
    FlowMoneyTheme {
        BudgetsContent(
            state = previewState.copy(
                overview = BudgetOverview(
                    unbudgeted = listOf(CategorySpending(previewFood, 12_000), CategorySpending(previewTransport, 0)),
                ),
            ),
            snackbarHostState = remember { SnackbarHostState() },
            onEvent = {},
        )
    }
}
