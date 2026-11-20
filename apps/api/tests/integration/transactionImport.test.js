require('../helpers');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { randomUUID } = require('node:crypto');
const { uniqueEmail } = require('../helpers');
const app = require('../../src/app')();
const { pool, closePool } = require('../../src/db/pool');
const { waitForDatabase, runMigrations } = require('../../src/db/migrate');
const txRepo = require('../../src/repositories/transactionRepository');
before(async () => {
  await waitForDatabase();
  await runMigrations();
});
after(() => closePool());
const encode = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
function csv(u, rows) {
  return [
    'Fecha,Descripción,Tipo,Categoría,Cuenta,Monto (COP),Nota,Clase,Operación',
    ...rows.map((row) =>
      [
        row.date ?? '2026-11-19',
        row.description ?? 'Compra CSV',
        row.type ?? 'Gasto',
        row.category ?? u.data.categories[0].name,
        row.account ?? u.data.accounts[0].name,
        row.amount ?? '-12.50',
        row.note ?? '',
        row.kind ?? 'NORMAL',
        row.operation ?? '',
      ]
        .map(encode)
        .join(','),
    ),
  ].join('\r\n');
}
async function user() {
  const agent = request.agent(app);
  const { body } = await agent
    .post('/api/auth/register')
    .send({ name: 'Importación', email: uniqueEmail('csv'), password: 'secret123', acceptTerms: true })
    .expect(201);
  await pool.query('DELETE FROM transactions WHERE user_id=?', [body.user.id]);
  const { body: data } = await agent.get('/api/bootstrap').expect(200);
  return { agent, id: body.user.id, data };
}
const preview = async (u, source) =>
  (await u.agent.post('/api/transactions/import/preview').send({ csv: source, currency: 'COP' }).expect(200)).body;
const commit = (u, source, p) =>
  u.agent.post('/api/transactions/import').send({ csv: source, currency: 'COP', digest: p.digest });
