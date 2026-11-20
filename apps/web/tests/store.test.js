import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { api } from '../public/assets/js/core/api.js';
import { store } from '../public/assets/js/core/store.js';
import { getCurrency } from '../public/assets/js/core/format.js';
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

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const serve = (server) => {
  api.get = async (path) =>
    path.startsWith('/bootstrap')
      ? { ...structuredClone(server), transactions: [] }
      : { items: structuredClone(server.transactions), nextCursor: null };
};

test('respuestas de ediciones concurrentes fuera de orden no restauran un valor anterior', async () => {
  const server = data('Actual');
  server.transactions = [{ id: 1, amount: 100 }];
  serve(server);
  await store.load();
  const pending = deferred();
  let first = true;
  api.put = async (_path, payload) => {
    if (first) {
      first = false;
      return pending.promise;
    }
    server.transactions = [{ id: 1, ...payload }];
    return server.transactions[0];
  };
  const older = store.updateTransaction(1, { amount: 200 });
  await store.updateTransaction(1, { amount: 300 });
  pending.resolve({ id: 1, amount: 200 });
  await older;
  assert.equal(store.transactions[0].amount, 300);
});

test('un alta pendiente espera al reinicio completo y no mezcla IDs anteriores', async () => {
  const server = data('Base');
  serve(server);
  await store.load();
  const creation = deferred(),
    reset = deferred();
  api.post = (path) => (path === '/data/reset' ? reset.promise : creation.promise);
  const adding = store.addTransaction({ amount: 100 });
  const replacing = store.resetData();
  await nextTurn();
  creation.resolve({ id: 55, amount: 100 });
  await nextTurn();
  assert.equal(store.transactions.length, 0, 'el resultado antiguo no se mezcla mientras el reinicio está pendiente');
  server.transactions = [{ id: 77, amount: 250 }];
  reset.resolve(null);
  await Promise.all([adding, replacing]);
  assert.deepEqual(
    store.transactions.map((t) => t.id),
    [77],
  );
});

test('una respuesta en COP no se añade como si fuera USD después de convertir', async () => {
  const server = data('Moneda');
  serve(server);
  await store.load();
  const pending = deferred();
  api.post = () => pending.promise;
  const adding = store.addTransaction({ amount: 8000 });
  api.put = async () => {
    server.user.currency = 'USD';
    server.transactions = [{ id: 55, amount: 2 }];
    return { ...server.user, convertedData: { ...server } };
  };
  await store.updateProfile({ name: 'Moneda', currency: 'USD' });
  pending.resolve({ id: 55, amount: 8000 });
  await adding;
  assert.equal(getCurrency(), 'USD');
  assert.deepEqual(store.transactions, [{ id: 55, amount: 2 }]);
});

test('si falla la recarga tras un guardado confirmado, avisa sin informar que falló la escritura', async () => {
  const server = data('Recarga');
  server.transactions = [{ id: 1, amount: 100 }];
  serve(server);
  await store.load();
  const pending = deferred();
  let first = true;
  api.put = async (_path, payload) => {
    if (first) {
      first = false;
      return pending.promise;
    }
    server.transactions = [{ id: 1, ...payload }];
    return server.transactions[0];
  };
  const older = store.updateTransaction(1, { amount: 200 });
  await store.updateTransaction(1, { amount: 300 });
  api.get = async () => {
    throw Error('Sin conexión');
  };
  pending.resolve({ id: 1, amount: 200 });
  await assert.doesNotReject(older);
  assert.match(store.syncError, /El cambio se guardó/);
  assert.equal(store.transactions[0].amount, 300);
  serve(server);
  await store.load();
  assert.equal(store.syncError, null);
});

test('importación confirmada mantiene el éxito si falla recargar y permite recuperar la caché', async () => {
  const server = data('Importación');
  serve(server);
  await store.load();
  api.post = async () => ({ imported: 2, skipped: 1, excluded: 0 });
  api.get = async () => {
    throw Error('Sin conexión');
  };
  const result = await store.importTransactions({ csv: 'CSV revisado', currency: 'COP', digest: 'a'.repeat(64) });
  assert.equal(result.imported, 2);
  assert.match(store.syncError, /La importación se guardó/);
  server.transactions = [
    { id: 101, amount: 10 },
    { id: 102, amount: 20 },
  ];
  serve(server);
  await store.load();
  assert.equal(store.transactions.length, 2);
  assert.equal(store.syncError, null);
});
