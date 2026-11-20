import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { api } from '../public/assets/js/core/api.js';
import { store } from '../public/assets/js/core/store.js';
import { closeModal, openModal } from '../public/assets/js/ui/feedback.js';
import { openTransactionImport } from '../public/assets/js/forms/importTransactions.js';
const { document, window } = parseHTML('<html><body></body></html>');
Object.assign(globalThis, { document, window, Node: window.Node, requestAnimationFrame: () => 0 });
const originalTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, delay) => originalTimeout(fn, delay).unref();
after(() => {
  closeModal();
  globalThis.setTimeout = originalTimeout;
});
const data = (currency = 'COP') => ({
  user: { currency },
  accounts: [{ id: 2, name: 'Banco' }],
  categories: [{ id: 1, name: 'Otros' }],
  transactions: [],
  budgets: [],
});
const getData = () => {
  api.get = async (path) => (path.startsWith('/bootstrap') ? data() : { items: [], nextCursor: null });
};
const plan = (description = 'Compra') => ({
  valid: true,
  digest: 'a'.repeat(64),
  summary: { new: 1, existing: 0, excluded: 0, errors: 0 },
  rows: [
    {
      line: 2,
      date: '2026-11-19',
      description,
      category: 'Otros',
      account: 'Banco',
      status: 'NEW',
      transaction: { type: 'EXPENSE', amount: 10, note: 'Nota revisada' },
    },
  ],
});
const button = (name) => [...document.querySelectorAll('.modal-body button')].find((b) => b.textContent.includes(name));
async function setup() {
  closeModal();
  getData();
  await store.load();
  openTransactionImport();
}
async function file(text = 'CSV de prueba') {
  const input = document.querySelector('input[type=file]');
  Object.defineProperty(input, 'files', { configurable: true, value: [{ size: text.length, text: async () => text }] });
  input.dispatchEvent(new window.Event('change'));
  await nextTurn();
}
test('vista previa muestra notas y errores, bloquea el guardado y confirma solo el archivo revisado una vez', async () => {
  await setup();
  const calls = [];
  api.post = async (path, payload) => {
    calls.push({ path, payload });
    return path.endsWith('/preview') ? plan('<img src=x onerror=alert(1)>') : { imported: 1, skipped: 0, excluded: 0 };
  };
  assert.equal(button('Importar movimientos').disabled, true);
  await file();
  assert.ok(document.querySelector('.csv-preview').textContent.includes('Nota revisada'));
  assert.equal(document.querySelector('.csv-preview img'), null);
  assert.equal(button('Importar 1 movimiento').disabled, false);
  button('Importar 1 movimiento').click();
  button('Importar 1 movimiento').click();
  await nextTurn();
  assert.equal(calls.filter((c) => c.path === '/transactions/import').length, 1);
  assert.deepEqual(calls[1].payload, { csv: 'CSV de prueba', currency: 'COP', digest: 'a'.repeat(64) });
  assert.equal(document.querySelector('.modal-card'), null);
});
test('los errores de fila impiden importar y dejan revisar un archivo corregido', async () => {
  await setup();
  api.post = async () => ({
    ...plan(),
    valid: false,
    summary: { new: 1, existing: 0, excluded: 0, errors: 1 },
    rows: [{ line: 3, date: '2026-02-30', description: 'Inválido', status: 'ERROR', error: 'La fecha no existe' }],
  });
  await file();
  assert.equal(button('Importar 1 movimiento').disabled, true);
  assert.ok(document.querySelector('.csv-preview').textContent.includes('La fecha no existe'));
  assert.equal(button('Revisar archivo').disabled, false);
});
test('cambiar el archivo ignora la respuesta tardía de la selección anterior', async () => {
  await setup();
  const pending = [];
  api.post = () => new Promise((resolve) => pending.push(resolve));
  await file('Primero');
  await file('Segundo');
  pending[1](plan('Segundo'));
  await nextTurn();
  pending[0](plan('Primero'));
  await nextTurn();
  assert.ok(document.querySelector('.csv-preview').textContent.includes('Segundo'));
  assert.ok(!document.querySelector('.csv-preview').textContent.includes('Primero'));
});
test('cerrar un importador pendiente no permite que su respuesta cierre otro modal', async () => {
  await setup();
  let resolve;
  api.post = (path) =>
    path.endsWith('/preview')
      ? Promise.resolve(plan())
      : new Promise((done) => {
          resolve = done;
        });
  await file();
  button('Importar 1 movimiento').click();
  await nextTurn();
  openModal('Borrador nuevo', document.createElement('input'));
  resolve({ imported: 1, skipped: 0 });
  await nextTurn();
  await nextTurn();
  assert.equal(document.querySelector('.modal-head h3').textContent, 'Borrador nuevo');
});
test('cambiar moneda invalida el importador aunque su vista previa llegue después', async () => {
  await setup();
  let resolve;
  api.post = () =>
    new Promise((done) => {
      resolve = done;
    });
  await file();
  api.put = async () => ({ ...data('USD').user, convertedData: data('USD') });
  await store.updateProfile({ currency: 'USD' });
  resolve(plan());
  await nextTurn();
  assert.equal(document.querySelector('input[type=file]').disabled, true);
  assert.equal(button('Importar movimientos').disabled, true);
  assert.ok(document.querySelector('.modal-body').textContent.includes('La moneda cambió'));
  assert.equal(document.querySelector('.csv-preview'), null);
});
test('una confirmación fallida exige revisar de nuevo en vez de repetir la escritura', async () => {
  await setup();
  api.post = async (path) => {
    if (path.endsWith('/preview')) return plan();
    throw Error('Sin conexión');
  };
  await file();
  button('Importar 1 movimiento').click();
  await nextTurn();
  await nextTurn();
  assert.equal(button('Importar 1 movimiento').disabled, true);
  assert.equal(button('Revisar archivo').disabled, false);
  assert.ok(document.querySelector('.modal-body').textContent.includes('Vuelve a revisar'));
});
test('si todas las filas existen se puede recargar el panel sin reenviar la importación', async () => {
  await setup();
  let imports = 0;
  api.post = async (path) => {
    if (!path.endsWith('/preview')) imports++;
    return { ...plan(), summary: { new: 0, existing: 1, excluded: 0, errors: 0 } };
  };
  await file();
  assert.equal(button('Importar 0 movimientos').disabled, true);
  button('Actualizar panel').click();
  await nextTurn();
  assert.equal(imports, 0);
  assert.equal(document.querySelector('.modal-card'), null);
});
