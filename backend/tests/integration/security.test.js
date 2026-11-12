// Regresiones de los hallazgos de QA (sesiones, contraseñas largas, concurrencia, montos).
require('../helpers');
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { uniqueEmail } = require('../helpers');
const createApp = require('../../src/app');
const { waitForDatabase, runMigrations } = require('../../src/db/migrate');
const { pool, closePool } = require('../../src/db/pool');

const app = createApp();
const PASSWORD = 'secret123';

before(async () => {
  await waitForDatabase({ retries: 15, delayMs: 1000 });
  await runMigrations();
});
after(() => closePool());

/** Registra un usuario y devuelve su cookie de sesión tal cual (como la copiaría un atacante). */
async function register(password = PASSWORD) {
  const email = uniqueEmail('sec');
  const res = await request(app).post('/api/auth/register').send({ name: 'Sec', email, password }).expect(201);
  return { email, cookie: res.headers['set-cookie'][0].split(';')[0], userId: res.body.user.id };
}

async function login(email, password = PASSWORD) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return { status: res.status, cookie: res.headers['set-cookie']?.[0]?.split(';')[0] };
}

const bootstrapWith = (cookie) => request(app).get('/api/bootstrap').set('Cookie', cookie);

describe('QA #1 — revocación de sesiones en el servidor', () => {
  test('tras cerrar sesión, una copia de la cookie ya no sirve', async () => {
    const { cookie } = await register();
    await bootstrapWith(cookie).expect(200);
    await request(app).post('/api/auth/logout').set('Cookie', cookie).expect(204);
    await bootstrapWith(cookie).expect(401);
  });

  test('cambiar la contraseña revoca todas las sesiones y renueva la actual', async () => {
    const { email, cookie: phone } = await register();
    const { cookie: laptop } = await login(email);

    const res = await request(app)
      .put('/api/profile/password')
      .set('Cookie', phone)
      .send({ currentPassword: PASSWORD, newPassword: 'otra-clave-segura' })
      .expect(204);
    const renewed = res.headers['set-cookie'][0].split(';')[0];

    await bootstrapWith(laptop).expect(401); // otro dispositivo: fuera
    await bootstrapWith(phone).expect(401); // la cookie anterior del mismo dispositivo: fuera
    await bootstrapWith(renewed).expect(200); // quien cambió la clave sigue dentro
  });

  test('la base de datos no guarda el token en claro', async () => {
    const { cookie, userId } = await register();
    const token = decodeURIComponent(cookie.split('=')[1]);
    const [rows] = await pool.query('SELECT token_hash FROM sessions WHERE user_id = ?', [userId]);
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].token_hash, token);
  });
});

describe('QA #2 — contraseñas de más de 72 bytes', () => {
  test('dos contraseñas con los mismos primeros 72 bytes no son equivalentes', async () => {
    const prefix = 'a'.repeat(72);
    const { email } = await register(`${prefix}-real`);
    assert.equal((await login(email, `${prefix}-otra`)).status, 401);
    assert.equal((await login(email, `${prefix}-real`)).status, 200);
  });

  test('se aceptan frases largas con caracteres multibyte', async () => {
    const passphrase = 'ñandú-año-'.repeat(12); // 120 caracteres, más de 72 bytes en UTF-8
    const { email } = await register(passphrase);
    assert.equal((await login(email, passphrase)).status, 200);
    assert.equal((await login(email, passphrase.slice(0, -1))).status, 401);
  });
});

describe('QA #2 — migración de hashes bcrypt antiguos', () => {
  async function legacyUser(password) {
    const email = uniqueEmail('legacy');
    const [r] = await pool.query('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [
      'Legacy',
      email,
      bcrypt.hashSync(password, 4),
    ]);
    return { email, id: r.insertId };
  }

  test('un usuario con hash bcrypt entra y su hash se renueva a scrypt', async () => {
    const { email, id } = await legacyUser(PASSWORD);
    assert.equal((await login(email)).status, 200);
    const [[row]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [id]);
    assert.match(row.password_hash, /^scrypt\$/);
    assert.equal((await login(email)).status, 200, 'sigue entrando con el hash nuevo');
    assert.equal((await login(email, 'incorrecta')).status, 401);
  });

  test('con un hash bcrypt, una entrada de más de 72 bytes se rechaza', async () => {
    const { email } = await legacyUser('a'.repeat(72));
    assert.equal((await login(email, `${'a'.repeat(72)}-extra`)).status, 401);
    assert.equal((await login(email, 'a'.repeat(72))).status, 200);
  });
});

describe('QA #3 — borrados concurrentes de cuentas', () => {
  test('dos borrados simultáneos nunca dejan al usuario sin cuentas', async () => {
    for (let round = 0; round < 5; round++) {
      const { cookie, userId } = await register();
      await pool.query('DELETE FROM transactions WHERE user_id = ?', [userId]);
      const { body } = await bootstrapWith(cookie).expect(200);
      assert.equal(body.accounts.length, 2);

      const results = await Promise.all(
        body.accounts.map((a) => request(app).delete(`/api/accounts/${a.id}`).set('Cookie', cookie)),
      );
      const statuses = results.map((r) => r.status).sort();
      assert.deepEqual(statuses, [204, 409], `ronda ${round}: ${statuses}`);
      const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM accounts WHERE user_id = ?', [userId]);
      assert.equal(Number(n), 1, `ronda ${round}: quedaron ${n} cuentas`);
    }
  });
});

describe('QA #4 — montos positivos que se redondeaban a cero', () => {
  test('un límite de 0.004 se rechaza y no borra el presupuesto existente', async () => {
    const { cookie } = await register();
    const { body } = await bootstrapWith(cookie).expect(200);
    const budget = body.budgets[0];
    const period = { categoryId: budget.categoryId, month: budget.month, year: budget.year };

    const res = await request(app)
      .put('/api/budgets')
      .set('Cookie', cookie)
      .send({ ...period, amount: 0.004 });
    assert.equal(res.status, 400);
    const { body: after } = await bootstrapWith(cookie).expect(200);
    assert.equal(after.budgets.find((b) => b.categoryId === budget.categoryId).amount, budget.amount);
  });

  test('un movimiento de 0.001 se rechaza en lugar de guardarse en cero', async () => {
    const { cookie } = await register();
    const { body } = await bootstrapWith(cookie).expect(200);
    const res = await request(app).post('/api/transactions').set('Cookie', cookie).send({
      description: 'Céntimo',
      amount: 0.001,
      type: 'EXPENSE',
      categoryId: body.categories[0].id,
      date: Date.now(),
    });
    assert.equal(res.status, 400);
  });
});
