// Comportamiento HTTP que no necesita base de datos: salud, auth, validación, errores.
require('../helpers');
const { describe, test, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../../src/app');
const { closePool } = require('../../src/db/pool');

const app = createApp();
after(() => closePool());

describe('API sin base de datos', () => {
  test('GET /api/health responde ok', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true });
  });

  test('las rutas privadas exigen sesión', async () => {
    for (const path of ['/api/bootstrap', '/api/transactions', '/api/profile', '/api/auth/me']) {
      const res = await request(app).get(path);
      assert.equal(res.status, 401, path);
      assert.ok(res.body.error);
    }
  });

  test('una cookie con token falso se rechaza', async () => {
    const res = await request(app).get('/api/bootstrap').set('Cookie', 'fm_session=no.es.valido');
    assert.equal(res.status, 401);
  });

  test('valida el registro antes de tocar la base de datos', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'x', password: '1' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Escribe tu nombre');
  });

  test('JSON mal formado → 400', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'JSON no válido');
  });

  test('rutas fuera de /api → 404 JSON', async () => {
    const res = await request(app).get('/no-existe');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Ruta no encontrada');
  });

  test('envía cabeceras de seguridad (helmet)', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-powered-by'], undefined);
  });
});
