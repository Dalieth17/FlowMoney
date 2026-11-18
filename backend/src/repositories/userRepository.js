// Acceso a datos de usuarios. Solo SQL y mapeo; sin reglas de negocio.
const { pool } = require('../db/pool');

const COLUMNS = 'id, name, email, currency, created_at';

const toUser = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  currency: row.currency,
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
});

async function findById(id, db = pool) {
  const [rows] = await db.query(`SELECT ${COLUMNS} FROM users WHERE id = ?`, [id]);
  return rows[0] ? toUser(rows[0]) : null;
}

async function existsByEmail(email, db = pool) {
  const [rows] = await db.query('SELECT 1 FROM users WHERE email = ? LIMIT 1', [email]);
  return rows.length > 0;
}

/** Devuelve el usuario junto a su hash (solo para autenticación). */
async function findCredentialsByEmail(email, db = pool) {
  const [rows] = await db.query(`SELECT ${COLUMNS}, password_hash FROM users WHERE email = ?`, [email]);
  return rows[0] ? { user: toUser(rows[0]), passwordHash: rows[0].password_hash } : null;
}

async function findPasswordHash(id, db = pool) {
  const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [id]);
  return rows[0]?.password_hash ?? null;
}

async function create({ name, email, passwordHash, currency = 'COP', termsVersion = null }, db = pool) {
  const [result] = await db.query(
    `INSERT INTO users (name, email, password_hash, currency, terms_version, terms_accepted_at)
     VALUES (?, ?, ?, ?, ?, IF(? IS NULL, NULL, UTC_TIMESTAMP()))`,
    [name, email, passwordHash, currency, termsVersion, termsVersion],
  );
  return result.insertId;
}

/** Versión de los términos que aceptó y cuándo (prueba de la autorización). */
async function findConsent(id, db = pool) {
  const [rows] = await db.query('SELECT terms_version, terms_accepted_at FROM users WHERE id = ?', [id]);
  return rows[0] ? { version: rows[0].terms_version, acceptedAt: rows[0].terms_accepted_at } : null;
}

/**
 * Borra al usuario y todos sus datos. Primero movimientos y presupuestos: los movimientos
 * bloquean el borrado de categorías (ON DELETE RESTRICT); el resto cae en cascada
 * (categorías, cuentas y sesiones).
 */
async function removeWithData(id, db = pool) {
  await db.query('DELETE FROM recurring_schedules WHERE user_id = ?', [id]);
  await db.query('DELETE FROM transactions WHERE user_id = ?', [id]);
  await db.query('DELETE FROM budgets WHERE user_id = ?', [id]);
  await db.query('DELETE FROM users WHERE id = ?', [id]);
}

async function updateProfile(id, { name, currency }, db = pool) {
  await db.query('UPDATE users SET name = ?, currency = ? WHERE id = ?', [name, currency, id]);
}

async function updatePassword(id, passwordHash, db = pool) {
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
}

module.exports = {
  findById,
  existsByEmail,
  findCredentialsByEmail,
  findPasswordHash,
  create,
  updateProfile,
  updatePassword,
  findConsent,
  removeWithData,
};
