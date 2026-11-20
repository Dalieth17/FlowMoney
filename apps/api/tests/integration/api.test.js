// Pruebas de extremo a extremo contra un MySQL real.
// Requiere DB_HOST/DB_USER/DB_PASSWORD/DB_NAME (ver README → Tests).
require('../helpers');
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { uniqueEmail } = require('../helpers');
const createApp = require('../../src/app');
const { waitForDatabase, runMigrations } = require('../../src/db/migrate');
const { closePool } = require('../../src/db/pool');
const userRepository = require('../../src/repositories/userRepository');
const { TERMS_VERSION } = require('../../src/config/legal');

const app = createApp();
const PASSWORD = 'secret123';

before(async () => {
  await waitForDatabase({ retries: 15, delayMs: 1000 });
  await runMigrations();
});
after(() => closePool());

/** Registra un usuario nuevo y devuelve un agente con su cookie de sesión. */
async function signUp(name = 'Ana', extra = {}) {
  const agent = request.agent(app);
  const email = uniqueEmail(name.toLowerCase());
  const res = await agent
    .post('/api/auth/register')
    .send({ name, email, password: PASSWORD, acceptTerms: true, ...extra });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const { body: data } = await agent.get('/api/bootstrap').expect(200);
  return { agent, email, data };
}

const txPayload = (data, overrides = {}) => ({
  description: 'Taxi al aeropuerto',
  amount: 35.5,
  type: 'EXPENSE',
  categoryId: data.categories.find((c) => c.name === 'Transporte').id,
  accountId: data.accounts[0].id,
  date: Date.now(),
  note: '',
  ...overrides,
});

describe('autenticación', () => {
  test('el registro abre sesión y comienza sin dinero ni movimientos', async () => {
    const { agent, data } = await signUp();
    assert.equal(data.user.name, 'Ana');
    assert.equal(data.user.currency, 'COP');
    assert.equal(data.categories.length, 9);
    assert.equal(data.accounts.length, 2);
    assert.ok(data.accounts.every((a) => a.initialBalance === 0));
    assert.deepEqual(data.transactions, []);
    assert.deepEqual(data.budgets, []);
    const { body: reloaded } = await agent.get('/api/bootstrap').expect(200);
    assert.deepEqual(reloaded.transactions, []);
    assert.ok(reloaded.accounts.every((a) => a.initialBalance === 0));
  });

  test('el registro empieza en cero en COP y USD', async () => {
    for (const currency of ['COP', 'USD']) {
      const { data } = await signUp('Ana', { currency });
      assert.equal(data.user.currency, currency);
      assert.ok(data.accounts.every((a) => a.initialBalance === 0));
      assert.deepEqual(data.transactions, []);
      assert.deepEqual(data.budgets, []);
    }
  });

  test('rechaza una moneda no soportada al registrarse', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana', email: uniqueEmail('ana'), password: PASSWORD, currency: 'EUR', acceptTerms: true });
    assert.equal(res.status, 400);
  });

  test('sin aceptar los términos no se crea la cuenta', async () => {
    for (const acceptTerms of [undefined, false, 'true']) {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Ana', email: uniqueEmail('ana'), password: PASSWORD, acceptTerms });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /Términos de uso/);
    }
  });

  test('guarda qué versión de los términos aceptó y cuándo', async () => {
    const { data } = await signUp();
    const consent = await userRepository.findConsent(data.user.id);
    assert.equal(consent.version, TERMS_VERSION);
    assert.ok(consent.acceptedAt instanceof Date);
    assert.ok(Math.abs(Date.now() - consent.acceptedAt.getTime()) < 24 * 3600 * 1000);
  });

  test('no permite correos duplicados', async () => {
    const { email } = await signUp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Otra', email, password: PASSWORD, acceptTerms: true });
    assert.equal(res.status, 409);
  });

  test('login: credenciales incorrectas → 401, correctas → 200 con cookie httpOnly', async () => {
    const { email } = await signUp();
    await request(app).post('/api/auth/login').send({ email, password: 'incorrecta' }).expect(401);
    const res = await request(app).post('/api/auth/login').send({ email: email.toUpperCase(), password: PASSWORD });
    assert.equal(res.status, 200);
    assert.match(res.headers['set-cookie'][0], /HttpOnly/i);
  });

  test('logout cierra la sesión', async () => {
    const { agent } = await signUp();
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });
});

