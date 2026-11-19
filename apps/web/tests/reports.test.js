import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { api } from '../public/assets/js/core/api.js';
import { store } from '../public/assets/js/core/store.js';
import { render } from '../public/assets/js/views/reportes.js';
import { render as accountsRender } from '../public/assets/js/views/cuentas.js';
const { document, window } = parseHTML('<html><body><main></main></body></html>');
Object.assign(globalThis, { document, window, Node: window.Node, location: { hash: '#/reportes' } });
Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
  configurable: true,
  get() {
    return this.querySelector('option[selected]')?.value ?? this.querySelector('option')?.value ?? '';
  },
  set(value) {
    for (const option of this.options) option.selected = option.value === value;
  },
});
const root = document.querySelector('main');
api.get = async (path) =>
  path.startsWith('/bootstrap')
    ? {
        user: { currency: 'COP' },
        accounts: [{ id: 7, name: 'Banco <personal>', type: 'BANK', initialBalance: 0 }],
        categories: [],
        transactions: [],
        budgets: [],
      }
    : { items: [], nextCursor: null };
await store.load();
const report = (expense = 12) => ({
  currency: 'COP',
  summary: { income: 100, expense, balance: 100 - expense, savingRate: 100 - expense },
  categories: [],
  history: [{ month: 0, year: 2025, income: 100, expense }],
  accounts: [{ accountId: 7, label: 'Banco <personal>', income: 100, expense }],
});
test('reportes solicita agregados, filtra por cuenta y habilita PDF tras cargar', async () => {
  const calls = [];
  api.get = async (path) => {
    calls.push(path);
    return report();
  };
  await render(root, { month: 0, year: 2025 });
  assert.equal(calls[0], '/reports/monthly?month=0&year=2025');
  assert.ok(root.textContent.includes('Actividad por cuenta'));
  assert.equal(root.querySelector('button').disabled, false);
  assert.equal(root.querySelector('personal'), null);
  const select = root.querySelector('select');
  select.value = '7';
  select.dispatchEvent(new window.Event('change'));
  await nextTurn();
  assert.equal(calls.at(-1), '/reports/monthly?month=0&year=2025&accountId=7');
});
test('cargar otro mes descarta respuestas y errores del mes anterior', async () => {
  for (const fail of [false, true]) {
    const pending = [];
    api.get = () => new Promise((resolve, reject) => pending.push({ resolve, reject }));
    const first = render(root, { month: 0, year: 2025 });
    const second = render(root, { month: 1, year: 2025 });
    assert.equal(root.querySelector('button').disabled, true);
    pending[1].resolve(report(20));
    await second;
    const text = root.textContent;
    if (fail) pending[0].reject(Error('Mes anterior'));
    else pending[0].resolve(report(99));
    await first;
    assert.equal(root.textContent, text);
  }
});
test('fallo del reporte permite reintentar y abandonar la vista no la sobrescribe', async () => {
  api.get = async () => {
    throw Error('Sin conexión');
  };
  await render(root, { month: 0, year: 2025 });
  assert.ok(root.textContent.includes('Reintentar'));
  assert.equal(root.querySelector('button').disabled, true);
  let resolve;
  api.get = () =>
    new Promise((done) => {
      resolve = done;
    });
  const pending = render(root, { month: 0, year: 2025 });
  globalThis.location.hash = '#/cuentas';
  root.textContent = 'Otra vista';
  resolve(report());
  await pending;
  assert.equal(root.textContent, 'Otra vista');
});
test('cuentas usa el saldo SQL aunque el histórico del navegador esté vacío', async () => {
  globalThis.location.hash = '#/cuentas';
  api.get = async (path) => {
    assert.equal(path, '/accounts/balances');
    return [
      {
        id: 7,
        name: 'Conciliada',
        type: 'BANK',
        initialBalance: 100,
        currentBalance: 123,
        projectedBalance: 200,
        count: 5,
      },
    ];
  };
  await accountsRender(root);
  assert.ok(root.textContent.includes('Conciliada'));
  assert.ok(root.textContent.includes('5 movimientos'));
  assert.ok(root.querySelector('.acc-balance').textContent.includes('123'));
});
