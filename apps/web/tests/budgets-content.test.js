import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { api } from '../public/assets/js/core/api.js';
import { store } from '../public/assets/js/core/store.js';
import { render } from '../public/assets/js/views/presupuestos.js';
const { document, window } = parseHTML('<html><body><main></main></body></html>');
Object.assign(globalThis, { document, window, Node: window.Node, requestAnimationFrame: () => 0 });
const timeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, delay) => timeout(fn, delay).unref();
after(() => {
  globalThis.setTimeout = timeout;
});
const root = document.querySelector('main'),
  period = { month: 10, year: 2026 };
const categories = [
  { id: 1, name: 'Salario', icon: 'x', color: '#123456' },
  { id: 2, name: 'Comida', icon: 'x', color: '#123456' },
  { id: 3, name: 'Transporte', icon: 'x', color: '#123456' },
];
const initial = () => ({
  user: { currency: 'COP' },
  accounts: [],
  categories,
  transactions: [],
  budgets: [
    { id: 1, categoryId: 1, month: 10, year: 2026, amount: 100 },
    { id: 2, categoryId: 2, month: 10, year: 2026, amount: 50 },
    { id: 3, categoryId: 1, month: 9, year: 2026, amount: 80 },
    { id: 4, categoryId: 3, month: 9, year: 2026, amount: 30 },
  ],
});
const transactions = [
  { id: 1, categoryId: 1, amount: 120, type: 'EXPENSE', date: Date.parse('2026-11-19T17:00:00Z') },
  { id: 2, categoryId: 2, amount: 10, type: 'EXPENSE', date: Date.parse('2026-11-30T17:00:00Z') },
  { id: 3, categoryId: 3, amount: 200, type: 'EXPENSE', date: Date.parse('2026-11-18T17:00:00Z') },
];
const serve = (data) => {
  api.get = async (path) =>
    path.startsWith('/bootstrap') ? structuredClone(data) : { items: transactions, nextCursor: null };
};
const input = () => root.querySelector('[aria-label="Límite de Salario"]');
const change = async (value) => {
  const el = input();
  el.value = value;
  el.dispatchEvent(new window.Event('change'));
  await nextTurn();
};
const copyButton = () => [...root.querySelectorAll('button')].find((b) => b.textContent === 'Copiar del mes anterior');
const summary = (label) =>
  [...root.querySelectorAll('.sum-pill')]
    .find((el) => el.querySelector('.sp-k').textContent === label)
    ?.querySelector('.sp-v').textContent;
