import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { api } from '../public/assets/js/core/api.js';
import { store } from '../public/assets/js/core/store.js';
import { render } from '../public/assets/js/views/operaciones.js';

const { document, window } = parseHTML('<html><body><main></main></body></html>');
Object.assign(globalThis, {
  document,
  window,
  Node: window.Node,
  location: { hash: '#/operaciones' },
  requestAnimationFrame: () => 0,
});
// Los avisos no deben mantener el proceso de pruebas vivo varios segundos.
const originalTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, delay) => originalTimeout(fn, delay).unref();
after(() => {
  globalThis.setTimeout = originalTimeout;
});
const accounts = [
  { id: 1, name: 'Banco', initialBalance: 500, currentBalance: 500, projectedBalance: 900 },
  { id: 2, name: 'Efectivo', initialBalance: 0, currentBalance: 0, projectedBalance: 0 },
];
const categories = [{ id: 3, name: 'Otros', icon: 'x', color: '#112233' }];
let calls = [],
  refreshes = 0;
api.get = async (path) =>
  path.startsWith('/bootstrap')
    ? { user: { currency: 'COP' }, accounts, categories, budgets: [], transactions: [] }
    : path.startsWith('/transactions/page')
      ? { items: [], nextCursor: null }
      : { accounts, operations: [], schedules: [] };
await store.load();
store.load = async () => {
  refreshes++;
};
api.post = async (path, body) => {
  calls.push({ path, body });
  return path.endsWith('/preview')
    ? { digest: 'a'.repeat(64), currency: 'COP', accounts: 2, transactions: 0, budgets: 0, operations: 0, schedules: 0 }
    : {};
};
const root = document.querySelector('main');
const section = (name) => [...root.querySelectorAll('section')].find((s) => s.querySelector('h3').textContent === name);
const control = (form, label) =>
  form.querySelector(
    `#${[...form.querySelectorAll('label')].find((l) => l.textContent === label).htmlFor || [...form.querySelectorAll('label')].find((l) => l.textContent === label).getAttribute('for')}`,
  );
const submit = async (form) => {
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await nextTurn();
};
async function reset() {
  calls = [];
  render(root);
  await nextTurn();
}

test('transferencia usa dos cuentas y conserva UUID para reintentos', async () => {
  await reset();
  const form = section('Transferencias').querySelector('form');
  control(form, 'Monto').value = '100';
  control(form, 'Comisión (gasto real)').value = '2';
  await submit(form);
  await submit(form);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].path, calls[1].path);
  assert.equal(calls[0].body.fromAccountId, 1);
  assert.equal(calls[0].body.toAccountId, 2);
  assert.equal(calls[0].body.amount, 100);
  assert.equal(calls[0].body.fee, 2);
  assert.ok(refreshes >= 2);
});

test('conciliación requiere confirmación y envía el saldo esperado de la vista', async () => {
  await reset();
  const form = section('Conciliar saldos').querySelector('form');
  control(form, 'Saldo real observado').value = '503';
  control(form, 'Motivo de la diferencia').value = 'Recuento';
  await submit(form);
  assert.equal(calls.length, 0);
  [...document.querySelectorAll('.modal-card button')].find((b) => b.textContent === 'Registrar ajuste').click();
  await nextTurn();
  assert.equal(calls[0].body.expectedBalance, 500);
  assert.equal(calls[0].body.actualBalance, 503);
});

test('respaldo muestra vista previa, confirma y restaura el archivo revisado', async () => {
  await reset();
  const form = section('Respaldos y restauración').querySelector('form');
  const file = form.querySelector('input[type=file]');
  const data = { version: 2, currency: 'COP' };
  Object.defineProperty(file, 'files', {
    value: [{ size: 100, text: async () => JSON.stringify(data) }],
    configurable: true,
  });
  file.dispatchEvent(new window.Event('change'));
  await nextTurn();
  assert.ok(form.textContent.includes('Se reemplazarán tus datos activos'));
  control(form, 'Tu contraseña para confirmar').value = 'secret123';
  await submit(form);
  assert.equal(calls.length, 1);
  [...document.querySelectorAll('.modal-card button')].find((b) => b.textContent === 'Restaurar').click();
  await nextTurn();
  assert.equal(calls[1].path, '/finance/backup/restore');
  assert.deepEqual(calls[1].body.backup, data);
  assert.equal(calls[1].body.digest, 'a'.repeat(64));
  assert.equal(control(form, 'Tu contraseña para confirmar').value, '');
});

for (const failure of [false, true]) {
  test(`una respuesta anterior ${failure ? 'fallida' : 'correcta'} no sustituye la vista más reciente`, async () => {
    const originalGet = api.get;
    const pending = [];
    api.get = () => new Promise((resolve, reject) => pending.push({ resolve, reject }));
    try {
      render(root);
      render(root);
      pending[1].resolve({
        accounts: accounts.map((a) => ({ ...a, currentBalance: 777 })),
        operations: [],
        schedules: [],
      });
      await nextTurn();
      const latest = root.textContent;
      if (failure) pending[0].reject(Error('Respuesta anterior'));
      else pending[0].resolve({ accounts, operations: [], schedules: [] });
      await nextTurn();
      assert.equal(root.textContent, latest);
    } finally {
      api.get = originalGet;
    }
  });
}
