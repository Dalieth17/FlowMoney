require('../helpers');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app')();
const { uniqueEmail } = require('../helpers');
const { waitForDatabase, runMigrations } = require('../../src/db/migrate');
const { closePool, pool } = require('../../src/db/pool');
const finance = require('../../src/services/financeService');
const backup = require('../../src/services/backupService');
const txRepo = require('../../src/repositories/transactionRepository');
before(async () => {
  await waitForDatabase();
  await runMigrations();
});
after(() => closePool());
async function user() {
  const agent = request.agent(app);
  const { body } = await agent
    .post('/api/auth/register')
    .send({ name: 'Finance', email: uniqueEmail('finance'), password: 'secret123', acceptTerms: true })
    .expect(201);
  await pool.query('DELETE FROM transactions WHERE user_id = ?', [body.user.id]);
  const { body: data } = await agent.get('/api/bootstrap').expect(200);
  return { agent, id: body.user.id, data };
}
const transfer = (u) => ({
  fromAccountId: u.data.accounts[0].id,
  toAccountId: u.data.accounts[1].id,
  amount: 100,
  fee: 2,
  categoryId: u.data.categories[0].id,
  date: finance.at(finance.today()),
  description: 'Retiro',
  note: '',
});
const snapshot = async (u) => (await u.agent.get('/api/finance/backup').expect(200)).body;

test('saldo actual incluye el último milisegundo del día colombiano y excluye el siguiente', async () => {
  const u = await user(),
    accountId = u.data.accounts[0].id,
    categoryId = u.data.categories[0].id;
  const last = Date.parse(`${finance.today()}T23:59:59.999-05:00`);
  for (const [amount, date] of [
    [10, last],
    [999, last + 1],
  ])
    await u.agent
      .post('/api/transactions')
      .send({ description: 'Cierre diario', amount, date, type: 'INCOME', accountId, categoryId })
      .expect(201);
  const state = (await u.agent.get('/api/finance').expect(200)).body;
  const original = u.data.accounts[0].initialBalance;
  assert.equal(state.accounts[0].currentBalance, original + 10);
  assert.equal(state.accounts[0].projectedBalance, original + 1009);
  await u.agent
    .post(`/api/finance/reconciliations/${randomUUID()}`)
    .send({
      accountId,
      categoryId,
      expectedBalance: original + 10,
      actualBalance: original + 15,
      note: 'Conteo nocturno',
    })
    .expect(200);
});

test('transferencia concurrente e idempotente, edición completa, aislamiento y borrado atómico', async () => {
  const u = await user(),
    other = await user(),
    id = randomUUID(),
    payload = transfer(u);
  const results = await Promise.all([1, 2, 3].map(() => u.agent.post(`/api/finance/transfers/${id}`).send(payload)));
  assert.deepEqual(
    results.map((r) => r.status),
    [201, 201, 201],
  );
  await u.agent.post(`/api/finance/transfers/${id.toUpperCase()}`).send(payload).expect(201);
  let data = await snapshot(u);
  assert.equal(data.transactions.length, 3);
  const state = (await u.agent.get('/api/finance').expect(200)).body;
  assert.equal(state.accounts[0].currentBalance, u.data.accounts[0].initialBalance - 102);
  assert.equal(state.accounts[1].currentBalance, u.data.accounts[1].initialBalance + 100);
  await u.agent
    .put(`/api/transactions/${data.transactions[0].id}`)
    .send({ ...data.transactions[0], amount: 9 })
    .expect(409);
  await other.agent.put(`/api/finance/transfers/${id}`).send(transfer(other)).expect(404);
  await u.agent
    .post(`/api/finance/transfers/${randomUUID()}`)
    .send({ ...payload, toAccountId: other.data.accounts[0].id })
    .expect(400);
  await u.agent
    .post(`/api/finance/transfers/${randomUUID()}`)
    .send({ ...payload, toAccountId: payload.fromAccountId })
    .expect(400);
  await u.agent
    .put(`/api/finance/transfers/${id}`)
    .send({ ...payload, amount: 250, fee: 0 })
    .expect(200);
  data = await snapshot(u);
  assert.equal(data.transactions.length, 2);
  assert.ok(data.transactions.every((t) => t.amount === 250));
  await u.agent.delete(`/api/finance/transfers/${id}`).expect(204);
  assert.equal((await snapshot(u)).transactions.length, 0);
});

