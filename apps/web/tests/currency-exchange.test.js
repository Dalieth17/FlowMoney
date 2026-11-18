import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { api } from '../public/assets/js/core/api.js';
import { store } from '../public/assets/js/core/store.js';
import { getCurrency, money } from '../public/assets/js/core/format.js';
import { currencyExchange } from '../public/assets/js/ui/currencyExchange.js';
import { closeModal } from '../public/assets/js/ui/feedback.js';

const { document, window } = parseHTML('<html><body><main></main></body></html>');
Object.assign(globalThis, { document, window, Node: window.Node, requestAnimationFrame: () => 0 });
const { render } = await import('../public/assets/js/views/perfil.js');
// LinkeDOM no implementa el setter ni la selección inicial automática del navegador.
Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
  configurable: true,
  get() {
    return this.querySelector('option[selected]')?.value ?? this.querySelector('option')?.value ?? '';
  },
  set(value) {
    for (const option of this.options) option.selected = option.value === value;
  },
});
const originalTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, delay) => originalTimeout(fn, delay).unref();
after(() => {
  globalThis.setTimeout = originalTimeout;
});
const root = document.querySelector('main');
const quote = { copPerUsd: 4000, source: 'automatic', quotedAt: '2026-11-18T00:00:00.000Z' };
const initial = () => ({
  user: { name: 'Pruebas', email: 'pruebas@example.test', currency: 'COP', createdAt: '2026-11-01' },
  accounts: [{ id: 1, initialBalance: 400000 }],
  categories: [],
  transactions: [],
  budgets: [],
});
const control = (form, label) =>
  form.querySelector(
    '#' + [...form.querySelectorAll('label')].find((l) => l.textContent === label).getAttribute('for'),
  );
const select = (element, value) => {
  element.value = value;
  element.dispatchEvent(new window.Event('change'));
};
const submit = async (form) => {
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await nextTurn();
};
let calls;
async function setup() {
  closeModal();
  calls = [];
  api.get = async (path) =>
    path.startsWith('/bootstrap')
      ? initial()
      : path.startsWith('/transactions/page')
        ? { items: [], nextCursor: null }
        : quote;
  api.put = async (path, body) => {
    calls.push({ path, body });
    return {
      ...initial().user,
      currency: body.currency,
      convertedData: { ...initial(), accounts: [{ id: 1, initialBalance: 100 }] },
    };
  };
  await store.load();
  render(root);
  return root.querySelector('form');
}
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent === text);

test('muestra cotización, fecha y equivalencia; cancelar no guarda cambios', async () => {
  const form = await setup();
  select(control(form, 'Moneda'), 'USD');
  await nextTurn();
  assert.equal(control(form, 'Pesos colombianos por 1 USD').value, '4000');
  assert.ok(form.textContent.includes('ExchangeRate-API'));
  assert.ok(form.textContent.includes('1 USD = 4.000 COP'));
  assert.ok(form.textContent.includes('US$ 250.00'));
  await submit(form);
  assert.ok(document.querySelector('[role=dialog]').textContent.includes('1 USD = 4000 COP'));
  await submit(form);
  assert.equal(document.querySelectorAll('[role=dialog]').length, 1, 'no abre confirmaciones duplicadas');
  button('Cancelar').click();
  await nextTurn();
  assert.equal(calls.length, 0);
  assert.equal(store.user.currency, 'COP');
});

test('confirmar aplica la cotización y actualiza importes y moneda juntos', async () => {
  const form = await setup();
  select(control(form, 'Moneda'), 'USD');
  await nextTurn();
  await submit(form);
  button('Convertir importes').click();
  await nextTurn();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body.exchange, { ...quote, fromCurrency: 'COP' });
  assert.equal(store.user.currency, 'USD');
  assert.equal(getCurrency(), 'USD');
  assert.equal(store.accounts[0].initialBalance, 100);
  assert.equal(money(store.accounts[0].initialBalance), 'US$ 100.00');
  assert.equal(store.user.convertedData, undefined);
});

test('fallo automático habilita tasa manual y exige un valor antes de guardar', async () => {
  const form = await setup();
  api.get = async () => {
    throw Error('No hay cotización: introduce una tasa manual.');
  };
  select(control(form, 'Moneda'), 'USD');
  await nextTurn();
  const rate = control(form, 'Pesos colombianos por 1 USD');
  assert.equal(control(form, 'Origen de la tasa').value, 'manual');
  assert.equal(rate.disabled, false);
  await submit(form);
  assert.equal(document.querySelector('[role=dialog]'), null);
  assert.equal(calls.length, 0);
  rate.value = '4100.25';
  await submit(form);
  button('Convertir importes').click();
  await nextTurn();
  assert.deepEqual(calls[0].body.exchange, { fromCurrency: 'COP', source: 'manual', copPerUsd: 4100.25 });
});

test('una respuesta automática tardía no reemplaza la tasa manual elegida', async () => {
  const form = await setup();
  let resolve;
  api.get = () =>
    new Promise((r) => {
      resolve = r;
    });
  select(control(form, 'Moneda'), 'USD');
  select(control(form, 'Origen de la tasa'), 'manual');
  control(form, 'Pesos colombianos por 1 USD').value = '4200';
  resolve(quote);
  await nextTurn();
  assert.equal(control(form, 'Pesos colombianos por 1 USD').value, '4200');
  await submit(form);
  button('Convertir importes').click();
  await nextTurn();
  assert.equal(calls[0].body.exchange.copPerUsd, 4200);
  assert.equal(calls[0].body.exchange.source, 'manual');
});

test('solo cambiar el nombre no solicita conversión y el formato explícito no cambia la moneda global', async () => {
  const form = await setup();
  await submit(form);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.exchange, undefined);
  assert.equal(money(250, 'USD'), 'US$ 250.00');
  assert.equal(getCurrency(), 'COP');
});

test('USD/COP muestra equivalencia inversa', async () => {
  await setup();
  const dropdown = document.createElement('select');
  dropdown.innerHTML = '<option value="USD">USD</option><option value="COP">COP</option>';
  const ui = currencyExchange(dropdown, { currency: 'USD' });
  root.replaceChildren(dropdown, ui.element);
  select(dropdown, 'COP');
  await nextTurn();
  assert.ok(ui.element.textContent.includes('US$ 100.00 ≈ $ 400.000'));
});
