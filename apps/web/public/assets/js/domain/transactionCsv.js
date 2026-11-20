import { isoDate } from '../core/format.js';
import { toCsv } from './csv.js';

export function transactionsCsv(transactions, { categories, accounts, currency }) {
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
  return toCsv(
    [...transactions].sort((a, b) => a.date - b.date),
    [
      { header: 'Fecha', value: (t) => isoDate(t.date) },
      { header: 'Descripción', value: (t) => t.description },
      { header: 'Tipo', value: (t) => (t.type === 'INCOME' ? 'Ingreso' : 'Gasto') },
      { header: 'Categoría', value: (t) => categoryNames.get(t.categoryId) ?? '' },
      { header: 'Cuenta', value: (t) => accountNames.get(t.accountId) ?? '' },
      { header: `Monto (${currency})`, value: (t) => (t.type === 'INCOME' ? t.amount : -t.amount) },
      { header: 'Nota', value: (t) => t.note },
      { header: 'Clase', value: (t) => t.kind || 'NORMAL' },
      { header: 'Operación', value: (t) => t.operationId || '' },
    ],
  );
}
