// MySQL suma DECIMAL antes de devolver números. Solo salen agregados del período solicitado.
function scope(accountId, params) {
  if (accountId === 'none') return ' AND t.account_id IS NULL';
  if (accountId !== undefined) {
    params.push(accountId);
    return ' AND t.account_id=?';
  }
  return '';
}
async function daily(userId, from, to, accountId, db) {
  const params = [userId, from, to];
  const account = scope(accountId, params);
  const [rows] = await db.query(
    `SELECT
    DATE_FORMAT(TIMESTAMPADD(SECOND,FLOOR(t.date/1000)-18000,'1970-01-01 00:00:00'),'%Y-%m-%d') AS day,
    t.type,SUM(t.amount) AS amount,COUNT(*) AS count
    FROM transactions t WHERE t.user_id=? AND t.date>=? AND t.date<? AND t.kind='NORMAL'${account}
    GROUP BY day,t.type ORDER BY day,t.type`,
    params,
  );
  return rows;
}
async function categories(userId, from, to, accountId, db) {
  const params = [userId, from, to];
  const account = scope(accountId, params);
  const [rows] = await db.query(
    `SELECT c.id,c.name,c.icon,c.color,SUM(t.amount) AS amount
    FROM transactions t JOIN categories c ON c.id=t.category_id AND c.user_id=t.user_id
    WHERE t.user_id=? AND t.date>=? AND t.date<? AND t.kind='NORMAL' AND t.type='EXPENSE'${account}
    GROUP BY c.id,c.name,c.icon,c.color ORDER BY amount DESC,c.id`,
    params,
  );
  return rows.map(({ amount, ...category }) => ({ category, value: Number(amount) }));
}
async function accounts(userId, from, to, accountId, db) {
  const params = [userId, from, to];
  const account = scope(accountId, params);
  const [rows] = await db.query(
    `SELECT t.account_id AS accountId,
    SUM(CASE WHEN t.type='INCOME' THEN t.amount ELSE 0 END) AS income,
    SUM(CASE WHEN t.type='EXPENSE' THEN t.amount ELSE 0 END) AS expense
    FROM transactions t WHERE t.user_id=? AND t.date>=? AND t.date<? AND t.kind='NORMAL'${account}
    GROUP BY t.account_id ORDER BY t.account_id`,
    params,
  );
  return rows;
}
module.exports = { daily, categories, accounts };
