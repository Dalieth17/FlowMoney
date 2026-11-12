package com.flowmoney.presentation.ui.movements

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.flowmoney.R
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.TransactionRules
import com.flowmoney.domain.model.TransactionType
import com.flowmoney.presentation.components.AmountField
import com.flowmoney.presentation.components.CategoryAvatar
import com.flowmoney.presentation.format.DateFormat
import java.time.LocalDate

private const val MILLIS_PER_DAY = 86_400_000L

/** Hoja inferior para crear o editar un movimiento. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MovementEditorSheet(editor: MovementEditorState, categories: List<Category>, onEvent: (MovementsEvent) -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = { onEvent(MovementsEvent.EditorDismissed) }, sheetState = sheetState) {
        MovementEditorForm(editor = editor, categories = categories, onEvent = onEvent)
    }
}

/** Contenido del formulario, sin la hoja modal: se puede previsualizar y probar por separado. */
@Composable
fun MovementEditorForm(
    editor: MovementEditorState,
    categories: List<Category>,
    onEvent: (MovementsEvent) -> Unit,
    modifier: Modifier = Modifier,
) {
    val error = editor.error
    val errorField = error?.field

    Column(
        modifier = modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp)
            .padding(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = stringResource(if (editor.isNew) R.string.movement_editor_new else R.string.movement_editor_edit),
            style = MaterialTheme.typography.headlineSmall,
        )

        TypeSelector(editor.type) { onEvent(MovementsEvent.TypeChanged(it)) }

        val errorText = error?.text()
        val amountError = errorText.takeIf { errorField == MovementField.AMOUNT }
        AmountField(
            value = editor.amountText,
            onValueChange = { onEvent(MovementsEvent.AmountChanged(it)) },
            label = stringResource(R.string.movement_field_amount),
            error = amountError,
        )

        val descriptionError = errorText.takeIf { errorField == MovementField.DESCRIPTION }
        OutlinedTextField(
            value = editor.description,
            onValueChange = { onEvent(MovementsEvent.DescriptionChanged(it)) },
            label = { Text(stringResource(R.string.movement_field_description)) },
            singleLine = true,
            isError = descriptionError != null,
            supportingText = {
                Text(
                    descriptionError ?: stringResource(
                        R.string.category_name_counter,
                        TransactionRules.normalizeText(editor.description).length,
                        TransactionRules.DESCRIPTION_MAX_LENGTH,
                    ),
                )
            },
            keyboardOptions = KeyboardOptions(
                capitalization = KeyboardCapitalization.Sentences,
                imeAction = ImeAction.Next,
            ),
            modifier = Modifier.fillMaxWidth(),
        )

        CategoryPicker(
            categories = categories,
            selectedId = editor.categoryId,
            error = errorText.takeIf { errorField == MovementField.CATEGORY },
            onSelect = { onEvent(MovementsEvent.CategorySelected(it)) },
        )

        DateField(editor.date) { onEvent(MovementsEvent.DateSelected(it)) }

        val noteError = errorText.takeIf { errorField == MovementField.NOTE }
        OutlinedTextField(
            value = editor.note,
            onValueChange = { onEvent(MovementsEvent.NoteChanged(it)) },
            label = { Text(stringResource(R.string.movement_field_note)) },
            isError = noteError != null,
            supportingText = noteError?.let { { Text(it) } },
            minLines = 2,
            maxLines = 4,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
            modifier = Modifier.fillMaxWidth(),
        )

        if (errorField == MovementField.NONE && errorText != null) {
            Text(errorText, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
        }

        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            if (!editor.isNew) {
                TextButton(
                    onClick = { onEvent(MovementsEvent.DeleteClicked) },
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
                ) { Text(stringResource(R.string.action_delete)) }
            }
            Spacer(Modifier.weight(1f))
            TextButton(onClick = { onEvent(MovementsEvent.EditorDismissed) }) {
                Text(stringResource(R.string.action_cancel))
            }
            Spacer(Modifier.width(8.dp))
            Button(onClick = { onEvent(MovementsEvent.SaveClicked) }, enabled = !editor.isSaving) {
                Text(stringResource(R.string.action_save))
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TypeSelector(selected: TransactionType, onSelect: (TransactionType) -> Unit) {
    val label = stringResource(R.string.movement_type_label)
    val options = listOf(
        TransactionType.EXPENSE to R.string.movement_type_expense,
        TransactionType.INCOME to R.string.movement_type_income,
    )
    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().semantics { contentDescription = label }) {
        options.forEachIndexed { index, (type, text) ->
            SegmentedButton(
                selected = type == selected,
                onClick = { onSelect(type) },
                shape = SegmentedButtonDefaults.itemShape(index = index, count = options.size),
            ) { Text(stringResource(text)) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CategoryPicker(categories: List<Category>, selectedId: Long?, error: String?, onSelect: (Long) -> Unit) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    val selected = categories.firstOrNull { it.id == selectedId }

    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = selected?.name.orEmpty(),
            onValueChange = {},
            readOnly = true,
            label = { Text(stringResource(R.string.movement_field_category)) },
            placeholder = { Text(stringResource(R.string.movement_pick_category)) },
            leadingIcon = selected?.let { { CategoryAvatar(it.icon, it.color, size = 28.dp) } },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            isError = error != null,
            supportingText = error?.let { { Text(it) } },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryNotEditable),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            categories.forEach { category ->
                DropdownMenuItem(
                    text = { Text(category.name) },
                    leadingIcon = { CategoryAvatar(category.icon, category.color, size = 28.dp) },
                    onClick = {
                        expanded = false
                        onSelect(category.id)
                    },
                    contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding,
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DateField(date: LocalDate, onSelect: (LocalDate) -> Unit) {
    var open by rememberSaveable { mutableStateOf(false) }
    val pickLabel = stringResource(R.string.movement_pick_date)

    Box {
        OutlinedTextField(
            value = DateFormat.short(date),
            onValueChange = {},
            readOnly = true,
            label = { Text(stringResource(R.string.movement_field_date)) },
            trailingIcon = { Icon(Icons.Rounded.CalendarMonth, contentDescription = null) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        // Capa táctil encima del campo de solo lectura: abre el calendario.
        Box(
            Modifier
                .matchParentSize()
                .clickable(onClickLabel = pickLabel) { open = true },
        )
    }

    if (open) {
        // DatePicker trabaja con medianoche UTC; convertir así evita saltos de día por zona horaria.
        val pickerState = rememberDatePickerState(initialSelectedDateMillis = date.toEpochDay() * MILLIS_PER_DAY)
        DatePickerDialog(
            onDismissRequest = { open = false },
            confirmButton = {
                TextButton(onClick = {
                    pickerState.selectedDateMillis?.let { onSelect(LocalDate.ofEpochDay(Math.floorDiv(it, MILLIS_PER_DAY))) }
                    open = false
                }) { Text(stringResource(R.string.action_ok)) }
            },
            dismissButton = {
                TextButton(onClick = { open = false }) { Text(stringResource(R.string.action_cancel)) }
            },
        ) { DatePicker(state = pickerState) }
    }
}