test('conciliación excluye futuros, detecta saldo obsoleto y reintentos no duplican ajuste', async () => {
  const u = await user(),
    accountId = u.data.accounts[0].id,
    categoryId = u.data.categories[0].id;
  await u.agent
    .post('/api/transactions')
    .send({ amount: 999, type: 'INCOME', description: 'Futuro', date: finance.at('2099-12-01'), categoryId, accountId })
    .expect(201);
  const original = u.data.accounts[0].initialBalance;
  let state = (await u.agent.get('/api/finance').expect(200)).body;
  assert.equal(state.accounts[0].currentBalance, original);
  assert.equal(state.accounts[0].projectedBalance, original + 999);
  const id = randomUUID(),
    payload = {
      accountId,
      categoryId,
      expectedBalance: original,
      actualBalance: original + 7,
      note: 'Diferencia de efectivo',
    };
  await u.agent.post(`/api/finance/reconciliations/${id}`).send(payload).expect(200);
  await u.agent.post(`/api/finance/reconciliations/${id}`).send(payload).expect(200);
  await u.agent.post(`/api/finance/reconciliations/${randomUUID()}`).send(payload).expect(409);
  state = (await u.agent.get('/api/finance').expect(200)).body;
  assert.equal(state.accounts[0].currentBalance, original + 7);
  const data = await snapshot(u);
  assert.equal(data.transactions.filter((t) => t.kind === 'ADJUSTMENT').length, 1);
  await u.agent.delete(`/api/transactions/${data.transactions.find((t) => t.kind === 'ADJUSTMENT').id}`).expect(409);
});

test('recurrencias: fin de mes, concurrencia, pausa y borrados no regeneran el mismo período', async () => {
  const u = await user();
  const schedule = {
    creationKey: randomUUID(),
    transaction: {
      amount: 30,
      description: 'Mensual',
      type: 'EXPENSE',
      categoryId: u.data.categories[0].id,
      accountId: u.data.accounts[0].id,
      note: '',
    },
    startDate: '2024-01-01',
    endDate: '2024-03-31',
    dayOfMonth: 31,
    active: true,
  };
  const { body: s } = await u.agent.post('/api/finance/schedules').send(schedule).expect(201);
  const { body: retry } = await u.agent.post('/api/finance/schedules').send(schedule).expect(201);
  assert.equal(retry.id, s.id);
  await u.agent
    .put(`/api/finance/schedules/${s.id}`)
    .send({ ...schedule, creationKey: randomUUID() })
    .expect(409);
  const previewAt = async (iso) => (await finance.state(u.id, new Date(iso))).schedules[0].preview;
  assert.deepEqual(await previewAt('2024-02-29T04:59:59Z'), {
    pending: 1,
    firstPending: '2024-01-31',
    nextDate: '2024-02-29',
  });
  assert.deepEqual(await previewAt('2024-02-29T05:00:00Z'), {
    pending: 2,
    firstPending: '2024-01-31',
    nextDate: '2024-03-31',
  });
  assert.equal((await snapshot(u)).transactions.length, 0);
  const results = await Promise.all([1, 2, 3].map(() => finance.runSchedules(u.id, new Date('2024-03-31T22:00:00Z'))));
  assert.equal(
    results.reduce((n, r) => n + r.generated, 0),
    3,
  );
  let data = await snapshot(u);
  assert.deepEqual(data.transactions.map((t) => new Date(t.date).toISOString().slice(0, 10)).sort(), [
    '2024-01-31',
    '2024-02-29',
    '2024-03-31',
  ]);
  await u.agent.delete(`/api/transactions/${data.transactions[0].id}`).expect(204);
  assert.deepEqual(await previewAt('2024-03-31T22:00:00Z'), { pending: 0, firstPending: null, nextDate: null });
  assert.equal((await finance.runSchedules(u.id, new Date('2024-03-31T22:00:00Z'))).generated, 0);
  await u.agent
    .put(`/api/finance/schedules/${s.id}`)
    .send({ ...schedule, active: false, endDate: null })
    .expect(200);
  assert.deepEqual((await u.agent.get('/api/finance').expect(200)).body.schedules[0].preview, {
    pending: 0,
    firstPending: null,
    nextDate: null,
  });
  assert.equal((await finance.runSchedules(u.id)).generated, 0);
  data = await snapshot(u);
  assert.equal(data.occurrences.length, 3);
  assert.equal(data.occurrences.filter((o) => o.transactionId === null).length, 1);
});