describe('movimientos', () => {
  test('CRUD completo', async () => {
    const { agent, data } = await signUp();
    const created = await agent.post('/api/transactions').send(txPayload(data)).expect(201);
    assert.equal(created.body.amount, 35.5);

    const updated = await agent
      .put(`/api/transactions/${created.body.id}`)
      .send(txPayload(data, { amount: 40, note: 'ida y vuelta' }))
      .expect(200);
    assert.equal(updated.body.amount, 40);
    assert.equal(updated.body.note, 'ida y vuelta');

    await agent.delete(`/api/transactions/${created.body.id}`).expect(204);
    await agent.delete(`/api/transactions/${created.body.id}`).expect(404);
  });

  test('rechaza datos inválidos con mensaje claro', async () => {
    const { agent, data } = await signUp();
    const res = await agent
      .post('/api/transactions')
      .send(txPayload(data, { amount: -5 }))
      .expect(400);
    assert.equal(res.body.error, 'El monto mínimo es 0.01');
  });

  test('aislamiento: un usuario no puede tocar datos de otro', async () => {
    const ana = await signUp('Ana');
    const beto = await signUp('Beto');
    const { body: anaTx } = await ana.agent.post('/api/transactions').send(txPayload(ana.data)).expect(201);

    await beto.agent.put(`/api/transactions/${anaTx.id}`).send(txPayload(beto.data)).expect(404);
    await beto.agent.delete(`/api/transactions/${anaTx.id}`).expect(404);

    // Usar la categoría o la cuenta de otro usuario tampoco está permitido.
    const foreignCategory = txPayload(beto.data, { categoryId: ana.data.categories[0].id });
    await beto.agent.post('/api/transactions').send(foreignCategory).expect(400);
    const foreignAccount = txPayload(beto.data, { accountId: ana.data.accounts[0].id });
    const res = await beto.agent.post('/api/transactions').send(foreignAccount).expect(400);
    assert.equal(res.body.error, 'Cuenta no válida');
  });
});

describe('categorías', () => {
  test('las predeterminadas no se eliminan; las propias sí', async () => {
    const { agent, data } = await signUp();
    const res = await agent.delete(`/api/categories/${data.categories[0].id}`).expect(409);
    assert.match(res.body.error, /predeterminadas/);

    const pets = await agent
      .post('/api/categories')
      .send({ name: 'Mascotas', icon: '🐶', color: '#B0506B' })
      .expect(201);
    assert.equal(pets.body.isDefault, false);
    await agent.delete(`/api/categories/${pets.body.id}`).expect(204);
  });

  test('no se elimina una categoría con movimientos', async () => {
    const { agent, data } = await signUp();
    const pets = await agent
      .post('/api/categories')
      .send({ name: 'Mascotas', icon: '🐶', color: '#B0506B' })
      .expect(201);
    await agent
      .post('/api/transactions')
      .send(txPayload(data, { categoryId: pets.body.id }))
      .expect(201);
    await agent.delete(`/api/categories/${pets.body.id}`).expect(409);
  });
});

describe('cuentas', () => {
  test('crear, editar y eliminar una cuenta sin movimientos', async () => {
    const { agent } = await signUp();
    const savings = await agent
      .post('/api/accounts')
      .send({ name: 'Ahorros', type: 'SAVINGS', initialBalance: 1000 })
      .expect(201);
    const edited = await agent
      .put(`/api/accounts/${savings.body.id}`)
      .send({ name: 'Fondo de emergencia', type: 'SAVINGS', initialBalance: 1500.255 })
      .expect(200);
    assert.equal(edited.body.initialBalance, 1500.26);
    await agent.delete(`/api/accounts/${savings.body.id}`).expect(204);
  });

  test('no se elimina una cuenta con movimientos', async () => {
    const { agent, data } = await signUp();
    await agent.post('/api/transactions').send(txPayload(data)).expect(201);
    const res = await agent.delete(`/api/accounts/${data.accounts[0].id}`).expect(409);
    assert.equal(res.body.error, 'La cuenta tiene movimientos');
  });
});

