package com.flowmoney.presentation.ui.currency

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.flowmoney.R
import com.flowmoney.domain.model.AppCurrency
import com.flowmoney.presentation.format.MoneyFormatter
import com.flowmoney.presentation.theme.FlowMoneyTheme

/** Ejemplo que se muestra en cada opción para que se note la diferencia de formato. */
private const val SAMPLE_CENTS = 123_456_700L

@get:StringRes
private val AppCurrency.label: Int
    get() = when (this) {
        AppCurrency.COP -> R.string.currency_cop
        AppCurrency.USD -> R.string.currency_usd
    }

/** Primer uso: la persona elige si maneja pesos colombianos o dólares. */
@Composable
fun CurrencyChoiceScreen(onChoose: (AppCurrency) -> Unit, modifier: Modifier = Modifier) {
    Surface(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .safeDrawingPadding()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Spacer(Modifier.padding(top = 24.dp))
            Text(stringResource(R.string.currency_choice_title), style = MaterialTheme.typography.headlineMedium)
            Text(
                stringResource(R.string.currency_choice_subtitle),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            AppCurrency.entries.forEach { currency ->
                OutlinedCard(onClick = { onChoose(currency) }, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(stringResource(currency.label), style = MaterialTheme.typography.titleMedium)
                        Text(
                            stringResource(R.string.currency_example, MoneyFormatter.of(currency).format(SAMPLE_CENTS)),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            Text(
                stringResource(R.string.currency_change_later),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** Cambiar la moneda más adelante. No convierte montos: solo cambia cómo se muestran. */
@Composable
fun CurrencyDialog(
    current: AppCurrency,
    onChoose: (AppCurrency) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.currency_change)) },
        text = {
            Column(Modifier.selectableGroup(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                AppCurrency.entries.forEach { currency ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .selectable(selected = currency == current, role = Role.RadioButton, onClick = { onChoose(currency) })
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(selected = currency == current, onClick = null)
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(stringResource(currency.label), style = MaterialTheme.typography.bodyLarge)
                            Text(
                                MoneyFormatter.of(currency).format(SAMPLE_CENTS),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
                Text(
                    stringResource(R.string.currency_no_conversion),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_ok)) } },
    )
}

@Preview(showBackground = true)
@Composable
private fun CurrencyChoicePreview() {
    FlowMoneyTheme { CurrencyChoiceScreen(onChoose = {}) }
}
