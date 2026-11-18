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
