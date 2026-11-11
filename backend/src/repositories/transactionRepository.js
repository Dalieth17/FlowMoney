// Acceso a datos de movimientos (ingresos y gastos).
const { pool } = require('../db/pool');

const COLUMNS = 'id, amount, description, date, type, category_id, account_id, note';

const toTransaction = (row) => ({
  id: row.id,
  amount: Number(row.amount),
  description: row.description,
  date: Number(row.date),
  type: row.type,
  categoryId: row.category_id,
  accountId: row.account_id,
  note: row.note || '',
});

async function listByUser(userId, db = pool) {
  const [rows] = await db.query(`SELECT ${COLUMNS} FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC`, [
    userId,
  ]);
  return rows.map(toTransaction);
}

async function findOwned(id, userId, db = pool) {
  const [rows] = await db.query(`SELECT ${COLUMNS} FROM transactions WHERE id = ? AND user_id = ?`, [id, userId]);
  return rows[0] ? toTransaction(rows[0]) : null;
}

async function create(userId, tx, db = pool) {
  const [result] = await db.query(
    `INSERT INTO transactions (user_id, amount, description, date, type, category_id, account_id, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, tx.amount, tx.description, tx.date, tx.type, tx.categoryId, tx.accountId ?? null, tx.note ?? ''],
  );
  return { id: result.insertId, ...tx, accountId: tx.accountId ?? null, note: tx.note ?? '' };
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

module.exports = { listByUser, findOwned, create, update, remove, removeAllByUser };
