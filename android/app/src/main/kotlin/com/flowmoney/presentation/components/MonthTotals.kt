package com.flowmoney.presentation.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.flowmoney.R
import com.flowmoney.domain.model.MonthSummary
import com.flowmoney.presentation.format.MoneyFormat

/** Ingresos · Gastos · Balance en tres columnas: el resumen de un mes (Movimientos y Reportes). */
@Composable
fun MonthTotals(summary: MonthSummary, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        TotalValue(
            label = stringResource(R.string.summary_income),
            value = MoneyFormat.format(summary.incomeCents),
            color = colors.primary,
            modifier = Modifier.weight(1f),
        )
        TotalValue(
            label = stringResource(R.string.summary_expense),
            value = MoneyFormat.format(summary.expenseCents),
            color = colors.error,
            modifier = Modifier.weight(1f),
        )
        TotalValue(
            label = stringResource(R.string.summary_balance),
            value = MoneyFormat.format(summary.balanceCents),
            color = if (summary.balanceCents < 0) colors.error else colors.onSurface,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun TotalValue(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Column(modifier) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            color = color,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
