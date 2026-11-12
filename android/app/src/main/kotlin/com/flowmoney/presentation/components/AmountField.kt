package com.flowmoney.presentation.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import com.flowmoney.presentation.format.MoneyFormat

private const val AMOUNT_INPUT_MAX = 14

/** Deja solo dígitos y separador decimal; el formato final lo valida el dominio (`Money.parseToCents`). */
internal fun sanitizeAmountInput(text: String): String =
    text.filter { it.isDigit() || it == '.' || it == ',' }.take(AMOUNT_INPUT_MAX)

/**
 * Campo de monto: teclado decimal y prefijo con la moneda del teléfono. El texto se guarda tal
 * cual lo escribe el usuario; [error] tiene prioridad sobre [supportingText].
 */
@Composable
fun AmountField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    error: String? = null,
    supportingText: String? = null,
    imeAction: ImeAction = ImeAction.Next,
    onDone: (() -> Unit)? = null,
) {
    val currencySymbol = MoneyFormat.currencySymbol()
    val helper = error ?: supportingText
    OutlinedTextField(
        value = value,
        onValueChange = { text -> onValueChange(sanitizeAmountInput(text)) },
        label = { Text(label) },
        prefix = if (currencySymbol.isNotEmpty()) { { Text("$currencySymbol ") } } else null,
        singleLine = true,
        isError = error != null,
        supportingText = if (helper != null) { { Text(helper) } } else null,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = imeAction),
        keyboardActions = KeyboardActions(onDone = { onDone?.invoke() }),
        modifier = modifier.fillMaxWidth(),
    )
}
