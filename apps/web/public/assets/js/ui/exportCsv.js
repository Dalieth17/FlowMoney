// Exporta movimientos a CSV (abre bien en Excel/Sheets, con tildes).
import { downloadText } from './dom.js';
import { toast } from './feedback.js';
import { store } from '../core/store.js';
import { getCurrency } from '../core/format.js';
import { transactionsCsv } from '../domain/transactionCsv.js';

export function exportTransactionsCsv(transactions, filename) {
  downloadText(
    filename,
    transactionsCsv(transactions, { categories: store.categories, accounts: store.accounts, currency: getCurrency() }),
  );
  toast(`Exportados ${transactions.length} movimientos`);
}