async function setup(data = initial()) {
  serve(data);
  await store.load();
  render(root, period);
}
test('incluye Salario y separa gastos con/sin límite en el resumen', async () => {
  await setup();
  assert.ok(input());
  assert.equal(input().getAttribute('step'), '0.01');
  assert.ok(summary('Presupuestado').includes('150'));
  assert.ok(summary('Gastos con límite').includes('130'));
  assert.ok(summary('Disponible').includes('20'));
  assert.ok(summary('Gastos sin límite').includes('200'));
});
test('un número negativo o incompleto no elimina el presupuesto ni llama a la API', async () => {
  await setup();
  let calls = 0;
  api.put = async () => {
    calls++;
  };
  for (const value of ['-1', '0.004', '1.234', 'texto']) {
    await change(value);
    assert.equal(input().getAttribute('aria-invalid'), 'true');
  }
  Object.defineProperty(input(), 'validity', { configurable: true, value: { badInput: true } });
  await change('');
  assert.equal(calls, 0);
  assert.equal(store.budgetFor(1, 10, 2026).amount, 100);
  assert.ok(root.querySelector('#budget-error-1').textContent.includes('guardado se conserva'));
});
test('guarda céntimos y solo quita el límite al vaciar expresamente el campo', async () => {
  await setup();
  const sent = [];
  api.put = async (path, body) => {
    assert.equal(path, '/budgets');
    sent.push(body);
    return body.amount ? { id: 1, ...body } : null;
  };
  await change('0.01');
  assert.equal(store.budgetFor(1, 10, 2026).amount, 0.01);
  await change('');
  assert.equal(store.budgetFor(1, 10, 2026), undefined);
  assert.deepEqual(
    sent.map((p) => p.amount),
    [0.01, 0],
  );
});
test('un fallo muestra error y permite reintentar el mismo valor sin editarlo otra vez', async () => {
  await setup();
  let reject,
    calls = 0;
  api.put = () => {
    calls++;
    return new Promise((_resolve, fail) => {
      reject = fail;
    });
  };
  await change('125');
  assert.equal(input().disabled, true);
  assert.equal(input().getAttribute('aria-busy'), 'true');
  reject(Error('Sin conexión'));
  await nextTurn();
  assert.equal(input().disabled, false);
  assert.equal(store.budgetFor(1, 10, 2026).amount, 100);
  assert.ok(root.querySelector('#budget-error-1').textContent.includes('No se pudo confirmar'));
  api.put = async (_path, body) => {
    calls++;
    return { id: 1, ...body };
  };
  const retry = [...input().closest('.bud-row').querySelectorAll('button')].find(
    (b) => b.textContent === 'Reintentar guardado',
  );
  assert.equal(retry.hidden, false);
  retry.click();
  await nextTurn();
  assert.equal(calls, 2);
  assert.equal(store.budgetFor(1, 10, 2026).amount, 125);
  assert.equal(input().hasAttribute('aria-invalid'), false);
});
test('copiar completa solo el mes destino y evita dos envíos mientras está pendiente', async () => {
  await setup();
  let resolve,
    calls = 0;
  api.post = (path, body) => {
    assert.equal(path, '/budgets/copy-previous');
    assert.deepEqual(body, period);
    calls++;
    return new Promise((done) => {
      resolve = done;
    });
  };
  const copy = copyButton();
  copy.click();
  copy.click();
  await nextTurn();
  assert.equal(calls, 1);
  assert.equal(copy.disabled, true);
  resolve({
    copied: 1,
    existing: 1,
    budgets: [
      ...initial().budgets.filter((b) => b.month === 10),
      { id: 5, categoryId: 3, month: 10, year: 2026, amount: 30 },
    ],
  });
  await nextTurn();
  assert.equal(store.budgetFor(1, 10, 2026).amount, 100);
  assert.equal(store.budgetFor(3, 10, 2026).amount, 30);
  assert.equal(store.budgetFor(3, 9, 2026).amount, 30);
});
test('la copia tardía conserva su mes y no reemplaza otra vista montada después', async () => {
  await setup();
  let resolve;
  api.post = () =>
    new Promise((done) => {
      resolve = done;
    });
  copyButton().click();
  await nextTurn();
  root.textContent = 'Otra vista';
  resolve({ copied: 1, existing: 0, budgets: [{ id: 6, categoryId: 3, month: 10, year: 2026, amount: 30 }] });
  await nextTurn();
  assert.equal(root.textContent, 'Otra vista');
  assert.equal(store.budgetFor(3, 10, 2026).amount, 30);
});
test('muestra el exceso y deshabilita copiar si el mes anterior no tiene límites', async () => {
  const data = initial();
  data.budgets = [{ id: 1, categoryId: 1, month: 10, year: 2026, amount: 100 }];
  await setup(data);
  assert.ok(summary('Excedido').includes('20'));
  assert.equal(summary('Disponible'), undefined);
  assert.equal(copyButton().disabled, true);
  render(root, { month: 11, year: 2026 });
  assert.equal(copyButton().disabled, false);
  render(root, { month: 0, year: 2000 });
  assert.equal(copyButton().disabled, true);
  const filled = initial();
  filled.budgets.push({ id: 5, categoryId: 3, month: 10, year: 2026, amount: 30 });
  await setup(filled);
  assert.equal(copyButton().disabled, true);
  assert.match(copyButton().title, /ya tienen/);
});
