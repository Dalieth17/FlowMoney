import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { api } from '../public/assets/js/core/api.js';
import { render } from '../public/assets/js/views/metas.js';
const { document, window } = parseHTML('<html><body><main></main></body></html>');
Object.assign(globalThis, {
  document,
  window,
  Node: window.Node,
  location: { hash: '#/metas' },
  requestAnimationFrame: () => 0,
});
const root = document.querySelector('main');
let calls = [];
const goal = {
  id: '11111111-1111-4111-8111-111111111111',
  data: { name: '<img src=x onerror=alert(1)>', target: 100, deadline: null, archived: false },
};
let state = { goals: [], goalEntries: [] };
api.get = async () => state;
api.post = async (path, body) => {
  calls.push({ path, body });
  return {};
};
api.put = async (path, body) => {
  calls.push({ path, body });
  return {};
};
const control = (form, label) =>
  form.querySelector(
    '#' + [...form.querySelectorAll('label')].find((l) => l.textContent === label).getAttribute('for'),
  );
test('pantalla de metas crea objetivos y explica que no modifica cuentas', async () => {
  await render(root);
  assert.ok(root.textContent.includes('no mueven dinero'));
  const form = root.querySelector('form');
  control(form, 'Nombre de la meta').value = 'Emergencias';
  control(form, 'Objetivo de ahorro').value = '500';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await nextTurn();
  assert.equal(calls.length, 1);
  assert.match(calls[0].path, /^\/goals\/[0-9a-f-]{36}$/);
  assert.equal(calls[0].body.target, 500);
});
test('muestra progreso, escapa nombres y envía aportes sin crear movimientos financieros', async () => {
  state = {
    goals: [goal],
    goalEntries: [{ id: 'e', goalId: goal.id, data: { amount: 25, type: 'ADD', date: '2026-01-01', note: '' } }],
  };
  calls = [];
  await render(root);
  assert.equal(root.querySelectorAll('img').length, 0);
  assert.equal(root.querySelector('progress').value, 25);
  const form = [...root.querySelectorAll('form')].find((f) => f.textContent.includes('Registrar aporte o retiro'));
  control(form, 'Monto').value = '20';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await nextTurn();
  assert.equal(calls.length, 1);
  assert.match(calls[0].path, /\/entries\//);
  assert.equal(calls[0].body.type, 'ADD');
  assert.equal(calls[0].body.amount, 20);
});
