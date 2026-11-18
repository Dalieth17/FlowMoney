// Acceso a datos de categorías (siempre acotado por user_id).
const { pool } = require('../db/pool');

const COLUMNS = 'id, name, icon, color, is_default';

// Cláusulas de bloqueo para lecturas dentro de una transacción:
// 'update' = exclusivo (para comprobar-y-borrar), 'share' = compartido (para referenciar).
const LOCKS = Object.freeze({ update: ' FOR UPDATE', share: ' FOR SHARE' });
const lockClause = (lock) => (lock ? LOCKS[lock] : '');

const toCategory = (row) => ({
  id: row.id,
  name: row.name,
  icon: row.icon,
  color: row.color,
  isDefault: Boolean(row.is_default),
});

async function listByUser(userId, db = pool) {
  const [rows] = await db.query(`SELECT ${COLUMNS} FROM categories WHERE user_id = ? ORDER BY id`, [userId]);
  return rows.map(toCategory);
}

async function findOwned(id, userId, db = pool, { lock } = {}) {
  const [rows] = await db.query(`SELECT ${COLUMNS} FROM categories WHERE id = ? AND user_id = ?${lockClause(lock)}`, [
    id,
    userId,
  ]);
  return rows[0] ? toCategory(rows[0]) : null;
}

async function create(userId, { name, icon, color, isDefault = false }, db = pool) {
  const [result] = await db.query(
    'INSERT INTO categories (user_id, name, icon, color, is_default) VALUES (?, ?, ?, ?, ?)',
    [userId, name, icon, color, isDefault ? 1 : 0],
  );
  return { id: result.insertId, name, icon, color, isDefault };
}

async function update(id, userId, { name, icon, color }, db = pool) {
  await db.query('UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ? AND user_id = ?', [
    name,
    icon,
    color,
    id,
    userId,
  ]);
  return findOwned(id, userId, db);
}

async function remove(id, userId, db = pool) {
  const [result] = await db.query('DELETE FROM categories WHERE id = ? AND user_id = ?', [id, userId]);
  return result.affectedRows > 0;
}

async function countTransactions(id, userId, db = pool) {
  const [[row]] = await db.query('SELECT COUNT(*) AS n FROM transactions WHERE category_id = ? AND user_id = ?', [
    id,
    userId,
  ]);
  return Number(row.n);
}

async function removeAllByUser(userId, db = pool) {
  await db.query('DELETE FROM categories WHERE user_id = ?', [userId]);
}

module.exports = { listByUser, findOwned, create, update, remove, countTransactions, removeAllByUser };
