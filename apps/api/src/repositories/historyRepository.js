const { pool } = require('../db/pool');

async function record(userId, transactionId, action, before, after, db) {
  await db.query(
    'INSERT INTO transaction_history (user_id, transaction_id, action, before_data, after_data) VALUES (?, ?, ?, ?, ?)',
    [
      userId,
      transactionId,
      action,
      before == null ? null : JSON.stringify(before),
      after == null ? null : JSON.stringify(after),
    ],
  );
}

async function list(userId, transactionId, db = pool) {
  const [rows] = await db.query(
    `SELECT id, action, before_data AS beforeData, after_data AS afterData, created_at AS createdAt
     FROM transaction_history WHERE user_id = ? AND transaction_id = ? ORDER BY id DESC LIMIT 100`,
    [userId, transactionId],
  );
  return rows;
}

module.exports = { record, list };
