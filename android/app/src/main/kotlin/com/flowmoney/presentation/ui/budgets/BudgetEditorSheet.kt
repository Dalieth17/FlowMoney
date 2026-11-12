package com.flowmoney.presentation.ui.budgets

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.flowmoney.R
import com.flowmoney.domain.model.BudgetRules
import com.flowmoney.presentation.components.AmountField
import com.flowmoney.presentation.components.CategoryAvatar
import com.flowmoney.presentation.format.DateFormat
import com.flowmoney.presentation.format.MoneyFormat

/** Hoja inferior para definir, cambiar o quitar el límite de una categoría. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BudgetEditorSheet(editor: BudgetEditorState, onEvent: (BudgetsEvent) -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = { onEvent(BudgetsEvent.EditorDismissed) }, sheetState = sheetState) {
        BudgetEditorForm(editor = editor, onEvent = onEvent)
    }
}

/** Contenido del formulario, sin la hoja modal: se puede previsualizar y probar por separado. */
@Composable
fun BudgetEditorForm(editor: BudgetEditorState, onEvent: (BudgetsEvent) -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp)
            .padding(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            CategoryAvatar(iconKey = editor.category.icon, colorHex = editor.category.color, size = 52.dp)
            Column {
                Text(
                    text = stringResource(if (editor.isNew) R.string.budget_editor_new else R.string.budget_editor_edit),
                    style = MaterialTheme.typography.headlineSmall,
                )
                Text(
                    text = stringResource(R.string.budget_editor_subtitle, editor.category.name, DateFormat.month(editor.month)),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        AmountField(
            value = editor.amountText,
            onValueChange = { onEvent(BudgetsEvent.AmountChanged(it)) },
            label = stringResource(R.string.budget_field_limit),
            error = editor.error?.text(),
            supportingText = stringResource(R.string.budget_spent_so_far, MoneyFormat.format(editor.spentCents)),
            imeAction = ImeAction.Done,
            onDone = { onEvent(BudgetsEvent.SaveClicked) },
        )

        Text(
            text = stringResource(R.string.budget_warning_hint, BudgetRules.WARNING_PERCENT),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            if (!editor.isNew) {
                TextButton(
                    onClick = { onEvent(BudgetsEvent.DeleteClicked) },
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
                ) { Text(stringResource(R.string.budget_remove)) }
            }
            Spacer(Modifier.weight(1f))
            TextButton(onClick = { onEvent(BudgetsEvent.EditorDismissed) }) {
                Text(stringResource(R.string.action_cancel))
            }
            Spacer(Modifier.width(8.dp))
            Button(onClick = { onEvent(BudgetsEvent.SaveClicked) }, enabled = !editor.isSaving) {
                Text(stringResource(R.string.action_save))
            }
        }
    }
}
