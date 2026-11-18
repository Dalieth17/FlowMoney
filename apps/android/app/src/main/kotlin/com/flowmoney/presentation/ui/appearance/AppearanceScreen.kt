package com.flowmoney.presentation.ui.appearance

import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.flowmoney.R
import com.flowmoney.domain.model.AppTheme
import com.flowmoney.presentation.theme.FlowMoneyTheme

@get:StringRes
private val AppTheme.label: Int
    get() = when (this) {
        AppTheme.GREEN -> R.string.theme_green
        AppTheme.MONO -> R.string.theme_mono
    }

@get:StringRes
private val AppTheme.description: Int
    get() = when (this) {
        AppTheme.GREEN -> R.string.theme_green_description
        AppTheme.MONO -> R.string.theme_mono_description
    }

/** Colores fijos de cada vista previa: se ven igual sin importar el tema activo. */
private data class PreviewColors(val canvas: Color, val line: Color, val text: Color, val accent: Color)

private val AppTheme.preview: PreviewColors
    get() = when (this) {
        AppTheme.GREEN -> PreviewColors(Color(0xFF08090A), Color(0xFF383B3F), Color.White, Color(0xFF2FDC8A))
        AppTheme.MONO -> PreviewColors(Color.White, Color(0xFFD4D4D8), Color(0xFF0A0A0A), Color(0xFF0A0A0A))
    }

/** Miniatura de la app en cada tema, para elegir viendo el resultado. */
@Composable
private fun ThemeThumbnail(theme: AppTheme, modifier: Modifier = Modifier) {
    val c = theme.preview
    val shape = RoundedCornerShape(10.dp)
    Column(
        modifier
            .size(width = 64.dp, height = 92.dp)
            .background(c.canvas, shape)
            .border(1.dp, c.line, shape)
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Box(Modifier.width(30.dp).height(4.dp).background(c.line, RoundedCornerShape(2.dp)))
        Box(Modifier.width(40.dp).height(9.dp).background(c.text, RoundedCornerShape(2.dp)))
        Box(Modifier.fillMaxWidth().height(4.dp).background(c.line, RoundedCornerShape(2.dp)))
        Box(Modifier.width(34.dp).height(4.dp).background(c.line, RoundedCornerShape(2.dp)))
        Spacer(Modifier.weight(1f))
        Box(Modifier.fillMaxWidth().height(10.dp).background(c.accent, RoundedCornerShape(3.dp)))
    }
}

/** Primer uso (después de la moneda): la persona elige el tema de colores. */
@Composable
fun ThemeChoiceScreen(onChoose: (AppTheme) -> Unit, modifier: Modifier = Modifier) {
    Surface(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .safeDrawingPadding()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Spacer(Modifier.padding(top = 24.dp))
            Text(stringResource(R.string.appearance_title), style = MaterialTheme.typography.headlineMedium)
            Text(
                stringResource(R.string.appearance_subtitle),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            AppTheme.entries.forEach { theme ->
                OutlinedCard(onClick = { onChoose(theme) }, modifier = Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        ThemeThumbnail(theme)
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(stringResource(theme.label), style = MaterialTheme.typography.titleMedium)
                            Text(
                                stringResource(theme.description),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
            Text(
                stringResource(R.string.appearance_change_later),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** Cambiar el tema más adelante: se aplica al instante. */
@Composable
fun ThemeDialog(
    current: AppTheme,
    onChoose: (AppTheme) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.appearance_change)) },
        text = {
            Column(Modifier.selectableGroup(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                AppTheme.entries.forEach { theme ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .selectable(selected = theme == current, role = Role.RadioButton, onClick = { onChoose(theme) })
                            .padding(vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        RadioButton(selected = theme == current, onClick = null)
                        ThemeThumbnail(theme, Modifier.size(width = 40.dp, height = 58.dp))
                        Text(stringResource(theme.label), style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_ok)) } },
    )
}

@Preview(showBackground = true)
@Composable
private fun ThemeChoicePreview() {
    FlowMoneyTheme { ThemeChoiceScreen(onChoose = {}) }
}
