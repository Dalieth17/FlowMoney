package com.flowmoney.presentation.ui.categories

import android.content.res.Configuration
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LargeTopAppBar
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
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
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
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.DefaultCategories
import com.flowmoney.presentation.components.CategoryAvatar
import com.flowmoney.presentation.theme.FlowMoneyTheme

/** Punto de entrada con estado: conecta el ViewModel con la UI sin estado. */
@Composable
fun CategoriesScreen(viewModel: CategoriesViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val resources = LocalContext.current.resources

    LaunchedEffect(viewModel) {
        viewModel.messages.collect { message -> snackbarHostState.showSnackbar(message.text(resources)) }
    }

    CategoriesContent(state = state, snackbarHostState = snackbarHostState, onEvent = viewModel::onEvent)
}

/** UI sin estado: fácil de previsualizar y de probar. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategoriesContent(
    state: CategoriesUiState,
    snackbarHostState: SnackbarHostState,
    onEvent: (CategoriesEvent) -> Unit,
    modifier: Modifier = Modifier,
) {
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()

    Scaffold(
        modifier = modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            LargeTopAppBar(
                title = { Text(stringResource(R.string.categories_title)) },
                scrollBehavior = scrollBehavior,
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { onEvent(CategoriesEvent.AddClicked) },
                icon = { Icon(Icons.Rounded.Add, contentDescription = null) },
                text = { Text(stringResource(R.string.categories_add)) },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        if (state.isLoading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(
                    start = 16.dp,
                    end = 16.dp,
                    top = padding.calculateTopPadding() + 8.dp,
                    // Espacio para que el botón flotante no tape la última fila.
                    bottom = padding.calculateBottomPadding() + 96.dp,
                ),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item(key = "custom-header") { SectionHeader(stringResource(R.string.categories_section_custom)) }
                if (state.custom.isEmpty()) {
                    item(key = "custom-empty") { EmptyCustomCategories() }
                } else {
                    item(key = "custom-list") { CategoryGroup(state.custom, onEvent) }
                }
                item(key = "default-header") { SectionHeader(stringResource(R.string.categories_section_default)) }
                item(key = "default-list") { CategoryGroup(state.defaults, onEvent) }
            }
        }
    }

    state.editor?.let { CategoryEditorSheet(state = it, onEvent = onEvent) }
    state.pendingDelete?.let { DeleteCategoryDialog(category = it, onEvent = onEvent) }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier
            .padding(start = 4.dp, top = 8.dp)
            .semantics { heading() },
    )
}

@Composable
private fun EmptyCustomCategories() {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(stringResource(R.string.categories_empty_title), style = MaterialTheme.typography.titleMedium)
            Text(
                stringResource(R.string.categories_empty_body),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun CategoryGroup(categories: List<Category>, onEvent: (CategoriesEvent) -> Unit) {
    Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surfaceContainerLow) {
        Column {
            categories.forEachIndexed { index, category ->
                if (index > 0) {
                    HorizontalDivider(
                        modifier = Modifier.padding(start = 72.dp),
                        color = MaterialTheme.colorScheme.outlineVariant,
                    )
                }
                CategoryRow(category, onEvent)
            }
        }
    }
}

@Composable
private fun CategoryRow(category: Category, onEvent: (CategoriesEvent) -> Unit) {
    val supporting: (@Composable () -> Unit)? = if (category.isDefault) {
        { Text(stringResource(R.string.categories_default_badge)) }
    } else {
        null
    }
    // Las predeterminadas se pueden editar (ícono, color, nombre) pero no eliminar.
    val deleteAction: (@Composable () -> Unit)? = if (category.isDefault) {
        null
    } else {
        {
            IconButton(onClick = { onEvent(CategoriesEvent.DeleteClicked(category)) }) {
                Icon(
                    Icons.Rounded.Delete,
                    contentDescription = stringResource(R.string.action_delete_named, category.name),
                )
            }
        }
    }

    ListItem(
        headlineContent = { Text(category.name, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        supportingContent = supporting,
        leadingContent = { CategoryAvatar(iconKey = category.icon, colorHex = category.color) },
        trailingContent = deleteAction,
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
        modifier = Modifier.clickable(
            onClickLabel = stringResource(R.string.action_edit_named, category.name),
            onClick = { onEvent(CategoriesEvent.EditClicked(category)) },
        ),
    )
}

@Composable
private fun DeleteCategoryDialog(category: Category, onEvent: (CategoriesEvent) -> Unit) {
    AlertDialog(
        onDismissRequest = { onEvent(CategoriesEvent.DeleteDismissed) },
        icon = { Icon(Icons.Rounded.Delete, contentDescription = null) },
        title = { Text(stringResource(R.string.delete_category_title)) },
        text = { Text(stringResource(R.string.delete_category_body, category.name)) },
        confirmButton = {
            TextButton(
                onClick = { onEvent(CategoriesEvent.DeleteConfirmed) },
                colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
            ) { Text(stringResource(R.string.action_delete)) }
        },
        dismissButton = {
            TextButton(onClick = { onEvent(CategoriesEvent.DeleteDismissed) }) {
                Text(stringResource(R.string.action_cancel))
            }
        },
    )
}

private val previewState = CategoriesUiState(
    isLoading = false,
    defaults = DefaultCategories.all.mapIndexed { index, category -> category.copy(id = index + 1L) },
    custom = listOf(Category(id = 20, name = "Mascotas", icon = "pets", color = "#B0506B")),
)

@Preview(name = "Claro", showBackground = true)
@Preview(name = "Oscuro", showBackground = true, uiMode = Configuration.UI_MODE_NIGHT_YES)
@Composable
private fun CategoriesContentPreview() {
    FlowMoneyTheme {
        CategoriesContent(state = previewState, snackbarHostState = remember { SnackbarHostState() }, onEvent = {})
    }
}

@Preview(name = "Sin categorías propias", showBackground = true)
@Composable
private fun CategoriesEmptyPreview() {
    FlowMoneyTheme {
        CategoriesContent(
            state = previewState.copy(custom = emptyList()),
            snackbarHostState = remember { SnackbarHostState() },
            onEvent = {},
        )
    }
}
