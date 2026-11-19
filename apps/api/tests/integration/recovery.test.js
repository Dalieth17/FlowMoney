require('../helpers');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { createHash } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const request = require('supertest');
const { uniqueEmail } = require('../helpers');
let smtp,
  app,
  pool,
  mail,
  closePool,
  failDelivery = false;
const deliveries = [];
const sockets = new Set();
before(async () => {
  // Buzón aislado de pruebas: nunca reenvía correo a internet.
  smtp = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.setEncoding('utf8');
    socket.write('220 localhost test SMTP\r\n');
    let buffer = '',
      data = null;
    socket.on('data', (chunk) => {
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (data !== null) {
          if (line !== '.') {
            data += line + '\r\n';
            continue;
          }
          deliveries.push(data);
          data = null;
          socket.write('250 Accepted\r\n');
        } else if (/^DATA$/i.test(line)) {
          if (failDelivery) socket.write('550 Delivery rejected by test\r\n');
          else {
            data = '';
            socket.write('354 Send data\r\n');
          }
        } else if (/^QUIT$/i.test(line)) socket.end('221 Bye\r\n');
        else socket.write('250 localhost\r\n');
      }
    });
  });
  await new Promise((resolve) => smtp.listen(0, '127.0.0.1', resolve));
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = String(smtp.address().port);
  process.env.PUBLIC_APP_URL = 'http://localhost:8080';
  app = require('../../src/app')();
  ({ pool, closePool } = require('../../src/db/pool'));
  mail = require('../../src/services/mailService');
  const migrations = require('../../src/db/migrate');
  await migrations.waitForDatabase();
  await migrations.runMigrations();
});
after(async () => {
  mail?.close();
  for (const socket of sockets) socket.destroy();
  if (smtp) await new Promise((resolve) => smtp.close(resolve));
  if (closePool) await closePool();
});
async function user() {
  const agent = request.agent(app),
    email = uniqueEmail('recover');
  const { body } = await agent
    .post('/api/auth/register')
    .send({ name: 'Recuperar', email, password: 'old-secret', acceptTerms: true })
    .expect(201);
  return { agent, email, id: body.user.id };
}
async function until(check) {
  for (let i = 0; i < 200; i++) {
    if (await check()) return;
    await delay(10);
  }
  assert.fail('La operación asíncrona no terminó');
}
async function issue(u) {
  const count = deliveries.length;
  const response = await request(app).post('/api/auth/forgot-password').send({ email: u.email }).expect(202);
  await until(() => deliveries.length > count);
  const text = deliveries
    .at(-1)
    .replace(/=\r\n/g, '')
    .replace(/=([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  assert.ok(text.includes(u.email));
  const token = text.match(/http:\/\/localhost:8080\/recover\.html#token=([\w-]{43})/)?.[1];
  assert.ok(token, 'El correo debe contener un enlace con un token aleatorio');
  assert.ok(!JSON.stringify(response.body).includes(token));
  return { token, response };
}
test('correo SMTP, hash en BD, respuesta genérica y enfriamiento entre solicitudes', async () => {
  const u = await user(),
    { token, response } = await issue(u);
  const unknown = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: uniqueEmail('unknown') })
    .expect(202);
  assert.deepEqual(response.body, unknown.body);
  const count = deliveries.length;
  await request(app).post('/api/auth/forgot-password').send({ email: u.email }).expect(202);
  const [[row]] = await pool.query(
    'SELECT token_hash, TIMESTAMPDIFF(MINUTE,created_at,expires_at) ttl FROM password_resets WHERE user_id=?',
    [u.id],
  );
  assert.equal(row.token_hash, createHash('sha256').update(token).digest('hex'));
  assert.equal(row.ttl, 30);
  assert.equal(deliveries.length, count);
});
test('consumo concurrente usa el enlace una sola vez y revoca todas las sesiones', async () => {
  const u = await user(),
    { token } = await issue(u);
  const another = request.agent(app);
  await another.post('/api/auth/login').send({ email: u.email, password: 'old-secret' }).expect(200);
  const results = await Promise.all(
    [1, 2].map(() => request(app).post('/api/auth/reset-password').send({ token, password: 'new-secret' })),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
  await u.agent.get('/api/auth/me').expect(401);
  await another.get('/api/auth/me').expect(401);
  await request(app).post('/api/auth/login').send({ email: u.email, password: 'old-secret' }).expect(401);
  await request(app).post('/api/auth/login').send({ email: u.email, password: 'new-secret' }).expect(200);
});
test('caducidad, reemplazo de enlaces y cambio habitual de contraseña', async () => {
  const u = await user(),
    first = await issue(u);
  await pool.query(
    'UPDATE password_resets SET created_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 2 MINUTE) WHERE user_id=?',
    [u.id],
  );
  const second = await issue(u);
  assert.notEqual(first.token, second.token);
  await request(app).post('/api/auth/reset-password').send({ token: first.token, password: 'new-secret' }).expect(400);
  await pool.query('UPDATE password_resets SET expires_at=UTC_TIMESTAMP() WHERE user_id=?', [u.id]);
  await request(app).post('/api/auth/reset-password').send({ token: second.token, password: 'new-secret' }).expect(400);
  await pool.query('DELETE FROM password_resets WHERE user_id=?', [u.id]);
  const third = await issue(u);
  await u.agent
    .put('/api/profile/password')
    .send({ currentPassword: 'old-secret', newPassword: 'profile-secret' })
    .expect(204);
  await request(app).post('/api/auth/reset-password').send({ token: third.token, password: 'new-secret' }).expect(400);
});
test('fallo SMTP conserva respuesta genérica e invalida el enlace no entregado', async () => {
  const u = await user();
  failDelivery = true;
  try {
    await request(app).post('/api/auth/forgot-password').send({ email: u.email }).expect(202);
    await until(async () => {
      const [rows] = await pool.query('SELECT user_id FROM password_resets WHERE user_id=?', [u.id]);
      return rows.length === 0;
    });
  } finally {
    failDelivery = false;
  }
  await issue(u);
});
test('validación pública rechaza correos, tokens y contraseñas inválidos', async () => {
  await request(app).post('/api/auth/forgot-password').send({ email: 'invalid' }).expect(400);
  await request(app).post('/api/auth/reset-password').send({ token: 'bad', password: 'secret123' }).expect(400);
  await request(app)
    .post('/api/auth/reset-password')
    .send({ token: 'a'.repeat(43), password: '123' })
    .expect(400);
});
