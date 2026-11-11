// Exporta movimientos a CSV (abre bien en Excel/Sheets, con tildes).
import { downloadText } from './dom.js';
import { toast } from './feedback.js';
import { store } from '../core/store.js';
import { isoDate, getCurrency } from '../core/format.js';
import { toCsv } from '../domain/csv.js';

export function exportTransactionsCsv(transactions, filename) {
  const columns = [
    { header: 'Fecha', value: (t) => isoDate(t.date) },
    { header: 'Descripción', value: (t) => t.description },
    { header: 'Tipo', value: (t) => (t.type === 'INCOME' ? 'Ingreso' : 'Gasto') },
    { header: 'Categoría', value: (t) => store.category(t.categoryId)?.name ?? '' },
    { header: 'Cuenta', value: (t) => store.account(t.accountId)?.name ?? '' },
    { header: `Monto (${getCurrency()})`, value: (t) => (t.type === 'INCOME' ? t.amount : -t.amount) },
    { header: 'Nota', value: (t) => t.note },
  ];
  const sorted = [...transactions].sort((a, b) => a.date - b.date);
  downloadText(filename, toCsv(sorted, columns));
  toast(`Exportados ${transactions.length} movimientos`);
}