test('restauración completa remapea IDs y mantiene transferencias, conciliaciones y deduplicación', async () => {
  const u = await user();
  await u.agent.post(`/api/finance/transfers/${randomUUID()}`).send(transfer(u)).expect(201);
  const schedule = {
    transaction: {
      amount: 12,
      description: 'Suscripción',
      type: 'EXPENSE',
      categoryId: u.data.categories[0].id,
      accountId: u.data.accounts[0].id,
      note: '',
    },
    startDate: '2024-02-01',
    endDate: '2024-02-29',
    dayOfMonth: 31,
    active: true,
  };
  await u.agent.post('/api/finance/schedules').send(schedule).expect(201);
  await finance.runSchedules(u.id);
  const source = await snapshot(u);
  const preview = (await u.agent.post('/api/finance/backup/preview').send(source).expect(200)).body;
  await u.agent
    .post('/api/finance/backup/restore')
    .send({ backup: source, digest: preview.digest, password: 'wrong' })
    .expect(400);
  assert.deepEqual(await snapshot(u), source);
  await u.agent
    .post('/api/finance/backup/restore')
    .send({ backup: source, digest: preview.digest, password: 'secret123' })
    .expect(200);
  const result = await snapshot(u);
  assert.equal(result.transactions.length, source.transactions.length);
  assert.equal(result.operations.length, 1);
  assert.equal(result.occurrences.length, 1);
  assert.notEqual(result.accounts[0].id, source.accounts[0].id);
  await u.agent.post('/api/finance/backup/preview').send(result).expect(200);
  assert.equal((await finance.runSchedules(u.id)).generated, 0);
  await u.agent.delete(`/api/finance/transfers/${source.operations[0].id}`).expect(204);
  assert.equal((await snapshot(u)).transactions.length, 1);
});

test('respaldo inválido no modifica datos y fallo durante restauración hace rollback', async () => {
  const u = await user(),
    source = await snapshot(u);
  const invalid = { ...source, budgets: [{ id: 1, categoryId: 99999999, amount: 2, month: 0, year: 2026 }] };
  await u.agent.post('/api/finance/backup/preview').send(invalid).expect(400);
  const data = {
    ...source,
    transactions: [
      {
        id: 1,
        amount: 1,
        type: 'EXPENSE',
        description: 'Restaurar',
        date: finance.at('2026-01-01'),
        categoryId: source.categories[0].id,
        accountId: source.accounts[0].id,
        note: '',
        kind: 'NORMAL',
        operationId: null,
      },
    ],
  };
  const p = backup.preview(data);
  const original = txRepo.create;
  txRepo.create = async () => {
    throw Error('Fallo de prueba al insertar');
  };
  try {
    await assert.rejects(backup.restore(u.id, data, p.digest, 'secret123'), /Fallo de prueba/);
  } finally {
    txRepo.create = original;
  }
  assert.deepEqual(await snapshot(u), source);
});

test('respaldo adulterado y contenido de otro usuario no acceden a sus IDs', async () => {
  const u = await user(),
    other = await user();
  await u.agent.post(`/api/finance/transfers/${randomUUID()}`).send(transfer(u)).expect(201);
  const source = await snapshot(u),
    copy = structuredClone(source);
  copy.transactions.pop();
  await u.agent.post('/api/finance/backup/preview').send(copy).expect(400);
  const p = backup.preview(source);
  await other.agent
    .post('/api/finance/backup/restore')
    .send({ backup: source, digest: p.digest, password: 'secret123' })
    .expect(200);
  const result = await snapshot(other);
  assert.ok(result.accounts.every((a) => !source.accounts.some((b) => b.id === a.id)));
  assert.deepEqual(await snapshot(u), source);
});

test('acepta respaldo legado versión 1 y rechaza una confirmación de otro contenido', async () => {
  const u = await user(),
    data = await snapshot(u);
  const legacy = { ...data, version: 1, user: { currency: 'COP' } };
  const { body: p } = await u.agent.post('/api/finance/backup/preview').send(legacy).expect(200);
  await u.agent
    .post('/api/finance/backup/restore')
    .send({ backup: legacy, digest: '0'.repeat(64), password: 'secret123' })
    .expect(400);
  assert.deepEqual(await snapshot(u), data);
  await u.agent
    .post('/api/finance/backup/restore')
    .send({ backup: legacy, digest: p.digest, password: 'secret123' })
    .expect(200);
  await u.agent.post('/api/finance/backup/preview').send({ version: 1, transactions: 'texto' }).expect(400);
});
