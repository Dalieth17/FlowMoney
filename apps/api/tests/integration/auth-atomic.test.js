require('../helpers');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../src/app')();
const { uniqueEmail } = require('../helpers');
const { waitForDatabase, runMigrations } = require('../../src/db/migrate');
const { closePool } = require('../../src/db/pool');
const users = require('../../src/repositories/userRepository');
const sessions = require('../../src/repositories/sessionRepository');
const profile = require('../../src/services/profileService');
const { verifyPassword } = require('../../src/utils/password');
before(async () => {
  await waitForDatabase();
  await runMigrations();
});
after(() => closePool());
const register = async () => {
  const agent = request.agent(app),
    email = uniqueEmail('atomic');
  const { body } = await agent
    .post('/api/auth/register')
    .send({ name: 'Atomic', email, password: 'secret123', acceptTerms: true })
    .expect(201);
  return { agent, email, id: body.user.id };
};

for (const legacy of [false, true])
  test(`login no admite contraseña revocada ni sobrescribe la nueva (${legacy ? 'bcrypt' : 'scrypt'})`, async () => {
    const u = await register();
    if (legacy) await users.updatePassword(u.id, await bcrypt.hash('secret123', 4));
    const original = users.findCredentialsByEmail;
    users.findCredentialsByEmail = async (...args) => {
      const result = await original(...args);
      await profile.changePassword(u.id, { currentPassword: 'secret123', newPassword: 'new-secret123' });
      return result;
    };
    try {
      const failed = await request(app)
        .post('/api/auth/login')
        .send({ email: u.email, password: 'secret123' })
        .expect(401);
      assert.equal(failed.headers['set-cookie'], undefined);
    } finally {
      users.findCredentialsByEmail = original;
    }
    assert.equal((await verifyPassword('new-secret123', await users.findPasswordHash(u.id))).valid, true);
    await u.agent.get('/api/auth/me').expect(401);
    await request(app).post('/api/auth/login').send({ email: u.email, password: 'new-secret123' }).expect(200);
  });

test('dos logins concurrentes migran bcrypt y conservan ambas sesiones válidas', async () => {
  const u = await register();
  await users.updatePassword(u.id, await bcrypt.hash('secret123', 4));
  const agents = [request.agent(app), request.agent(app)];
  const responses = await Promise.all(
    agents.map((agent) => agent.post('/api/auth/login').send({ email: u.email, password: 'secret123' })),
  );
  assert.deepEqual(
    responses.map((r) => r.status),
    [200, 200],
  );
  assert.match(await users.findPasswordHash(u.id), /^scrypt\$/);
  for (const agent of agents) await agent.get('/api/auth/me').expect(200);
});

test('registros diferentes concurrentes crean cuentas y sesiones completas', async () => {
  const responses = await Promise.all(
    Array.from({ length: 4 }, () =>
      request(app)
        .post('/api/auth/register')
        .send({ name: 'Concurrente', email: uniqueEmail('parallel'), password: 'secret123', acceptTerms: true }),
    ),
  );
  assert.deepEqual(
    responses.map((r) => r.status),
    [201, 201, 201, 201],
  );
});

test('si falla crear la sesión del registro, no queda una cuenta creada a medias ni se envía cookie', async () => {
  const email = uniqueEmail('rollback'),
    original = sessions.create;
  sessions.create = async () => {
    throw Error('Fallo de sesión simulado');
  };
  try {
    const failed = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Atomic', email, password: 'secret123', acceptTerms: true })
      .expect(500);
    assert.equal(failed.headers['set-cookie'], undefined);
  } finally {
    sessions.create = original;
  }
  assert.equal(await users.existsByEmail(email), false);
});

test('si falla renovar la sesión, el cambio de contraseña y la revocación también hacen rollback', async () => {
  const u = await register(),
    oldHash = await users.findPasswordHash(u.id),
    original = sessions.create;
  sessions.create = async () => {
    throw Error('Fallo de sesión simulado');
  };
  try {
    const failed = await u.agent
      .put('/api/profile/password')
      .send({ currentPassword: 'secret123', newPassword: 'new-secret123' })
      .expect(500);
    assert.equal(failed.headers['set-cookie'], undefined);
  } finally {
    sessions.create = original;
  }
  assert.equal(await users.findPasswordHash(u.id), oldHash);
  await u.agent.get('/api/auth/me').expect(200);
});
