import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { parseHTML } from 'linkedom';
import { api, ApiError } from '../public/assets/js/core/api.js';
import { store } from '../public/assets/js/core/store.js';
import { openMovementForm } from '../public/assets/js/forms/movementForm.js';
import { closeModal } from '../public/assets/js/ui/feedback.js';

test('un conflicto mantiene el borrador visible e identifica los campos sin avanzar la copia original', async (t) => {
  const { document, window } = parseHTML('<html><body></body></html>');
  Object.assign(globalThis, { document, window, Node: window.Node, requestAnimationFrame: () => 0 });
  t.after(closeModal);
  const expected = {
    description: 'Compra',
    amount: 12,
    type: 'EXPENSE',
    date: Date.UTC(2026, 10, 1, 11, 30),
    categoryId: 3,
    accountId: null,
    note: '',
  };
  const movement = { id: 7, ...expected };
  t.mock.getter(store, 'categories', () => [{ id: 3, name: 'Otros' }]);
  const put = t.mock.method(api, 'put', async () => {
    throw new ApiError(409, 'Otra pestaña modificó este movimiento. Campos con cambios: Monto, Nota.');
  });
  openMovementForm(movement);
  const form = document.querySelector('form');
  form.querySelector('input[type=text]').value = 'Mi borrador';
  form.querySelector('textarea').value = 'Mi nota';
  for (let i = 0; i < 2; i++) {
    form.dispatchEvent(new window.Event('submit', { cancelable: true }));
    await nextTurn();
    assert.equal(document.querySelector('form'), form);
    assert.equal(form.querySelector('input[type=text]').value, 'Mi borrador');
    assert.equal(form.querySelector('textarea').value, 'Mi nota');
    const alert = form.querySelector('[role=alert]');
    assert.equal(alert.hidden, false);
    assert.match(alert.textContent, /Monto, Nota/);
    assert.deepEqual(put.mock.calls[i].arguments, [
      '/transactions/7',
      { ...expected, description: 'Mi borrador', note: 'Mi nota', expected },
    ]);
  }
});