describe('presupuestos', () => {
  test('upsert y eliminación con monto 0', async () => {
    const { agent, data } = await signUp();
    const categoryId = data.categories.find((c) => c.name === 'Educación').id;
    const period = { categoryId, month: 0, year: 2030 };

    const first = await agent
      .put('/api/budgets')
      .send({ ...period, amount: 300 })
      .expect(200);
    const second = await agent
      .put('/api/budgets')
      .send({ ...period, amount: 450 })
      .expect(200);
    assert.equal(second.body.id, first.body.id, 'actualiza en lugar de duplicar');
    assert.equal(second.body.amount, 450);

    await agent
      .put('/api/budgets')
      .send({ ...period, amount: 0 })
      .expect(204);
    const { body: budgets } = await agent.get('/api/budgets').expect(200);
    assert.equal(budgets.filter((b) => b.year === 2030).length, 0);
  });
});

describe('perfil', () => {
  test('actualiza nombre y moneda', async () => {
    const { agent } = await signUp();
    const res = await agent
      .put('/api/profile')
      .send({
        name: 'Ana Pérez',
        currency: 'USD',
        exchange: { fromCurrency: 'COP', copPerUsd: 4000, source: 'manual' },
      })
      .expect(200);
    assert.equal(res.body.name, 'Ana Pérez');
    assert.equal(res.body.currency, 'USD');
    await agent.put('/api/profile').send({ name: 'Ana', currency: 'XYZ' }).expect(400);
  });

  test('cambio de contraseña', async () => {
    const { agent, email } = await signUp();
    const wrong = await agent
      .put('/api/profile/password')
      .send({ currentPassword: 'otra-clave', newPassword: 'nueva-clave' })
      .expect(400);
    assert.equal(wrong.body.error, 'La contraseña actual no es correcta');

    await agent
      .put('/api/profile/password')
      .send({ currentPassword: PASSWORD, newPassword: 'nueva-clave' })
      .expect(204);
    await request(app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(401);
    await request(app).post('/api/auth/login').send({ email, password: 'nueva-clave' }).expect(200);
  });
});

describe('eliminar la cuenta', () => {
  test('pide la contraseña y borra la cuenta con todos sus datos', async () => {
    const { agent, email, data } = await signUp();
    await agent.delete('/api/profile').send({ password: 'otra-clave' }).expect(400);
    await agent.delete('/api/profile').send({}).expect(400);

    const res = await agent.delete('/api/profile').send({ password: PASSWORD }).expect(204);
    assert.match(String(res.headers['set-cookie']), /fm_session=;/);
    await agent.get('/api/bootstrap').expect(401);
    await request(app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(401);
    assert.equal(await userRepository.findById(data.user.id), null);
  });

  test('el mismo correo puede volver a registrarse después', async () => {
    const { agent, email } = await signUp();
    await agent.delete('/api/profile').send({ password: PASSWORD }).expect(204);
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana', email, password: PASSWORD, acceptTerms: true })
      .expect(201);
  });
});

describe('datos', () => {
  test('reiniciar restaura el mes de ejemplo', async () => {
    const { agent, data } = await signUp();
    const { body: tx } = await agent.post('/api/transactions').send(txPayload(data)).expect(201);
    await agent.delete(`/api/transactions/${tx.id}`).expect(204);
    await agent.post('/api/data/reset').expect(204);
    const { body } = await agent.get('/api/bootstrap').expect(200);
    assert.equal(body.transactions.length, 17);
    assert.equal(body.categories.length, 9);
  });

  test('reiniciar usa los montos de la moneda del usuario', async () => {
    const { agent } = await signUp('Bob', { currency: 'USD' });
    await agent.post('/api/data/reset').expect(204);
    const { body } = await agent.get('/api/bootstrap').expect(200);
    assert.equal(body.transactions.find((t) => t.description === 'Sueldo del mes').amount, 4200);
  });
});
