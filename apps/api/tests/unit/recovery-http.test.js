require('../helpers');
process.env.RECOVERY_RATE_LIMIT = '3';
process.env.SMTP_HOST = '';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app')();
const { closePool } = require('../../src/db/pool');
after(() => closePool());

test('sin SMTP informa indisponibilidad y el límite público protege ambos endpoints de recuperación', async () => {
  await request(app).post('/api/auth/forgot-password').send({ email: 'prueba@example.test' }).expect(503);
  await request(app).post('/api/auth/forgot-password').send({ email: 'invalid' }).expect(400);
  await request(app).post('/api/auth/reset-password').send({ token: 'invalid', password: 'secret123' }).expect(400);
  const limited = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'prueba@example.test' })
    .expect(429);
  assert.ok(Number(limited.headers['retry-after']) > 0);
  await request(app).post('/api/auth/login').send({ email: 'invalid' }).expect(400);
  await request(app).get('/api/health').expect(200);
});
