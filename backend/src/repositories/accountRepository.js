// Acceso a datos de cuentas (Efectivo, Banco, Ahorros).
const { pool } = require('../db/pool');

const COLUMNS = 'id, name, type, initial_balance';

// Cláusulas de bloqueo para lecturas dentro de una transacción:
// 'update' = exclusivo (para comprobar-y-borrar), 'share' = compartido (para referenciar).
const LOCKS = Object.freeze({ update: ' FOR UPDATE', share: ' FOR SHARE' });
const lockClause = (lock) => (lock ? LOCKS[lock] : '');

const toAccount = (row) => ({
  id: row.id,
  name: row.name,
  type: row.type,
  initialBalance: Number(row.initial_balance),
});

async function listByUser(userId, db = pool) {
  const [rows] = await db.query(`SELECT ${COLUMNS} FROM accounts WHERE user_id = ? ORDER BY id`, [userId]);
  return rows.map(toAccount);
}

async function findOwned(id, userId, db = pool, { lock } = {}) {
  const [rows] = await db.query(`SELECT ${COLUMNS} FROM accounts WHERE id = ? AND user_id = ?${lockClause(lock)}`, [
    id,
    userId,
  ]);
  return rows[0] ? toAccount(rows[0]) : null;
}

/** Bloquea (FOR UPDATE) todas las cuentas del usuario, en orden de id para evitar interbloqueos. */
async function lockAllByUser(userId, db) {
  const [rows] = await db.query('SELECT id FROM accounts WHERE user_id = ? ORDER BY id FOR UPDATE', [userId]);
  return rows.map((r) => r.id);
}

async function countByUser(userId, db = pool) {
  const [[row]] = await db.query('SELECT COUNT(*) AS n FROM accounts WHERE user_id = ?', [userId]);
  return Number(row.n);
}

async function create(userId, { name, type, initialBalance }, db = pool) {
  const [result] = await db.query('INSERT INTO accounts (user_id, name, type, initial_balance) VALUES (?, ?, ?, ?)', [
    userId,
    name,
    type,
    initialBalance,
  ]);
  return { id: result.insertId, name, type, initialBalance };
}

async function update(id, userId, { name, type, initialBalance }, db = pool) {
  await db.query('UPDATE accounts SET name = ?, type = ?, initial_balance = ? WHERE id = ? AND user_id = ?', [
    name,
    type,
    initialBalance,
    id,
    userId,
  ]);
  return findOwned(id, userId, db);
}

async function remove(id, userId, db = pool) {
  const [result] = await db.query('DELETE FROM accounts WHERE id = ? AND user_id = ?', [id, userId]);
  return result.affectedRows > 0;
}

async function countTransactions(id, userId, db = pool) {
  const [[row]] = await db.query('SELECT COUNT(*) AS n FROM transactions WHERE account_id = ? AND user_id = ?', [
    id,
    userId,
  ]);
  return Number(row.n);
}

async function removeAllByUser(userId, db = pool) {
  await db.query('DELETE FROM accounts WHERE user_id = ?', [userId]);
}

module.exports = {
  listByUser,
  findOwned,
  countByUser,
  lockAllByUser,
  create,
  update,
  remove,
  countTransactions,
  removeAllByUser,
};
