const { pool } = require('../db/pool');

async function coolingDown(userId, db) {
  const [rows] = await db.query(
    'SELECT 1 FROM password_resets WHERE user_id = ? AND created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE)',
    [userId],
  );
  return rows.length > 0;
}
async function save(userId, tokenHash, db) {
  await db.query(
    `INSERT INTO password_resets (user_id,token_hash,created_at,expires_at)
    VALUES (?,?,UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE))
    ON DUPLICATE KEY UPDATE token_hash=VALUES(token_hash), created_at=VALUES(created_at), expires_at=VALUES(expires_at)`,
    [userId, tokenHash],
  );
}
async function findActive(tokenHash, db = pool) {
  const [rows] = await db.query(
    'SELECT user_id AS userId FROM password_resets WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP()',
    [tokenHash],
  );
  return rows[0] ?? null;
}
async function removeByUser(userId, db) {
  await db.query('DELETE FROM password_resets WHERE user_id = ?', [userId]);
}
async function removeToken(userId, tokenHash, db = pool) {
  await db.query('DELETE FROM password_resets WHERE user_id = ? AND token_hash = ?', [userId, tokenHash]);
}
async function removeExpired() {
  await pool.query('DELETE FROM password_resets WHERE expires_at <= UTC_TIMESTAMP() LIMIT 1000');
}
module.exports = { coolingDown, save, findActive, removeByUser, removeToken, removeExpired };