const list = async (u) => (await u.agent.get('/api/transactions').expect(200)).body;
test('vista previa no escribe; guarda multiplicidad, omite coincidencias/operaciones y registra historial', async () => {
  const u = await user();
  await u.agent
    .post('/api/transactions')
    .send({
      date: Date.parse('2026-11-20T04:59:59.999Z'),
      description: 'Compra CSV',
      type: 'EXPENSE',
      amount: 12.5,
      categoryId: u.data.categories[0].id,
      accountId: u.data.accounts[0].id,
      note: '',
    })
    .expect(201);
  const operation = randomUUID();
  const source = csv(u, [
    {},
    {},
    { description: 'Ingreso CSV', type: 'Ingreso', amount: '25', account: '' },
    ...['TRANSFER', 'ADJUSTMENT', 'NORMAL'].map((kind) => ({ kind, operation })),
  ]);
  const p = await preview(u, source);
  assert.deepEqual(p.summary, { new: 2, existing: 1, excluded: 3, errors: 0 });
  assert.equal((await list(u)).length, 1);
  const { body: saved } = await commit(u, source, p).expect(200);
  assert.deepEqual(saved, { imported: 2, skipped: 1, excluded: 3 });
  const transactions = await list(u);
  assert.equal(transactions.length, 3);
  for (const tx of transactions)
    assert.equal((await u.agent.get(`/api/transactions/${tx.id}/history`).expect(200)).body.length, 1);
  await commit(u, source, p).expect(409);
  const again = await preview(u, source);
  assert.deepEqual(again.summary, { new: 0, existing: 3, excluded: 3, errors: 0 });
  await commit(u, source, again).expect(200);
  assert.equal((await list(u)).length, 3);
});
test('dos confirmaciones concurrentes no duplican movimientos', async () => {
  const u = await user(),
    source = csv(u, [{}, {}]),
    p = await preview(u, source);
  const responses = await Promise.all([commit(u, source, p), commit(u, source, p)]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await list(u)).length, 2);
});
test('un error de fila bloquea todo el lote y una vista previa no autoriza contenido modificado', async () => {
  const u = await user(),
    source = csv(u, [{}, { description: 'Inválida', date: '2026-02-30' }]),
    p = await preview(u, source);
  assert.equal(p.valid, false);
  assert.equal(p.summary.errors, 1);
  await commit(u, source, p).expect(400);
  assert.equal((await list(u)).length, 0);
  const valid = csv(u, [{}]),
    q = await preview(u, valid);
  await commit(u, valid.replace('Compra CSV', 'Cambio no revisado'), q).expect(409);
  assert.equal((await list(u)).length, 0);
});
test('aislamiento, moneda y referencias resueltas en el momento de confirmar', async () => {
  const u = await user(),
    other = await user(),
    source = csv(u, [{}]),
    p = await preview(u, source);
  await other.agent
    .post('/api/transactions/import')
    .send({ csv: source, currency: 'COP', digest: p.digest })
    .expect(409);
  assert.equal((await list(other)).length, 0);
  await u.agent.post('/api/transactions/import/preview').send({ csv: source, currency: 'USD' }).expect(409);
  await u.agent
    .post('/api/transactions/import/preview')
    .send({ csv: source.replace('Monto (COP)', 'Monto (USD)'), currency: 'COP' })
    .expect(400);
  await u.agent
    .put(`/api/accounts/${u.data.accounts[0].id}`)
    .send({ ...u.data.accounts[0], name: 'Nombre cambiado' })
    .expect(200);
  await commit(u, source, p).expect(400);
  assert.equal((await list(u)).length, 0);
  await request(app).post('/api/transactions/import/preview').send({ csv: source, currency: 'COP' }).expect(401);
});
test('fallo intermedio hace rollback de movimientos y de su historial', async () => {
  const u = await user(),
    source = csv(u, [{ description: 'Uno' }, { description: 'Dos' }]),
    p = await preview(u, source);
  const original = txRepo.create;
  let n = 0;
  txRepo.create = async (...args) => {
    if (++n === 2) throw Error('Fallo CSV de prueba');
    return original(...args);
  };
  try {
    await commit(u, source, p).expect(500);
  } finally {
    txRepo.create = original;
  }
  assert.equal((await list(u)).length, 0);
  const [[row]] = await pool.query('SELECT COUNT(*) count FROM transaction_history WHERE user_id=?', [u.id]);
  assert.equal(row.count, 0);
  await commit(u, source, p).expect(200);
});
test('CSV mayor de 100 KB usa el límite de importación y rechaza más de 500 filas', async () => {
  const u = await user(),
    source = csv(
      u,
      Array.from({ length: 350 }, (_, i) => ({ description: `${i} ${'d'.repeat(110)}`, note: 'n'.repeat(190) })),
    );
  assert.ok(Buffer.byteLength(source) > 100 * 1024);
  assert.equal((await preview(u, source)).summary.new, 350);
  await u.agent
    .post('/api/transactions/import/preview')
    .send({ csv: csv(u, Array(501).fill({})), currency: 'COP' })
    .expect(400);
  await u.agent
    .post('/api/transactions/import/preview')
    .send({ csv: 'á'.repeat(140000), currency: 'COP' })
    .expect(400);
});
test('restaurar un respaldo con nuevos IDs conserva la detección de coincidencias', async () => {
  const u = await user(),
    source = csv(u, [{}]),
    p = await preview(u, source);
  await commit(u, source, p).expect(200);
  const { body: backup } = await u.agent.get('/api/finance/backup').expect(200);
  const { body: check } = await u.agent.post('/api/finance/backup/preview').send(backup).expect(200);
  await u.agent
    .post('/api/finance/backup/restore')
    .send({ backup, digest: check.digest, password: 'secret123' })
    .expect(200);
  const q = await preview(u, source);
  assert.equal(q.summary.new, 0);
  assert.equal(q.summary.existing, 1);
});
