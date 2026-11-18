// Acceso a datos de movimientos (ingresos y gastos).
const { pool } = require('../db/pool');

const COLUMNS = 'id, amount, description, date, type, category_id, account_id, note, kind, operation_id';

const toTransaction = (row) => ({
  id: row.id,
  amount: Number(row.amount),
  description: row.description,
  date: Number(row.date),
  type: row.type,
  categoryId: row.category_id,
  accountId: row.account_id,
  note: row.note || '',
  kind: row.kind,
  operationId: row.operation_id,
});

async function listByUser(userId, db = pool) {
  const [rows] = await db.query(`SELECT ${COLUMNS} FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC`, [
    userId,
  ]);
  return rows.map(toTransaction);
}

async function findOwned(id, userId, db = pool, { lock = false } = {}) {
  const [rows] = await db.query(
    `SELECT ${COLUMNS} FROM transactions WHERE id = ? AND user_id = ?${lock ? ' FOR UPDATE' : ''}`,
    [id, userId],
  );
  return rows[0] ? toTransaction(rows[0]) : null;
}

async function create(userId, tx, db = pool) {
  const [result] = await db.query(
    `INSERT INTO transactions (user_id, amount, description, date, type, category_id, account_id, note, kind, operation_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      tx.amount,
      tx.description,
      tx.date,
      tx.type,
      tx.categoryId,
      tx.accountId ?? null,
      tx.note ?? '',
      tx.kind || 'NORMAL',
      tx.operationId || null,
    ],
  );
  return {
    ...tx,
    id: result.insertId,
    accountId: tx.accountId ?? null,
    note: tx.note ?? '',
    kind: tx.kind || 'NORMAL',
    operationId: tx.operationId || null,
  };
}

async function update(id, userId, tx, db = pool) {
  await db.query(
    `UPDATE transactions
        SET amount = ?, description = ?, date = ?, type = ?, category_id = ?, account_id = ?, note = ?
      WHERE id = ? AND user_id = ?`,
    [tx.amount, tx.description, tx.date, tx.type, tx.categoryId, tx.accountId ?? null, tx.note ?? '', id, userId],
  );
  return findOwned(id, userId, db);
}

async function remove(id, userId, db = pool) {
  const [result] = await db.query('DELETE FROM transactions WHERE id = ? AND user_id = ?', [id, userId]);
  return result.affectedRows > 0;
}

async function removeAllByUser(userId, db = pool) {
  await db.query('DELETE FROM transactions WHERE user_id = ?', [userId]);
}

async function listPage(userId, { limit, beforeId, from, to }, db = pool) {
  const where = ['user_id = ?'];
  const args = [userId];
  for (const [clause, value] of [
    ['id < ?', beforeId],
    ['date >= ?', from],
    ['date <= ?', to],
  ]) {
    if (value != null) {
      where.push(clause);
      args.push(value);
    }
  }
  const [rows] = await db.query(
    `SELECT ${COLUMNS} FROM transactions WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ?`,
    [...args, limit + 1],
  );
  const items = rows.slice(0, limit).map(toTransaction);
  return { items, nextCursor: rows.length > limit ? items.at(-1).id : null };
}

module.exports = { listByUser, listPage, findOwned, create, update, remove, removeAllByUser };
