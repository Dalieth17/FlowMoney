const { createHash } = require('node:crypto');
const { withUserTransaction } = require('../db/pool');
const users = require('../repositories/userRepository');
const accounts = require('../repositories/accountRepository');
const categories = require('../repositories/categoryRepository');
const transactions = require('../repositories/transactionRepository');
const history = require('../repositories/historyRepository');
const { readCsv, decodeRows, fingerprint } = require('../utils/transactionCsv');
const HttpError = require('../utils/httpError');

async function plan(userId, input, db) {
  const user = await users.findById(userId, db);
  if (input.currency !== user.currency) throw HttpError.conflict('La moneda cambió. Abre de nuevo el importador');
  const parsed = readCsv(input.csv);
  if (parsed.currency !== user.currency)
    throw HttpError.badRequest(
      'La moneda del CSV no coincide con la de tu cuenta. No se convierten importes al importar',
    );
  const rows = decodeRows(parsed.rows, await categories.listByUser(userId, db), await accounts.listByUser(userId, db));
  const valid = rows.filter((row) => row.transaction);
  const counts = new Map();
  if (valid.length) {
    const dates = valid.map((r) => r.transaction.date);
    const existing = await transactions.listForImport(
      userId,
      Math.min(...dates) - 43200000,
      Math.max(...dates) + 43200000,
      db,
    );
    for (const tx of existing) {
      const key = fingerprint(tx);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    for (const row of valid) {
      const key = fingerprint(row.transaction),
        count = counts.get(key) || 0;
      if (count) {
        row.status = 'EXISTING';
        counts.set(key, count - 1);
      }
    }
  }
  const summary = { new: 0, existing: 0, excluded: 0, errors: 0 };
  for (const row of rows)
    summary[{ NEW: 'new', EXISTING: 'existing', EXCLUDED: 'excluded', ERROR: 'errors' }[row.status]]++;
  const digest = createHash('sha256')
    .update(JSON.stringify({ source: input.csv, currency: user.currency, rows }))
    .digest('hex');
  return { currency: user.currency, digest, summary, rows, valid: summary.errors === 0 };
}
const preview = (userId, input) => withUserTransaction(userId, (db) => plan(userId, input, db));
const commit = (userId, input) =>
  withUserTransaction(userId, async (db) => {
    const result = await plan(userId, input, db);
    if (!result.valid) throw HttpError.badRequest('Corrige todas las filas con errores antes de importar');
    if (result.digest !== input.digest)
      throw HttpError.conflict(
        'Los datos cambiaron desde la vista previa. Revisa de nuevo el archivo antes de importar',
      );
    for (const row of result.rows.filter((r) => r.status === 'NEW')) {
      const tx = await transactions.create(userId, row.transaction, db);
      await history.record(userId, tx.id, 'CREATE', null, tx, db);
    }
    return { imported: result.summary.new, skipped: result.summary.existing, excluded: result.summary.excluded };
  });
module.exports = { preview, commit };
