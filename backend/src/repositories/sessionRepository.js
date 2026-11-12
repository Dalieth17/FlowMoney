// Sesiones activas. Las fechas se calculan en MySQL (UTC_TIMESTAMP) para no
// depender de la zona horaria del servidor de la API.
const { pool } = require('../db/pool');

async function create({ tokenHash, userId, ttlSeconds }, db = pool) {
  await db.query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND))',
    [tokenHash, userId, ttlSeconds],
  );
}

/** Id del usuario si la sesión existe y no venció; null si no. */
async function findActiveUserId(tokenHash, db = pool) {
  const [rows] = await db.query('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP()', [
    tokenHash,
  ]);
  return rows[0]?.user_id ?? null;
}

async function remove(tokenHash, db = pool) {
  await db.query('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
}

async function removeAllByUser(userId, db = pool) {
  await db.query('DELETE FROM sessions WHERE user_id = ?', [userId]);
}

async function removeExpiredByUser(userId, db = pool) {
  await db.query('DELETE FROM sessions WHERE user_id = ? AND expires_at <= UTC_TIMESTAMP()', [userId]);
}

module.exports = { create, findActiveUserId, remove, removeAllByUser, removeExpiredByUser };
