const { pool } = require('../db/pool');
async function operations(userId, db = pool) {
  const [rows] = await db.query('SELECT id, kind, data FROM financial_operations WHERE user_id = ?', [userId]);
  return rows;
}
async function schedules(userId, db = pool) {
  const [rows] = await db.query('SELECT id, data FROM recurring_schedules WHERE user_id = ? ORDER BY id', [userId]);
  return rows;
}
async function occurrences(userId, db = pool) {
  const [rows] = await db.query(
    `SELECT o.schedule_id AS scheduleId, o.period, o.transaction_id AS transactionId
    FROM recurring_occurrences o JOIN recurring_schedules s ON s.id = o.schedule_id WHERE s.user_id = ?`,
    [userId],
  );
  return rows;
}
async function saveOperation(userId, id, kind, data, db) {
  await db.query(
    `INSERT INTO financial_operations (user_id,id,kind,data) VALUES (?,?,?,?)
    ON DUPLICATE KEY UPDATE data = VALUES(data)`,
    [userId, id, kind, JSON.stringify(data)],
  );
}
async function removeOperation(userId, id, db) {
  await db.query('DELETE FROM financial_operations WHERE user_id = ? AND id = ?', [userId, id]);
}
async function operationTransactions(userId, id, db) {
  const [rows] = await db.query('SELECT id FROM transactions WHERE user_id = ? AND operation_id = ?', [userId, id]);
  return rows;
}
async function createSchedule(userId, data, db) {
  const [r] = await db.query('INSERT INTO recurring_schedules (user_id,data) VALUES (?,?)', [
    userId,
    JSON.stringify(data),
  ]);
  return r.insertId;
}
async function updateSchedule(userId, id, data, db) {
  await db.query('UPDATE recurring_schedules SET data = ? WHERE id = ? AND user_id = ?', [
    JSON.stringify(data),
    id,
    userId,
  ]);
}
async function addOccurrence(scheduleId, period, transactionId, db) {
  await db.query('INSERT INTO recurring_occurrences (schedule_id,period,transaction_id) VALUES (?,?,?)', [
    scheduleId,
    period,
    transactionId,
  ]);
}
async function clearSchedules(userId, db) {
  await db.query('DELETE FROM recurring_schedules WHERE user_id = ?', [userId]);
}
async function clearOperations(userId, db) {
  await db.query('DELETE FROM financial_operations WHERE user_id = ?', [userId]);
}
module.exports = {
  operations,
  schedules,
  occurrences,
  saveOperation,
  removeOperation,
  operationTransactions,
  createSchedule,
  updateSchedule,
  addOccurrence,
  clearSchedules,
  clearOperations,
};
