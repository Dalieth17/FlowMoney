const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const load = (env) =>
  spawnSync(process.execPath, ['-e', `require(${JSON.stringify(path.resolve(__dirname, '../../src/config'))})`], {
    env: { ...process.env, NODE_ENV: 'production', DB_PASSWORD: '', COOKIE_SECURE: '', TRUST_PROXY: '0', ...env },
    encoding: 'utf8',
  });

test('producción rechaza contraseña de ejemplo y cookie insegura', () => {
  assert.notEqual(load({ DB_PASSWORD: 'cambia-esta-clave', COOKIE_SECURE: 'true' }).status, 0);
  assert.notEqual(load({ DB_PASSWORD: 'test-only-strong-credential' }).status, 0);
  assert.equal(load({ DB_PASSWORD: 'test-only-strong-credential', COOKIE_SECURE: 'true' }).status, 0);
});

test('el número de proxies debe ser explícito y numérico', () => {
  assert.notEqual(load({ NODE_ENV: 'test', TRUST_PROXY: 'true' }).status, 0);
  assert.equal(load({ NODE_ENV: 'test', TRUST_PROXY: '1' }).status, 0);
});

test('recuperación exige origen público HTTPS en producción y sin credenciales ni rutas', () => {
  const production = {
    DB_PASSWORD: 'test-only-strong-credential',
    COOKIE_SECURE: 'true',
    SMTP_HOST: 'smtp.example.test',
  };
  assert.notEqual(load({ ...production, PUBLIC_APP_URL: '' }).status, 0);
  assert.notEqual(load({ ...production, PUBLIC_APP_URL: 'http://example.test' }).status, 0);
  assert.equal(load({ ...production, PUBLIC_APP_URL: 'https://example.test' }).status, 0);
  for (const PUBLIC_APP_URL of [
    'https://user:password@example.test',
    'https://example.test/path',
    'https://example.test/?token=x',
    'https://example.test/#token',
  ])
    assert.notEqual(load({ ...production, PUBLIC_APP_URL }).status, 0);
});
