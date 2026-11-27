require('../helpers');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { normalize } = require('../../src/services/backupService');

function sample() {
  const tx = {
    id: 1,
    amount: 10,
    description: 'Mensual',
    type: 'EXPENSE',
    date: Date.UTC(2026, 0, 1, 17),
    categoryId: 1,
    accountId: 1,
    note: '',
    kind: 'NORMAL',
    operationId: null,
  };
  return {
    version: 2,
    currency: 'COP',
    accounts: [{ id: 1, name: 'Banco', type: 'BANK', initialBalance: 0 }],
    categories: [{ id: 1, name: 'Otros', icon: 'x', color: '#112233', isDefault: false }],
    transactions: [tx],
    budgets: [],
    operations: [],
    schedules: [
      {
        id: 1,
        data: {
          transaction: tx,
          startDate: '2026-01-01',
          endDate: null,
          dayOfMonth: 1,
          active: true,
          creationKey: randomUUID(),
        },
      },
    ],
    occurrences: [{ scheduleId: 1, period: '2026-01', transactionId: 1 }],
  };
}
test('un movimiento no puede justificar dos períodos recurrentes', () => {
  const data = sample();
  data.occurrences.push({ scheduleId: 1, period: '2026-02', transactionId: 1 });
  assert.throws(() => normalize(data), /Ocurrencia/);
});
test('las claves de creación de recurrencias no pueden repetirse en un respaldo', () => {
  const data = sample();
  data.schedules.push({ ...structuredClone(data.schedules[0]), id: 2 });
  assert.throws(() => normalize(data), /recurrencias duplicadas/);
});
test('períodos de movimientos borrados conservan su marca sin exigir una transacción', () => {
  const data = sample();
  data.transactions = [];
  data.occurrences[0].transactionId = null;
  assert.equal(normalize(data).occurrences.length, 1);
});
test('rechaza presupuestos de monto cero que desaparecerían al restaurar', () => {
  const data = sample();
  data.budgets = [{ id: 1, categoryId: 1, amount: 0, month: 0, year: 2026 }];
  assert.throws(() => normalize(data), /presupuesto/);
});

test('valida un respaldo de 20.000 movimientos y sus referencias', () => {
  const data = sample();
  data.schedules = [];
  data.occurrences = [];
  data.accounts = Array.from({ length: 1000 }, (_, i) => ({ ...data.accounts[0], id: i + 1 }));
  data.categories = Array.from({ length: 1000 }, (_, i) => ({ ...data.categories[0], id: i + 1 }));
  const base = data.transactions[0];
  data.transactions = Array.from({ length: 20000 }, (_, i) => ({
    ...base,
    id: i + 1,
    accountId: (i % 1000) + 1,
    categoryId: (i % 1000) + 1,
  }));
  assert.equal(normalize(data).transactions.length, 20000);
});

test('el respaldo de 20 MiB pasa por exportación, vista previa y restauración HTTP', async (t) => {
  const request = require('supertest');
  const app = require('../../src/app')();
  const { pool } = require('../../src/db/pool');
  const sessions = require('../../src/repositories/sessionRepository');
  const { hashPassword } = require('../../src/utils/password');
  const limit = 20 * 1024 * 1024;
  const password = '\u0001'.repeat(128); // Seis bytes JSON por carácter.
  const user = { id: 1, name: 'Ana', currency: 'COP', password_hash: await hashPassword(password) };
  const tables = {
    users: [user],
    accounts: [{ id: 1, name: 'Banco', type: 'BANK', initial_balance: 0 }],
    categories: [{ id: 1, name: 'Otros', color: '#112233', icon: 'x', is_default: true }],
    transactions: [],
  };
  let inserted = 0;
  // Solo sustituimos la persistencia. Express, los repositorios y el servicio usan sus serializadores reales.
  t.mock.method(sessions, 'findActiveUserId', async () => user.id);
  t.mock.method(pool, 'getConnection', async () => ({
    beginTransaction() {},
    commit() {},
    rollback() {},
    release() {},
    async query(sql) {
      if (sql.startsWith('SELECT')) return [tables[/\bFROM (\w+)/.exec(sql)[1]] ?? []];
      if (sql.startsWith('INSERT INTO transactions')) inserted++;
      return [{ insertId: inserted || 1 }];
    },
  }));
  const agent = request(app);
  const cookie = 'fm_session=' + 'x'.repeat(43);
  const endpoint = '/api/finance/backup';
  const get = () => agent.get(endpoint).set('Cookie', cookie);
  const post = (path, data) =>
    agent
      .post(endpoint + path)
      .set('Cookie', cookie)
      .send(data);

  const row = {
    description: '月'.repeat(120),
    amount: 1,
    type: 'EXPENSE',
    category_id: 1,
    account_id: 1,
    date: Date.UTC(2026, 0, 1),
    note: '',
    kind: 'NORMAL',
    operation_id: null,
  };
  tables.transactions = Array.from({ length: 20000 }, (_, i) => ({ ...row, id: i + 1 }));
  let remaining = limit - Buffer.byteLength((await get().expect(200)).text);
  for (const tx of tables.transactions) {
    const chars = Math.min(200, Math.floor(remaining / 3));
    tx.note = '月'.repeat(chars);
    remaining -= 3 * chars;
    if (remaining < 3 && chars + remaining <= 200) {
      tx.note += 'a'.repeat(remaining);
      remaining = 0;
      break;
    }
  }
  assert.equal(remaining, 0);
  const exported = await get().expect(200);
  assert.equal(Buffer.byteLength(exported.text), limit);
  const backup = exported.body;
  const { body: preview } = await post('/preview', backup).expect(200);
  assert.equal(preview.transactions, 20000);
  const envelope = { backup, digest: preview.digest, password };
  assert.ok(Buffer.byteLength(JSON.stringify(envelope)) > limit);
  await post('/restore', envelope).expect(200, { restored: true, transactions: 20000 });
  assert.equal(inserted, 20000);

  // Un campo extra fuera del respaldo tampoco puede desbordar el límite HTTP.
  await post('/restore', { ...envelope, extra: 'a'.repeat(1024) }).expect(413);

  // Un byte más no puede aprovechar el espacio reservado a la contraseña.
  tables.transactions.at(-1).note += 'a';
  backup.transactions.at(-1).note += 'a';
  await get().expect(413);
  await post('/preview', backup).expect(413);
  await post('/restore', envelope).expect(413);
  assert.equal(inserted, 20000);
});
