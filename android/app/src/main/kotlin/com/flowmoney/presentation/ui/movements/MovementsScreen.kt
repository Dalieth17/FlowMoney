package com.flowmoney.presentation.ui.movements

import android.content.res.Configuration
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.ArrowDropDown
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
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
import com.flowmoney.domain.model.MonthSummary
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionDetails
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.presentation.components.CategoryAvatar
import com.flowmoney.presentation.format.DateFormat
import com.flowmoney.presentation.format.MoneyFormat
import com.flowmoney.presentation.theme.FlowMoneyTheme
import java.time.LocalDate
import java.time.YearMonth

@Composable
fun MovementsScreen(viewModel: MovementsViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val resources = LocalContext.current.resources

    LaunchedEffect(viewModel) {
        viewModel.messages.collect { message -> snackbarHostState.showSnackbar(message.text(resources)) }
    }

    MovementsContent(state = state, snackbarHostState = snackbarHostState, onEvent = viewModel::onEvent)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MovementsContent(
    state: MovementsUiState,
    snackbarHostState: SnackbarHostState,
    onEvent: (MovementsEvent) -> Unit,
    modifier: Modifier = Modifier,
) {
    Scaffold(
        modifier = modifier,
        topBar = { TopAppBar(title = { Text(stringResource(R.string.movements_title)) }) },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { onEvent(MovementsEvent.AddClicked) },
                // El texto del FAB extendido no llega a TalkBack: la etiqueta va en el ícono.
                icon = { Icon(Icons.Rounded.Add, contentDescription = stringResource(R.string.movements_add)) },
                text = { Text(stringResource(R.string.movements_add)) },
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
                bottom = padding.calculateBottomPadding() + 96.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item(key = "month") { MonthSelector(state.month, onEvent) }
            item(key = "summary") { SummaryCard(state.summary) }
            item(key = "filters") { FilterRow(state, onEvent) }

            when {
                state.isLoading -> item(key = "loading") {
                    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
                state.days.isEmpty() -> item(key = "empty") { EmptyMovements(state.isFiltered, onEvent) }
                else -> state.days.forEach { day ->
                    item(key = "day-${day.date}") { DayHeader(day.date, state.today) }
                    item(key = "items-${day.date}") { DayCard(day.items, onEvent) }
                }
            }
        }
    }

    state.editor?.let { MovementEditorSheet(editor = it, categories = state.categories, onEvent = onEvent) }
    state.pendingDelete?.let { DeleteMovementDialog(it, onEvent) }
}

@Composable
private fun MonthSelector(month: YearMonth, onEvent: (MovementsEvent) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = { onEvent(MovementsEvent.PreviousMonth) }) {
            Icon(
                Icons.AutoMirrored.Rounded.KeyboardArrowLeft,
                contentDescription = stringResource(R.string.movements_previous_month),
            )
        }
        Text(
            text = DateFormat.month(month),
            style = MaterialTheme.typography.titleLarge,
            modifier = Modifier.weight(1f).semantics { heading() },
            textAlign = TextAlign.Center,
        )
        IconButton(onClick = { onEvent(MovementsEvent.NextMonth) }) {
            Icon(
                Icons.AutoMirrored.Rounded.KeyboardArrowRight,
                contentDescription = stringResource(R.string.movements_next_month),
            )
        }
    }
}

