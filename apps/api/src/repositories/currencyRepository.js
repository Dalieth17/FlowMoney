const history = require('./historyRepository');

async function apply(userId, before, after, db) {
  // Se actualizan en su lugar: se conservan IDs y claves de idempotencia.
  for (const a of after.accounts)
    await db.query('UPDATE accounts SET initial_balance = ? WHERE user_id = ? AND id = ?', [
      a.initialBalance,
      userId,
      a.id,
    ]);
  const previous = new Map(before.transactions.map((t) => [t.id, t]));
  for (const t of after.transactions) {
    await db.query('UPDATE transactions SET amount = ?, type = ? WHERE user_id = ? AND id = ?', [
      t.amount,
      t.type,
      userId,
      t.id,
    ]);
    await history.record(
      userId,
      t.id,
      'UPDATE',
      { ...previous.get(t.id), currency: before.currency },
      { ...t, currency: after.currency },
      db,
    );
  }
  for (const b of after.budgets)
    await db.query('UPDATE budgets SET amount = ? WHERE user_id = ? AND id = ?', [b.amount, userId, b.id]);
  for (const [table, items] of [
    ['financial_operations', after.operations],
    ['recurring_schedules', after.schedules],
    ['savings_goals', after.goals],
    ['savings_entries', after.goalEntries],
  ])
    for (const item of items)
      await db.query(`UPDATE ${table} SET data = ? WHERE user_id = ? AND id = ?`, [
        JSON.stringify(item.data),
        userId,
        item.id,
      ]);
}

async function record(userId, from, to, exchange, db) {
  await db.query(
    'INSERT INTO currency_changes (user_id, from_currency, to_currency, cop_per_usd, source, quoted_at) VALUES (?,?,?,?,?,?)',
    [userId, from, to, exchange.copPerUsd, exchange.source, new Date(exchange.quotedAt)],
  );
}

async function latest(userId, db) {
  const [rows] = await db.query(
    `SELECT from_currency AS fromCurrency, to_currency AS toCurrency, cop_per_usd AS copPerUsd,
      source, quoted_at AS quotedAt, created_at AS createdAt
     FROM currency_changes WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

module.exports = { apply, record, latest };
