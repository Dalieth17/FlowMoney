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

test('tarjetas de cuenta envían el origen y destino seleccionados sin un select nativo', async () => {
  await reset();
  const form = section('Transferencias').querySelector('form');
  const pickers = [...form.querySelectorAll('fieldset.account-picker')];
  assert.equal(pickers.length, 2);
  assert.equal(pickers[0].querySelector('legend').textContent, 'Desde');
  const choose = (picker, value) => {
    const radio = [...picker.querySelectorAll('input[type=radio]')].find((r) => r.value === String(value));
    radio.checked = true;
    radio.dispatchEvent(new window.Event('change'));
  };
  choose(pickers[0], 2);
  choose(pickers[1], 1);
  control(form, 'Monto').value = '100';
  await submit(form);
  assert.equal(calls[0].body.fromAccountId, 2);
  assert.equal(calls[0].body.toAccountId, 1);
});
test('elegir la misma cuenta en ambas tarjetas no envía una transferencia', async () => {
  await reset();
  const form = section('Transferencias').querySelector('form');
  const pickers = form.querySelectorAll('fieldset.account-picker');
  pickers[1].value = pickers[0].value;
  control(form, 'Monto').value = '100';
  await submit(form);
  assert.equal(calls.length, 0);
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

test('Perfil y Operaciones descargan el respaldo en JSON compacto', async (t) => {
  const { render: renderProfile } = await import('../public/assets/js/views/perfil.js');
  await reset();
  const data = { version: 3, currency: 'COP', accounts };
  t.mock.method(api, 'get', async (path) => {
    assert.equal(path, '/finance/backup');
    return data;
  });
  const downloads = t.mock.method(URL, 'createObjectURL', () => 'blob:respaldo');
  const click = (label) => [...root.querySelectorAll('button')].find((b) => b.textContent === label).click();
  click('Descargar respaldo completo');
  await nextTurn();
  renderProfile(root);
  click('Exportar JSON');
  await nextTurn();
  assert.equal(downloads.mock.callCount(), 2);
  for (const call of downloads.mock.calls) {
    const [file] = call.arguments;
    assert.equal((await file.text()).replace(/^\uFEFF/, ''), JSON.stringify(data));
  }
});

test('previsualiza y restaura una descarga anterior cuya sangría y BOM superan 20 MiB', async () => {
  await reset();
  const form = section('Respaldos y restauración').querySelector('form');
  const file = form.querySelector('input[type=file]');
  const tx = {
    amount: 10,
    description: '月'.repeat(100),
    type: 'EXPENSE',
    date: Date.UTC(2026, 0, 1),
    categoryId: 1,
    accountId: 1,
    note: '月'.repeat(180),
    kind: 'NORMAL',
    operationId: null,
  };
  const data = {
    version: 2,
    currency: 'COP',
    accounts: [{ id: 1, name: 'Banco', type: 'BANK', initialBalance: 0 }],
    categories: [{ id: 1, name: 'Otros', icon: 'x', color: '#112233', isDefault: false }],
    transactions: Array.from({ length: 20000 }, (_, i) => ({ id: i + 1, ...tx })),
    budgets: [],
    operations: [],
    schedules: [],
    occurrences: [],
  };
  const text = '\uFEFF' + JSON.stringify(data, null, 2);
  const size = Buffer.byteLength(text);
  assert.ok(size > 20 * 1024 * 1024);
  assert.ok(Buffer.byteLength(JSON.stringify(data)) <= 20 * 1024 * 1024);
  Object.defineProperty(file, 'files', {
    value: [{ size, text: async () => text }],
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

test('descarta un archivo demasiado grande antes de leerlo', async (t) => {
  await reset();
  const file = section('Respaldos y restauración').querySelector('input[type=file]');
  const read = t.mock.fn();
  Object.defineProperty(file, 'files', { value: [{ size: 40 * 1024 * 1024 + 1, text: read }] });
  file.dispatchEvent(new window.Event('change'));
  await nextTurn();
  assert.equal(read.mock.callCount(), 0);
  assert.equal(calls.length, 0);
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
