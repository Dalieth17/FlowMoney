require('../helpers');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { uniqueEmail } = require('../helpers');
const app = require('../../src/app')();
const { pool, closePool } = require('../../src/db/pool');
const { waitForDatabase, runMigrations } = require('../../src/db/migrate');
const budgets = require('../../src/repositories/budgetRepository');
before(async () => {
  await waitForDatabase();
  await runMigrations();
});
after(() => closePool());
async function user() {
  const agent = request.agent(app);
  const { body } = await agent
    .post('/api/auth/register')
    .send({ name: 'Presupuestos', email: uniqueEmail('budget-copy'), password: 'secret123', acceptTerms: true })
    .expect(201);
  await pool.query('DELETE FROM budgets WHERE user_id=?', [body.user.id]);
  const { body: data } = await agent.get('/api/bootstrap').expect(200);
  return { agent, id: body.user.id, data };
}
const set = (u, index, month, year, amount) =>
  u.agent.put('/api/budgets').send({ categoryId: u.data.categories[index].id, month, year, amount }).expect(200);
const copy = (u, month = 0, year = 2026) => u.agent.post('/api/budgets/copy-previous').send({ month, year });
const all = async (u) => (await u.agent.get('/api/budgets').expect(200)).body;
test('copia diciembre a enero con centavos y conserva los límites e IDs existentes', async () => {
  const u = await user();
  await set(u, 0, 11, 2025, 100.25);
  await set(u, 1, 11, 2025, 0.1);
  await set(u, 2, 11, 2025, 75.55);
  const { body: existing } = await set(u, 0, 0, 2026, 900);
  const { body: extra } = await set(u, 3, 0, 2026, 500);
  const { body: r } = await copy(u).expect(200);
  assert.equal(r.copied, 2);
  assert.equal(r.existing, 1);
  assert.deepEqual(r.source, { month: 11, year: 2025 });
  assert.equal(r.budgets.length, 4);
  assert.deepEqual(
    r.budgets.find((b) => b.categoryId === existing.categoryId),
    existing,
  );
  assert.deepEqual(
    r.budgets.find((b) => b.categoryId === extra.categoryId),
    extra,
  );
  assert.equal(r.budgets.find((b) => b.categoryId === u.data.categories[1].id).amount, 0.1);
  const snapshot = await all(u);
  const { body: again } = await copy(u).expect(200);
  assert.equal(again.copied, 0);
  assert.equal(again.existing, 3);
  assert.deepEqual(await all(u), snapshot);
});
test('confirmaciones concurrentes no duplican ni sobrescriben límites', async () => {
  const u = await user();
  await set(u, 0, 11, 2025, 123.45);
  const responses = await Promise.all([copy(u), copy(u), copy(u)]);
  assert.ok(responses.every((r) => r.status === 200));
  assert.equal(
    responses.reduce((n, r) => n + r.body.copied, 0),
    1,
  );
  assert.equal((await all(u)).filter((b) => b.year === 2026 && b.month === 0).length, 1);
  await set(u, 1, 11, 2025, 77);
  await Promise.all([copy(u), set(u, 1, 0, 2026, 600)]);
  assert.equal(
    (await all(u)).find((b) => b.year === 2026 && b.month === 0 && b.categoryId === u.data.categories[1].id).amount,
    600,
  );
});
test('sin origen no altera el destino ni mezcla presupuestos de otros usuarios', async () => {
  const u = await user(),
    other = await user();
  await set(other, 0, 11, 2025, 700);
  await set(u, 1, 0, 2026, 80);
  const own = await all(u),
    foreign = await all(other);
  const { body: r } = await copy(u).expect(200);
  assert.equal(r.copied, 0);
  assert.equal(r.existing, 0);
  assert.deepEqual(await all(u), own);
  assert.deepEqual(await all(other), foreign);
  await request(app).post('/api/budgets/copy-previous').send({ month: 0, year: 2026 }).expect(401);
});
test('períodos fuera de rango y moneda obsoleta se rechazan sin escribir', async () => {
  const u = await user();
  await set(u, 0, 0, 2000, 0.01);
  await copy(u, 0, 2000).expect(400);
  for (const [month, year] of [
    [-1, 2026],
    [12, 2026],
    [0, 1999],
    [0, 2101],
  ])
    await copy(u, month, year).expect(400);
  await u.agent
    .post('/api/budgets/copy-previous')
    .set('X-FlowMoney-Currency', 'USD')
    .send({ month: 1, year: 2000 })
    .expect(409);
  assert.equal((await all(u)).length, 1);
  const { body: first } = await copy(u, 1, 2000).expect(200);
  assert.equal(first.copied, 1);
  await set(u, 0, 10, 2100, 9999999999.99);
  const { body: last } = await copy(u, 11, 2100).expect(200);
  assert.equal(last.budgets[0].amount, 9999999999.99);
});
test('un fallo tras insertar revierte todo el lote conservando los datos anteriores', async () => {
  const u = await user();
  await set(u, 0, 11, 2025, 10);
  await set(u, 1, 11, 2025, 20);
  const before = await all(u),
    original = budgets.copyMissing;
  budgets.copyMissing = async (...args) => {
    await original(...args);
    throw Error('Fallo controlado al copiar');
  };
  try {
    await copy(u).expect(500);
  } finally {
    budgets.copyMissing = original;
  }
  assert.deepEqual(await all(u), before);
  const { body: r } = await copy(u).expect(200);
  assert.equal(r.copied, 2);
});
