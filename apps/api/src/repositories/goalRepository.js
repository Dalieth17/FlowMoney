const { pool } = require('../db/pool');
async function list(userId, db = pool) {
  const [goals] = await db.query('SELECT id,data FROM savings_goals WHERE user_id = ? ORDER BY id', [userId]);
  const [entries] = await db.query(
    'SELECT id,goal_id AS goalId,data FROM savings_entries WHERE user_id = ? ORDER BY id',
    [userId],
  );
  return { goals, goalEntries: entries };
}
async function save(userId, id, data, db) {
  await db.query(
    'INSERT INTO savings_goals (user_id,id,data) VALUES (?,?,?) ON DUPLICATE KEY UPDATE data = VALUES(data)',
    [userId, id, JSON.stringify(data)],
  );
}
async function add(userId, id, goalId, data, db) {
  await db.query('INSERT INTO savings_entries (user_id,id,goal_id,data) VALUES (?,?,?,?)', [
    userId,
    id,
    goalId,
    JSON.stringify(data),
  ]);
}
async function removeEntry(userId, id, db) {
  await db.query('DELETE FROM savings_entries WHERE user_id = ? AND id = ?', [userId, id]);
}
async function clear(userId, db) {
  await db.query('DELETE FROM savings_goals WHERE user_id = ?', [userId]);
}
module.exports = { list, save, add, removeEntry, clear };
