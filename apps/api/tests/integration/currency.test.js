require('../helpers');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app')();
const { uniqueEmail } = require('../helpers');
const { waitForDatabase, runMigrations } = require('../../src/db/migrate');
const { closePool, pool } = require('../../src/db/pool');
const backup = require('../../src/services/backupService');
const finance = require('../../src/services/financeService');
const goals = require('../../src/services/goalService');
const profile = require('../../src/services/profileService');
const currencyRepo = require('../../src/repositories/currencyRepository');
before(async () => {
  await waitForDatabase();
  await runMigrations();
});
after(() => closePool());
const exchange = (fromCurrency = 'COP', copPerUsd = 4000) => ({ fromCurrency, copPerUsd, source: 'manual' });
async function user(currency = 'COP') {
  const agent = request.agent(app);
  const { body } = await agent
    .post('/api/auth/register')
    .send({ name: 'Cambio', email: uniqueEmail('cambio'), password: 'secret123', acceptTerms: true, currency })
    .expect(201);
  // Esta suite prueba conversiones sobre datos de demostración cargados explícitamente.
  await agent.post('/api/data/reset').expect(204);
  const { body: data } = await agent.get('/api/bootstrap').expect(200);
  return { agent, id: body.user.id, data };
}
const change = (u, currency = 'USD', rate = exchange()) =>
  u.agent.put('/api/profile').send({ name: 'Cambio', currency, exchange: rate });

test('COP/USD convierte todo, conserva IDs y recurrencias, y el respaldo sigue siendo restaurable', async () => {
  const u = await user(),
    other = await user();
  const otherBefore = await backup.exportData(other.id);
  await pool.query('DELETE FROM transactions WHERE user_id = ?', [u.id]);
  const accountId = u.data.accounts[0].id,
    categoryId = u.data.categories[0].id;
  const transferId = randomUUID();
  await finance.transfer(u.id, transferId, {
    fromAccountId: accountId,
    toAccountId: u.data.accounts[1].id,
    categoryId,
    amount: 40000,
    fee: 8000,
    date: finance.at(finance.today()),
    description: 'Transferencia',
    note: '',
  });
  const current = (await finance.state(u.id)).accounts[0].currentBalance;
  await finance.reconcile(u.id, randomUUID(), {
    accountId,
    categoryId,
    expectedBalance: current,
    actualBalance: current + 12000,
    note: 'Conteo',
  });
  await finance.saveSchedule(u.id, null, {
    creationKey: randomUUID(),
    transaction: { amount: 12000, type: 'EXPENSE', description: 'Mensual', categoryId, accountId, note: '' },
    startDate: '2024-01-01',
    endDate: '2024-01-01',
    dayOfMonth: 1,
    active: true,
  });
  await finance.runSchedules(u.id, new Date('2024-01-01T22:00:00Z'));
  const goalId = randomUUID();
  await goals.save(u.id, goalId, { name: 'Meta', target: 400000, deadline: null, archived: false });
  await goals.add(u.id, goalId, randomUUID(), { amount: 40000, type: 'ADD', date: finance.today(), note: '' });
  await goals.add(u.id, goalId, randomUUID(), { amount: 8000, type: 'WITHDRAW', date: finance.today(), note: '' });
  const before = await backup.exportData(u.id);
  const { body: updated } = await change(u).expect(200);
  assert.equal(updated.currency, 'USD');
  assert.equal(updated.lastCurrencyChange.copPerUsd, 4000);
  assert.equal(updated.lastCurrencyChange.source, 'manual');
  assert.deepEqual(
    updated.convertedData.accounts.map((a) => a.id),
    before.accounts.map((a) => a.id),
  );
  const after = await backup.exportData(u.id);
  for (const field of ['accounts', 'transactions', 'budgets', 'operations', 'schedules', 'goals', 'goalEntries'])
    assert.deepEqual(
      after[field].map((x) => x.id),
      before[field].map((x) => x.id),
    );
  assert.equal(after.accounts[0].initialBalance, before.accounts[0].initialBalance / 4000);
  assert.equal(after.operations.find((o) => o.id === transferId).data.fee, 2);
  assert.equal(after.schedules[0].data.transaction.amount, 3);
  assert.equal(after.goals[0].data.target, 100);
  assert.deepEqual(
    after.goalEntries.map((e) => e.data.amount).sort((a, b) => a - b),
    [2, 10],
  );
  assert.deepEqual(after.occurrences, before.occurrences);
  assert.equal((await finance.runSchedules(u.id)).generated, 0);
  const preview = backup.preview(after);
  await backup.restore(u.id, after, preview.digest, 'secret123');
  assert.equal((await backup.exportData(u.id)).currency, 'USD');
  assert.deepEqual(await backup.exportData(other.id), otherBefore, 'otro usuario no cambia');
});

