import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { api } from '../public/assets/js/core/api.js';
import { store } from '../public/assets/js/core/store.js';
import { closeModal, openModal } from '../public/assets/js/ui/feedback.js';
import { openMovementForm } from '../public/assets/js/forms/movementForm.js';
import { openAccountForm } from '../public/assets/js/forms/accountForm.js';
import { openCategoryForm } from '../public/assets/js/forms/categoryForm.js';

const { document, window } = parseHTML('<html><body></body></html>');
Object.assign(globalThis, { document, window, Node: window.Node, requestAnimationFrame: () => 0 });
const timeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, delay) => timeout(fn, delay).unref();
after(() => {
  globalThis.setTimeout = timeout;
});
const category = { id: 1, name: 'Otros', color: '#112233', icon: 'x', isDefault: false };
const account = { id: 1, name: 'Banco', type: 'BANK', initialBalance: 100 };
const movement = {
  id: 1,
  description: 'Original',
  amount: 10,
  date: Date.now(),
  type: 'EXPENSE',
  categoryId: 1,
  accountId: 1,
  note: '',
};

for (const [open, existing, title] of [
  [openMovementForm, movement, 'Nuevo movimiento'],
  [openAccountForm, account, 'Nueva cuenta'],
  [openCategoryForm, category, 'Nueva categoría'],
]) {
  test(`una respuesta tardía no cierra ni borra el formulario ${title}`, async () => {
    closeModal();
    api.get = async (path) =>
      path.startsWith('/bootstrap')
        ? { user: { currency: 'COP' }, accounts: [account], categories: [category], budgets: [], transactions: [] }
        : { items: [movement], nextCursor: null };
    await store.load();
    let resolve;
    api.put = () =>
      new Promise((done) => {
        resolve = done;
      });
    open(existing);
    const oldForm = document.querySelector('form');
    oldForm.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
    await nextTurn();
    assert.equal(typeof resolve, 'function');
    closeModal();
    open();
    const current = document.querySelector('form');
    current.querySelector('input[type=text]').value = 'Conservar este borrador';
    resolve(existing);
    await nextTurn();
    assert.equal(document.querySelector('form'), current);
    assert.equal(document.querySelector('.modal-head h3').textContent, title);
    assert.equal(current.querySelector('input[type=text]').value, 'Conservar este borrador');
  });
}

test('el controlador de un modal anterior no cierra el actual', () => {
  const old = openModal('Anterior', document.createElement('input'));
  openModal('Actual', document.createElement('input'));
  old.close();
  assert.equal(document.querySelector('.modal-head h3').textContent, 'Actual');
  closeModal();
});
