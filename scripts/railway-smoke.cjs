// Se ejecuta dentro de la imagen de producción en CI, con una base MySQL desechable.
const assert = require('node:assert/strict');
const base = `http://127.0.0.1:${process.env.PORT || 3000}`;
const send = (url, options = {}) => fetch(base + url, { ...options, signal: AbortSignal.timeout(10000) });
(async () => {
  const home = await send('/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /FlowMoney/);
  assert.match(home.headers.get('content-security-policy'), /script-src 'self'/);
  for (const url of [
    '/login.html',
    '/app.html',
    '/assets/css/app.css',
    '/assets/js/pages/app.js',
    '/assets/vendor/three/three.module.min.js',
  ])
    assert.equal((await send(url)).status, 200, url);
  const health = await send('/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });
  for (const url of ['/src/server.js', '/.env', '/package.json']) assert.equal((await send(url)).status, 404, url);
  const password = 'only-ci-smoke-password';
  const signup = await send('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' },
    body: JSON.stringify({
      name: 'Railway CI',
      email: `railway-ci.${Date.now()}@flowmoney.test`,
      password,
      acceptTerms: true,
    }),
  });
  assert.equal(signup.status, 201);
  const cookie = signup.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  const session = cookie.split(';')[0];
  const bootstrap = await send('/api/bootstrap?transactions=none', { headers: { Cookie: session } });
  assert.equal(bootstrap.status, 200);
  const data = await bootstrap.json();
  assert.equal(data.user.name, 'Railway CI');
  assert.ok(data.accounts.length > 0);
  const deleted = await send('/api/profile', {
    method: 'DELETE',
    headers: { Cookie: session, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  assert.equal(deleted.status, 204);
  console.log(
    'Servicio Railway OK: puerto dinámico, web, módulos, API, MySQL, migraciones y sesión con cookie segura.',
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
