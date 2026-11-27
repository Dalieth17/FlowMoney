const { uniqueEmail } = require('../helpers');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app')();
const { waitForDatabase, runMigrations } = require('../../src/db/migrate');
const { closePool } = require('../../src/db/pool');

before(async () => {
  await waitForDatabase();
  await runMigrations();
});
after(closePool);

test('dos ediciones simultáneas solo guardan la primera y señalan los campos cambiados a la segunda', async () => {
  const agent = request.agent(app);
  await agent
    .post('/api/auth/register')
    .send({ name: 'Ana', email: uniqueEmail('edicion'), password: 'secret123', acceptTerms: true })
    .expect(201);
  const { body: data } = await agent.get('/api/bootstrap').expect(200);
  const expected = {
    amount: 14.25,
    description: 'Original',
    type: 'EXPENSE',
    categoryId: data.categories[0].id,
    accountId: null,
    date: Date.now(),
    note: '',
  };
  const { body: created } = await agent.post('/api/transactions').send(expected).expect(201);
  const path = `/api/transactions/${created.id}`;
  const drafts = [
    { ...expected, amount: 20, description: 'Primera', note: 'En efectivo' },
    {
      ...expected,
      date: expected.date - 86400000,
      type: 'INCOME',
      categoryId: data.categories[1].id,
      accountId: data.accounts[0].id,
    },
  ];
  const responses = await Promise.all(drafts.map((draft) => agent.put(path).send({ ...draft, expected })));
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const winner = responses.findIndex((r) => r.status === 200);
  const saved = { ...created, ...drafts[winner] };
  const fields = winner === 0 ? 'Descripción, Monto, Nota' : 'Fecha, Tipo, Categoría, Cuenta';
  assert.ok(responses[1 - winner].body.error.includes(fields));
  assert.deepEqual(responses[winner].body, saved);
  const { body: movements } = await agent.get('/api/transactions').expect(200);
  assert.deepEqual(movements, [saved]);
  const { body: history } = await agent.get(`${path}/history`).expect(200);
  assert.deepEqual(
    history.map((entry) => entry.action),
    ['UPDATE', 'CREATE'],
  );
  assert.deepEqual(history[0].beforeData, created);
  assert.deepEqual(history[0].afterData, saved);

  // Reabrir con datos actuales permite guardar; los clientes antiguos siguen pudiendo editar.
  await agent
    .put(path)
    .send({ ...saved, note: 'Revisado', expected: saved })
    .expect(200);
  await agent
    .put(path)
    .send({ ...saved, note: 'Cliente anterior' })
    .expect(200);
});
