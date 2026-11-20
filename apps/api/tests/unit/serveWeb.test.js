require('../helpers');
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const request = require('supertest');
const createApp = require('../../src/app');
const { closePool } = require('../../src/db/pool');
const root = path.resolve(__dirname, '../../../web/public');
const app = createApp({ serveWeb: true, webRoot: root });
after(() => closePool());
test('servicio unificado entrega web, módulos, gráficos y API desde el mismo origen', async () => {
  const { text, headers } = await request(app).get('/').expect(200).expect('Content-Type', /html/);
  assert.match(text, /FlowMoney/);
  assert.equal(headers['cache-control'], 'no-cache');
  for (const file of [
    '/login.html',
    '/app.html',
    '/assets/css/app.css',
    '/assets/js/pages/app.js',
    '/assets/vendor/three/three.module.min.js',
  ])
    await request(app).get(file).expect(200);
  const health = await request(app).get('/api/health').expect(200);
  assert.deepEqual(health.body, { ok: true });
  assert.equal(health.headers['cache-control'], 'no-store');
});
test('CSP conserva estilos del panel, fuentes y scripts propios sin permitir scripts inline', async () => {
  const { headers } = await request(app).get('/app.html').expect(200);
  const csp = headers['content-security-policy'];
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /script-src [^;]*unsafe-inline/);
  assert.match(csp, /style-src 'self' 'unsafe-inline' https:\/\/fonts.googleapis.com/);
  assert.match(csp, /font-src 'self' https:\/\/fonts.gstatic.com/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(headers['x-frame-options'], 'DENY');
  assert.ok(headers['permissions-policy'].includes('camera=()'));
});
test('archivos privados y rutas desconocidas no se convierten en el HTML del panel', async () => {
  for (const file of ['/package.json', '/.env', '/src/server.js', '/no-existe', '/assets/no-existe.js'])
    await request(app).get(file).expect(404);
  await request(app).get('/api/bootstrap').expect(401);
});
test('API separada no publica la web y una carpeta inválida falla antes de escuchar', async () => {
  await request(createApp({ serveWeb: false }))
    .get('/')
    .expect(404);
  assert.throws(() => createApp({ serveWeb: true, webRoot: path.join(root, 'missing') }), /WEB_ROOT/);
});