@Composable
private fun SummaryCard(summary: MonthSummary) {
    Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surfaceContainerLow) {
        Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            SummaryValue(
                label = stringResource(R.string.summary_income),
                value = MoneyFormat.format(summary.incomeCents),
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.weight(1f),
            )
            SummaryValue(
                label = stringResource(R.string.summary_expense),
                value = MoneyFormat.format(summary.expenseCents),
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.weight(1f),
            )
            SummaryValue(
                label = stringResource(R.string.summary_balance),
                value = MoneyFormat.format(summary.balanceCents),
                color = if (summary.balanceCents < 0) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun SummaryValue(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Column(modifier) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            value,
            style = MaterialTheme.typography.titleMedium,
            color = color,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun FilterRow(state: MovementsUiState, onEvent: (MovementsEvent) -> Unit) {
    var categoryMenuOpen by rememberSaveable { mutableStateOf(false) }
    val selectedCategory = state.categories.firstOrNull { it.id == state.categoryFilter }

    Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TypeChip(R.string.filter_all, selected = state.typeFilter == null) {
            onEvent(MovementsEvent.TypeFilterChanged(null))
        }
        TypeChip(R.string.filter_income, selected = state.typeFilter == TransactionType.INCOME) {
            onEvent(MovementsEvent.TypeFilterChanged(TransactionType.INCOME))
        }
        TypeChip(R.string.filter_expense, selected = state.typeFilter == TransactionType.EXPENSE) {
            onEvent(MovementsEvent.TypeFilterChanged(TransactionType.EXPENSE))
        }
        Box {
            FilterChip(
                selected = selectedCategory != null,
                onClick = { categoryMenuOpen = true },
                label = { Text(selectedCategory?.name ?: stringResource(R.string.filter_category)) },
                trailingIcon = { Icon(Icons.Rounded.ArrowDropDown, contentDescription = null) },
            )
            DropdownMenu(expanded = categoryMenuOpen, onDismissRequest = { categoryMenuOpen = false }) {
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.filter_all_categories)) },
                    onClick = {
                        categoryMenuOpen = false
                        onEvent(MovementsEvent.CategoryFilterChanged(null))
                    },
                )
                state.categories.forEach { category ->
                    DropdownMenuItem(
                        text = { Text(category.name) },
                        leadingIcon = { CategoryAvatar(category.icon, category.color, size = 24.dp) },
                        onClick = {
                            categoryMenuOpen = false
                            onEvent(MovementsEvent.CategoryFilterChanged(category.id))
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun TypeChip(label: Int, selected: Boolean, onClick: () -> Unit) {
    FilterChip(selected = selected, onClick = onClick, label = { Text(stringResource(label)) })
}

@Composable
private fun DayHeader(date: LocalDate, today: LocalDate) {
    val label = when (date) {
        today -> stringResource(R.string.day_today)
        today.minusDays(1) -> stringResource(R.string.day_yesterday)
        else -> DateFormat.day(date)
    }
    Text(
        text = label,
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(start = 4.dp, top = 4.dp).semantics { heading() },
    )
}

@Composable
private fun DayCard(items: List<TransactionDetails>, onEvent: (MovementsEvent) -> Unit) {
    Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surfaceContainerLow) {
        Column {
            items.forEachIndexed { index, details ->
                if (index > 0) {
                    HorizontalDivider(Modifier.padding(start = 72.dp), color = MaterialTheme.colorScheme.outlineVariant)
                }
                MovementRow(details, onEvent)
            }
        }
    }
}

@Composable
private fun MovementRow(details: TransactionDetails, onEvent: (MovementsEvent) -> Unit) {
    val (transaction, category) = details
    val amountColor = if (transaction.type == TransactionType.INCOME) {
        MaterialTheme.colorScheme.primary
    } else {
        MaterialTheme.colorScheme.onSurface
    }
    val supporting = listOfNotNull(category.name, transaction.note).joinToString(" · ")

    ListItem(
        headlineContent = { Text(transaction.description, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        supportingContent = { Text(supporting, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        leadingContent = { CategoryAvatar(iconKey = category.icon, colorHex = category.color) },
        trailingContent = {
            Text(
                MoneyFormat.signed(transaction.amountCents, transaction.type),
                style = MaterialTheme.typography.titleSmall,
                color = amountColor,
            )
        },
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
        modifier = Modifier.clickable(
            onClickLabel = stringResource(R.string.action_edit_named, transaction.description),
            onClick = { onEvent(MovementsEvent.EditClicked(details)) },
        ),
    )
}

@Composable
private fun EmptyMovements(isFiltered: Boolean, onEvent: (MovementsEvent) -> Unit) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                stringResource(if (isFiltered) R.string.movements_empty_filtered_title else R.string.movements_empty_title),
                style = MaterialTheme.typography.titleMedium,
            )
            Text(
                stringResource(if (isFiltered) R.string.movements_empty_filtered_body else R.string.movements_empty_body),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (isFiltered) {
                TextButton(onClick = { onEvent(MovementsEvent.ClearFilters) }) {
                    Text(stringResource(R.string.filter_clear))
                }
            }
        }
    }
}

@Composable
private fun DeleteMovementDialog(request: DeleteRequest, onEvent: (MovementsEvent) -> Unit) {
    AlertDialog(
        onDismissRequest = { onEvent(MovementsEvent.DeleteDismissed) },
        title = { Text(stringResource(R.string.delete_movement_title)) },
        text = { Text(stringResource(R.string.delete_movement_body, request.description)) },
        confirmButton = {
            TextButton(
                onClick = { onEvent(MovementsEvent.DeleteConfirmed) },
                colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
            ) { Text(stringResource(R.string.action_delete)) }
        },
        dismissButton = {
            TextButton(onClick = { onEvent(MovementsEvent.DeleteDismissed) }) {
                Text(stringResource(R.string.action_cancel))
            }
        },
    )
}

private val previewCategories = listOf(
    Category(id = 1, name = "Alimentación", icon = "restaurant", color = "#C25A44", isDefault = true),
    Category(id = 8, name = "Salario", icon = "work", color = "#1F4D3A", isDefault = true),
)

private val previewToday = LocalDate.of(2026, 11, 12)

private val previewState = MovementsUiState(
    month = YearMonth.of(2026, 11),
    today = previewToday,
    isLoading = false,
    categories = previewCategories,
    summary = MonthSummary(incomeCents = 420_000, expenseCents = 4_140),
    days = listOf(
        DayGroup(
            previewToday,
            listOf(
                TransactionDetails(
                    Transaction(1, 1_250, "Almuerzo", previewToday, TransactionType.EXPENSE, 1, "Con el equipo"),
                    previewCategories[0],
                ),
            ),
        ),
        DayGroup(
            previewToday.minusDays(9),
            listOf(
                TransactionDetails(
                    Transaction(2, 420_000, "Sueldo", previewToday.minusDays(9), TransactionType.INCOME, 8),
                    previewCategories[1],
                ),
            ),
        ),
    ),
)

@Preview(name = "Claro", showBackground = true)
@Preview(name = "Oscuro", showBackground = true, uiMode = Configuration.UI_MODE_NIGHT_YES)
@Composable
private fun MovementsContentPreview() {
    FlowMoneyTheme {
        MovementsContent(state = previewState, snackbarHostState = remember { SnackbarHostState() }, onEvent = {})
    }
}

@Preview(name = "Vacío", showBackground = true)
@Composable
private fun MovementsEmptyPreview() {
    FlowMoneyTheme {
        MovementsContent(
            state = previewState.copy(days = emptyList(), summary = MonthSummary()),
            snackbarHostState = remember { SnackbarHostState() },
            onEvent = {},
        )
    }
}