test('USD/COP convierte usando la tasa inversa y un cambio solo de nombre no convierte', async () => {
  const u = await user('USD');
  const before = await backup.exportData(u.id);
  await change(u, 'COP', exchange('USD')).expect(200);
  const after = await backup.exportData(u.id);
  assert.equal(after.transactions.find((t) => t.description === 'Sueldo del mes').amount, 16800000);
  assert.equal(after.accounts[0].initialBalance, before.accounts[0].initialBalance * 4000);
  await u.agent.put('/api/profile').send({ name: 'Otro nombre', currency: 'COP' }).expect(200);
  assert.deepEqual(await backup.exportData(u.id), after);
});

test('sin tasa, tasas inválidas y solicitudes concurrentes no reinterpretan ni convierten dos veces', async () => {
  const u = await user();
  const before = await backup.exportData(u.id);
  await u.agent.put('/api/profile').send({ name: 'Cambio', currency: 'USD' }).expect(400);
  await change(u, 'USD', exchange('COP', 0)).expect(400);
  await change(u, 'USD', exchange('USD')).expect(409);
  assert.deepEqual(await backup.exportData(u.id), before);
  const responses = await Promise.all([change(u), change(u)]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const result = await backup.exportData(u.id);
  assert.equal(result.transactions.find((t) => t.description === 'Sueldo del mes').amount, 1125);
  const [[row]] = await pool.query('SELECT COUNT(*) AS n FROM currency_changes WHERE user_id = ?', [u.id]);
  assert.equal(row.n, 1);
});

test('montos subcentavo, desbordamientos y fallos durante la escritura revierten todo', async () => {
  const u = await user();
  await u.agent
    .post('/api/transactions')
    .send({
      description: 'Mínimo',
      amount: 0.01,
      type: 'EXPENSE',
      categoryId: u.data.categories[0].id,
      accountId: null,
      date: Date.now(),
    })
    .expect(201);
  const before = await backup.exportData(u.id);
  await change(u).expect(400);
  assert.deepEqual(await backup.exportData(u.id), before);
  const big = await user('USD');
  await big.agent
    .put(`/api/accounts/${big.data.accounts[0].id}`)
    .send({ ...big.data.accounts[0], initialBalance: 9999999999.99 })
    .expect(200);
  const bigBefore = await backup.exportData(big.id);
  await change(big, 'COP', exchange('USD')).expect(400);
  assert.deepEqual(await backup.exportData(big.id), bigBefore);
  const rollbackUser = await user();
  const rollbackBefore = await backup.exportData(rollbackUser.id);
  const record = currencyRepo.record;
  currencyRepo.record = async () => {
    throw Error('Fallo simulado después de actualizar importes');
  };
  try {
    await assert.rejects(
      profile.updateProfile(rollbackUser.id, { name: 'Falló', currency: 'USD', exchange: exchange() }),
      /Fallo simulado/,
    );
  } finally {
    currencyRepo.record = record;
  }
  assert.deepEqual(await backup.exportData(rollbackUser.id), rollbackBefore);
  assert.equal((await profile.getProfile(rollbackUser.id)).lastCurrencyChange, null);
});

test('formularios y páginas abiertos en otra moneda se rechazan bajo el mismo bloqueo de escritura', async () => {
  const u = await user();
  await change(u).expect(200);
  const payload = {
    description: 'Formulario antiguo',
    amount: 40000,
    type: 'EXPENSE',
    categoryId: u.data.categories[0].id,
    accountId: null,
    date: Date.now(),
  };
  await u.agent.post('/api/transactions').set('X-FlowMoney-Currency', 'COP').send(payload).expect(409);
  await u.agent.get('/api/transactions/page?currency=COP').expect(409);
  await u.agent.get('/api/transactions/page?currency=USD').expect(200);
  await u.agent.get('/api/finance').set('X-FlowMoney-Currency', 'COP').expect(409);
  await u.agent
    .post('/api/transactions')
    .set('X-FlowMoney-Currency', 'USD')
    .send({ ...payload, amount: 10 })
    .expect(201);
  const data = await backup.exportData(u.id);
  assert.equal(data.transactions.find((t) => t.description === payload.description).amount, 10);
});

test('tasa automática autenticada, fallo de proveedor y verificación de la tasa confirmada', async () => {
  await request(app).get('/api/profile/exchange-rate').expect(401);
  const u = await user();
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => {
      throw Error('Sin internet');
    };
    await u.agent.get('/api/profile/exchange-rate').expect(503);
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        result: 'success',
        base_code: 'USD',
        time_last_update_unix: Math.floor(Date.now() / 1000),
        rates: { COP: 4000 },
      }),
    });
    const { body: quote } = await u.agent.get('/api/profile/exchange-rate').expect(200);
    await change(u, 'USD', { ...quote, fromCurrency: 'COP', copPerUsd: 5000 }).expect(409);
    await change(u, 'USD', { ...quote, fromCurrency: 'COP' }).expect(200);
    assert.equal((await profile.getProfile(u.id)).lastCurrencyChange.source, 'automatic');
  } finally {
    global.fetch = originalFetch;
  }
});
