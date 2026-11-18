require('../helpers');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app')();
const { uniqueEmail } = require('../helpers');
const { waitForDatabase, runMigrations } = require('../../src/db/migrate');
const { closePool } = require('../../src/db/pool');
const { today } = require('../../src/services/financeService');
before(async () => {
  await waitForDatabase();
  await runMigrations();
});
after(() => closePool());
async function user() {
  const a = request.agent(app);
  await a
    .post('/api/auth/register')
    .send({ name: 'Metas', email: uniqueEmail('goals'), password: 'secret123', acceptTerms: true })
    .expect(201);
  return a;
}
const goal = { name: 'Emergencias', target: 100, deadline: '2099-12-01', archived: false };
const entry = { amount: 30, type: 'ADD', date: today(), note: 'Ahorro del mes' };
test('metas: CRUD, reintentos, aislamiento y los saldos financieros no cambian', async () => {
  const a = await user(),
    other = await user(),
    id = randomUUID(),
    eid = randomUUID();
  const before = (await a.get('/api/bootstrap').expect(200)).body;
  await a.post(`/api/goals/${id}`).send(goal).expect(201);
  await a.post(`/api/goals/${id}`).send(goal).expect(201);
  const results = await Promise.all([1, 2, 3].map(() => a.post(`/api/goals/${id}/entries/${eid}`).send(entry)));
  assert.ok(results.every((r) => r.status === 201));
  let data = (await a.get('/api/goals').expect(200)).body;
  assert.equal(data.goals.length, 1);
  assert.equal(data.goalEntries.length, 1);
  await other.put(`/api/goals/${id}`).send(goal).expect(404);
  await other.post(`/api/goals/${id}/entries/${randomUUID()}`).send(entry).expect(404);
  assert.equal((await other.get('/api/goals').expect(200)).body.goals.length, 0);
  await a
    .put(`/api/goals/${id}`)
    .send({ ...goal, name: 'Fondo de emergencia' })
    .expect(200);
  data = (await a.get('/api/bootstrap').expect(200)).body;
  assert.deepEqual(data, before);
});
test('no permite retirar más de lo ahorrado ni borrar el aporte que sostiene un retiro', async () => {
  const a = await user(),
    id = randomUUID(),
    deposit = randomUUID(),
    withdraw = randomUUID();
  await a.post(`/api/goals/${id}`).send(goal).expect(201);
  await a
    .post(`/api/goals/${id}/entries/${randomUUID()}`)
    .send({ ...entry, type: 'WITHDRAW' })
    .expect(409);
  await a.post(`/api/goals/${id}/entries/${deposit}`).send(entry).expect(201);
  await a
    .post(`/api/goals/${id}/entries/${withdraw}`)
    .send({ ...entry, type: 'WITHDRAW', amount: 10 })
    .expect(201);
  await a.delete(`/api/goals/${id}/entries/${deposit}`).expect(409);
  await a.delete(`/api/goals/${id}/entries/${withdraw}`).expect(204);
  await a.delete(`/api/goals/${id}/entries/${deposit}`).expect(204);
  assert.equal((await a.get('/api/goals').expect(200)).body.goalEntries.length, 0);
});
test('archivar preserva el historial y bloquea nuevos aportes; rechaza fechas futuras', async () => {
  const a = await user(),
    id = randomUUID();
  await a.post(`/api/goals/${id}`).send(goal).expect(201);
  await a
    .post(`/api/goals/${id}/entries/${randomUUID()}`)
    .send({ ...entry, date: '2099-01-01' })
    .expect(400);
  await a.post(`/api/goals/${id}/entries/${randomUUID()}`).send(entry).expect(201);
  await a
    .put(`/api/goals/${id}`)
    .send({ ...goal, archived: true })
    .expect(200);
  await a.post(`/api/goals/${id}/entries/${randomUUID()}`).send(entry).expect(409);
  assert.equal((await a.get('/api/goals').expect(200)).body.goalEntries.length, 1);
  await a.put(`/api/goals/${id}`).send(goal).expect(200);
  await a.post(`/api/goals/${id}/entries/${randomUUID()}`).send(entry).expect(201);
});
test('el respaldo v3 restaura metas y aportes y valida referencias antes de reemplazar', async () => {
  const a = await user(),
    id = randomUUID();
  await a.post(`/api/goals/${id}`).send(goal).expect(201);
  await a.post(`/api/goals/${id}/entries/${randomUUID()}`).send(entry).expect(201);
  const data = (await a.get('/api/finance/backup').expect(200)).body;
  assert.equal(data.version, 3);
  assert.equal(data.goals.length, 1);
  assert.equal(data.goalEntries.length, 1);
  const bad = structuredClone(data);
  bad.goalEntries[0].goalId = randomUUID();
  await a.post('/api/finance/backup/preview').send(bad).expect(400);
  const { body: p } = await a.post('/api/finance/backup/preview').send(data).expect(200);
  assert.equal(p.goals, 1);
  assert.equal(p.goalEntries, 1);
  await a.post('/api/data/reset').expect(204);
  assert.equal((await a.get('/api/goals').expect(200)).body.goals.length, 0);
  await a
    .post('/api/finance/backup/restore')
    .send({ backup: data, digest: p.digest, password: 'secret123' })
    .expect(200);
  const restored = (await a.get('/api/goals').expect(200)).body;
  assert.deepEqual(restored.goals, data.goals);
  assert.deepEqual(restored.goalEntries, data.goalEntries);
});
test('respaldos versión 2 se conservan compatibles y la vista previa informa que no hay metas', async () => {
  const a = await user();
  const data = (await a.get('/api/finance/backup').expect(200)).body;
  data.version = 2;
  delete data.goals;
  delete data.goalEntries;
  const { body: p } = await a.post('/api/finance/backup/preview').send(data).expect(200);
  assert.equal(p.goals, 0);
  assert.equal(p.goalEntries, 0);
  await a
    .post('/api/finance/backup/restore')
    .send({ backup: data, digest: p.digest, password: 'secret123' })
    .expect(200);
});
