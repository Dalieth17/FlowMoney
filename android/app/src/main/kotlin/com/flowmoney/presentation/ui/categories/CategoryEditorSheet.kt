package com.flowmoney.presentation.ui.categories

import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.flowmoney.R
import com.flowmoney.domain.model.CategoryRules
import com.flowmoney.presentation.components.CategoryAvatar
import com.flowmoney.presentation.components.CategoryIconOption
import com.flowmoney.presentation.components.CategoryIcons
import com.flowmoney.presentation.components.CategoryPalette
import com.flowmoney.presentation.components.PaletteColor
import com.flowmoney.util.readableContentColor
import com.flowmoney.util.toColorOrNull

/** Hoja inferior para crear o editar una categoría: nombre, ícono y color con vista previa. */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun CategoryEditorSheet(state: CategoryEditorState, onEvent: (CategoriesEvent) -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val nameError = state.error?.takeIf { it.belongsToNameField }
    val otherError = state.error?.takeUnless { it.belongsToNameField }

    ModalBottomSheet(onDismissRequest = { onEvent(CategoriesEvent.EditorDismissed) }, sheetState = sheetState) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                CategoryAvatar(iconKey = state.icon, colorHex = state.color, size = 52.dp)
                Text(
                    text = stringResource(if (state.isNew) R.string.category_editor_new else R.string.category_editor_edit),
                    style = MaterialTheme.typography.headlineSmall,
                )
            }

            OutlinedTextField(
                value = state.name,
                onValueChange = { onEvent(CategoriesEvent.NameChanged(it)) },
                label = { Text(stringResource(R.string.category_field_name)) },
                singleLine = true,
                isError = nameError != null,
                supportingText = {
                    if (nameError != null) {
                        Text(nameError.text())
                    } else {
                        Text(
                            stringResource(
                                R.string.category_name_counter,
                                CategoryRules.normalizeName(state.name).length,
                                CategoryRules.NAME_MAX_LENGTH,
                            ),
                        )
                    }
                },
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.Sentences,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(onDone = { onEvent(CategoriesEvent.SaveClicked) }),
                modifier = Modifier.fillMaxWidth(),
            )

            PickerLabel(R.string.category_field_icon)
            FlowRow(
                modifier = Modifier.selectableGroup(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                CategoryIcons.options.forEach { option ->
                    IconChoice(option, selected = option.key == state.icon) {
                        onEvent(CategoriesEvent.IconSelected(option.key))
                    }
                }
            }

            PickerLabel(R.string.category_field_color)
            FlowRow(
                modifier = Modifier.selectableGroup(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                CategoryPalette.colors.forEach { color ->
                    ColorChoice(color, selected = color.hex.equals(state.color, ignoreCase = true)) {
                        onEvent(CategoriesEvent.ColorSelected(color.hex))
                    }
                }
            }

            otherError?.let {
                Text(it.text(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = { onEvent(CategoriesEvent.EditorDismissed) }) {
                    Text(stringResource(R.string.action_cancel))
                }
                Spacer(Modifier.width(8.dp))
                Button(onClick = { onEvent(CategoriesEvent.SaveClicked) }, enabled = !state.isSaving) {
                    Text(stringResource(R.string.action_save))
                }
            }
        }
    }
}

@Composable
private fun PickerLabel(@StringRes text: Int) {
    Text(
        text = stringResource(text),
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
private fun IconChoice(option: CategoryIconOption, selected: Boolean, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val shape = CircleShape
    Box(
        modifier = Modifier
            .size(48.dp)
            .clip(shape)
            .background(if (selected) colors.primaryContainer else colors.surfaceContainerHigh)
            .then(if (selected) Modifier.border(2.dp, colors.primary, shape) else Modifier)
            .selectable(selected = selected, role = Role.RadioButton, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = option.vector,
            contentDescription = stringResource(option.label),
            tint = if (selected) colors.onPrimaryContainer else colors.onSurfaceVariant,
        )
    }
}

@Composable
private fun ColorChoice(color: PaletteColor, selected: Boolean, onClick: () -> Unit) {
    val fill = color.hex.toColorOrNull() ?: MaterialTheme.colorScheme.secondary
    val label = stringResource(color.label)
    val shape = CircleShape
    Box(
        modifier = Modifier
            .size(40.dp)
            .then(if (selected) Modifier.border(3.dp, MaterialTheme.colorScheme.onSurface, shape) else Modifier)
            .padding(if (selected) 5.dp else 0.dp)
            .clip(shape)
            .background(fill)
            .selectable(selected = selected, role = Role.RadioButton, onClick = onClick)
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        if (selected) {
            Icon(Icons.Rounded.Check, contentDescription = null, tint = fill.readableContentColor(), modifier = Modifier.size(18.dp))
        }
    }
}
