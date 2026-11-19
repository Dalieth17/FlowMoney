import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { api } from '../public/assets/js/core/api.js';
import { store } from '../public/assets/js/core/store.js';

const { document, window } = parseHTML('<html><body><main></main></body></html>');
Object.assign(globalThis, { document, window, Node: window.Node, requestAnimationFrame: () => 0 });
const { render } = await import('../public/assets/js/views/resumen.js');
const { spendingChartCard } = await import('../public/assets/js/ui/spendingChart.js');
const root = document.querySelector('main');
const at = (day) => Date.UTC(2026, 10, day, 17);
const transaction = {
  id: 1,
  type: 'EXPENSE',
  kind: 'NORMAL',
  amount: 100,
  date: at(5),
  categoryId: 1,
  accountId: 1,
  description: 'Mercado',
  note: '',
};
const data = (transactions = []) => ({
  user: { name: 'Pruebas', currency: 'COP' },
  transactions,
  categories: [{ id: 1, name: 'Otros', icon: 'x', color: '#112233' }],
  accounts: [{ id: 1, name: 'Banco', initialBalance: 5000 }],
  budgets: [{ id: 1, categoryId: 1, amount: 900000, month: 10, year: 2026 }],
});
const chart = () => root.querySelector('.chart3d');
api.get = async (path) => (path.startsWith('/bootstrap') ? data() : { items: [], nextCursor: null });

test('Resumen se actualiza con alta, edición, cambio de fecha y borrado; el presupuesto no crea barras', async () => {
  await store.load();
  const draw = () => render(root, { month: 10, year: 2026 });
  const unsubscribe = store.subscribe(draw);
  try {
    draw();
    assert.ok(chart().textContent.includes('Sin gastos este mes'));
    assert.equal(chart().querySelector('canvas'), null);
    api.post = async (_path, payload) => ({ ...transaction, ...payload });
    await store.addTransaction(transaction);
    assert.equal(chart().querySelectorAll('rect[data-day]').length, 1);
    assert.equal(chart().querySelector('rect[data-day="5"]').dataset.amount, '100');
    api.put = async (_path, payload) => ({ ...transaction, ...payload });
    await store.updateTransaction(1, { ...transaction, amount: 275, date: at(9) });
    assert.equal(chart().querySelector('rect[data-day="5"]'), null);
    assert.equal(chart().querySelector('rect[data-day="9"]').dataset.amount, '275');
    assert.ok(chart().querySelector('tr[data-day="9"]').textContent.includes('$ 275'));
    assert.ok(chart().querySelector('.daily-chart-summary').textContent.includes('$ 275'));
    api.del = async () => null;
    await store.deleteTransaction(1);
    assert.equal(chart().querySelectorAll('rect[data-day]').length, 0);
    assert.ok(chart().textContent.includes('Sin gastos este mes'));
  } finally {
    unsubscribe();
  }
});

test('sin WebGL muestra los mismos datos diarios y distingue programados de gastos hasta hoy', () => {
  const card = spendingChartCard(
    [transaction, { ...transaction, id: 2, date: at(25), amount: 200 }],
    10,
    2026,
    new Date(2026, 10, 19),
  );
  root.replaceChildren(card);
  assert.equal(card.querySelectorAll('rect[data-day]').length, 2);
  assert.equal(card.querySelectorAll('rect.bar-scheduled').length, 1);
  const summary = card.querySelector('.daily-chart-summary').textContent;
  assert.ok(summary.includes('Gastado: $ 100'));
  assert.ok(summary.includes('Programado: $ 200'));
  assert.ok(summary.includes('Total registrado: $ 300'));
  assert.equal(card.querySelectorAll('tbody tr').length, 30);
  assert.equal(card.querySelector('.daily-chart-fallback').hidden, false);
});

test('cambiar mes muestra únicamente el período elegido', async () => {
  api.get = async (path) => (path.startsWith('/bootstrap') ? data() : { items: [transaction], nextCursor: null });
  await store.load();
  render(root, { month: 10, year: 2026 });
  assert.equal(chart().querySelectorAll('rect[data-day]').length, 1);
  render(root, { month: 9, year: 2026 });
  assert.equal(chart().querySelectorAll('rect[data-day]').length, 0);
  assert.ok(chart().textContent.includes('Octubre 2026'));
});
