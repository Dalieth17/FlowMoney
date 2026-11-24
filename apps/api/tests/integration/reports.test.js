require('../helpers');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app')();
const { uniqueEmail } = require('../helpers');
const { pool, closePool } = require('../../src/db/pool');
const { waitForDatabase, runMigrations } = require('../../src/db/migrate');
before(async () => {
  await waitForDatabase();
  await runMigrations();
});
after(() => closePool());
async function user() {
  const agent = request.agent(app);
  const { body } = await agent
    .post('/api/auth/register')
    .send({ name: 'Reportes', email: uniqueEmail('reports'), password: 'secret123', acceptTerms: true })
    .expect(201);
  await pool.query('DELETE FROM transactions WHERE user_id=?', [body.user.id]);
  const { body: data } = await agent.get('/api/bootstrap').expect(200);
  return { agent, id: body.user.id, data };
}
test('reportes SQL: límites colombianos, centavos, filtros, comisiones y aislamiento', async () => {
  const u = await user(),
    other = await user();
  const [a, b] = u.data.accounts,
    categoryId = u.data.categories[0].id;
  async function tx(amount, type, date, accountId = a.id) {
    await u.agent
      .post('/api/transactions')
      .send({ description: 'Reporte', amount, type, date: Date.parse(date), accountId, categoryId })
      .expect(201);
  }
  await tx(99, 'INCOME', '2025-01-01T04:59:59.999Z'); // diciembre en Colombia
  await tx(100.1, 'INCOME', '2025-01-01T05:00:00.000Z');
  await tx(0.2, 'INCOME', '2025-01-31T12:00:00Z');
  await tx(20, 'EXPENSE', '2025-02-01T04:59:59.999Z');
  await tx(88, 'EXPENSE', '2025-02-01T05:00:00.000Z'); // febrero
  await tx(7, 'EXPENSE', '2025-01-10T12:00:00Z', null);
  await u.agent
    .post(`/api/finance/transfers/${randomUUID()}`)
    .send({
      fromAccountId: a.id,
      toAccountId: b.id,
      amount: 50,
      fee: 2,
      categoryId,
      date: Date.parse('2025-01-15T12:00:00Z'),
      description: 'Transferir',
      note: '',
    })
    .expect(201);
  const { body: r } = await u.agent.get('/api/reports/monthly?month=0&year=2025').expect(200);
  assert.deepEqual(r.summary, { income: 100.3, expense: 29, balance: 71.3, savingRate: 71 });
  assert.deepEqual(r.comparison, {
    hasPrevious: true,
    hasCurrent: true,
    change: { income: 1.3, expense: 29, balance: -27.7 },
  });
  assert.equal(r.history.length, 6);
  assert.deepEqual(r.history[4], { month: 11, year: 2024, income: 99, expense: 0 });
  assert.equal(r.categories[0].value, 29);
  assert.equal(r.accounts.find((x) => x.accountId === a.id).expense, 22);
  assert.equal(r.accounts.find((x) => x.accountId === null).expense, 7);
  const { body: filtered } = await u.agent.get(`/api/reports/monthly?month=0&year=2025&accountId=${a.id}`).expect(200);
  assert.equal(filtered.summary.expense, 22);
  assert.deepEqual(filtered.comparison.change, { income: 1.3, expense: 22, balance: -20.7 });
  const { body: none } = await u.agent.get('/api/reports/monthly?month=0&year=2025&accountId=none').expect(200);
  assert.deepEqual(none.summary, { income: 0, expense: 7, balance: -7, savingRate: 0 });
  const { body: empty } = await other.agent.get('/api/reports/monthly?month=0&year=2025').expect(200);
  assert.deepEqual(none.comparison, { hasPrevious: false, hasCurrent: true, change: null });
  assert.deepEqual(empty.comparison, { hasPrevious: false, hasCurrent: false, change: null });
  assert.equal(empty.summary.income, 0);
  await other.agent.get(`/api/reports/monthly?month=0&year=2025&accountId=${a.id}`).expect(404);
  for (const q of ['month=12&year=2025', 'month=0&year=1999', 'month=0&year=2025&accountId=-1'])
    await u.agent.get(`/api/reports/monthly?${q}`).expect(400);
  await request(app).get('/api/reports/monthly?month=0&year=2025').expect(401);
  const { body: balances } = await u.agent.get('/api/accounts/balances').expect(200);
  assert.equal(
    balances.find((x) => x.id === a.id).currentBalance,
    Math.round((a.initialBalance + 99 + 100.3 - 20 - 88 - 50 - 2) * 100) / 100,
  );
  assert.equal(balances.find((x) => x.id === b.id).currentBalance, b.initialBalance + 50);
});
