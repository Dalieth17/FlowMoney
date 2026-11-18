import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../public/assets/js/core/api.js';
import { store } from '../public/assets/js/core/store.js';
test('un error tardío no invalida una carga reciente que ya terminó bien', async () => {
  const pending = [];
  api.get = (path) =>
    path.startsWith('/bootstrap')
      ? new Promise((resolve, reject) => pending.push({ resolve, reject }))
      : Promise.resolve({ items: [], nextCursor: null });
  const old = store.load(),
    current = store.load();
  pending[1].resolve(data('Reciente'));
  await current;
  pending[0].reject(Error('Petición anterior fallida'));
  await assert.doesNotReject(old);
  assert.equal(store.user.name, 'Reciente');
});
const data = (name) => ({
  user: { name, currency: 'COP' },
  transactions: [],
  accounts: [],
  categories: [],
  budgets: [],
});
test('la carga más reciente prevalece aunque la anterior termine después', async () => {
  const pending = [];
  api.get = (path) =>
    path.startsWith('/bootstrap')
      ? new Promise((resolve) => pending.push(resolve))
      : Promise.resolve({ items: [], nextCursor: null });
  const old = store.load(),
    current = store.load();
  pending[1](data('Reciente'));
  await current;
  pending[0](data('Anterior'));
  await old;
  assert.equal(store.user.name, 'Reciente');
});
test('una carga en curso no borra un movimiento guardado mientras esperaba', async () => {
  api.get = (path) => Promise.resolve(path.startsWith('/bootstrap') ? data('Base') : { items: [], nextCursor: null });
  await store.load();
  let resolve;
  api.get = (path) =>
    path.startsWith('/bootstrap')
      ? new Promise((r) => {
          resolve = r;
        })
      : Promise.resolve({ items: [], nextCursor: null });
  const loading = store.load();
  api.post = async () => ({ id: 55, description: 'Guardado', amount: 2 });
  await store.addTransaction({});
  resolve(data('Anterior'));
  await loading;
  assert.equal(store.transactions[0]?.id, 55);
});
