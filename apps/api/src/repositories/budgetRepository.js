// Acceso a datos de presupuestos (uno por categoría/mes/año).
const { pool } = require('../db/pool');

const COLUMNS = 'id, category_id, amount, month, year';

const toBudget = (row) => ({
  id: row.id,
  categoryId: row.category_id,
  amount: Number(row.amount),
  month: row.month,
  year: row.year,
});

async function listByUser(userId, db = pool) {
  const [rows] = await db.query(`SELECT ${COLUMNS} FROM budgets WHERE user_id = ? ORDER BY year, month, id`, [userId]);
  return rows.map(toBudget);
}

async function find(userId, { categoryId, month, year }, db = pool) {
  const [rows] = await db.query(
    `SELECT ${COLUMNS} FROM budgets WHERE user_id = ? AND category_id = ? AND month = ? AND year = ?`,
    [userId, categoryId, month, year],
  );
  return rows[0] ? toBudget(rows[0]) : null;
}

/** Inserta o actualiza el monto (clave única: usuario + categoría + mes + año). */
async function upsert(userId, { categoryId, month, year, amount }, db = pool) {
  await db.query(
    `INSERT INTO budgets (user_id, category_id, amount, month, year) VALUES (?, ?, ?, ?, ?) AS new
     ON DUPLICATE KEY UPDATE amount = new.amount`,
    [userId, categoryId, amount, month, year],
  );
  return find(userId, { categoryId, month, year }, db);
}

async function remove(userId, { categoryId, month, year }, db = pool) {
  await db.query('DELETE FROM budgets WHERE user_id = ? AND category_id = ? AND month = ? AND year = ?', [
    userId,
    categoryId,
    month,
    year,
  ]);
}

async function removeAllByUser(userId, db = pool) {
  await db.query('DELETE FROM budgets WHERE user_id = ?', [userId]);
}

module.exports = { listByUser, find, upsert, remove, removeAllByUser };
