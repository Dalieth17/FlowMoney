import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetOverview, parseBudgetAmount } from '../public/assets/js/domain/budgets.js';
import { availableToSpend, budgetStatus } from '../public/assets/js/domain/selectors.js';
const budgets = [
  { categoryId: 1, amount: 100.1, month: 10, year: 2026 },
  { categoryId: 2, amount: 0.2, month: 10, year: 2026 },
  { categoryId: 3, amount: 1000, month: 9, year: 2026 },
];
const list = [
  { categoryId: 1, amount: 100.2, type: 'EXPENSE' },
  { categoryId: 2, amount: 0.1, type: 'EXPENSE' },
  { categoryId: 3, amount: 300, type: 'EXPENSE' },
  { categoryId: 1, amount: 900, type: 'INCOME' },
  { categoryId: 1, amount: 900, type: 'EXPENSE', kind: 'TRANSFER' },
  { categoryId: 1, amount: 100, type: 'EXPENSE', kind: 'ADJUSTMENT' },
];
test('resumen separa gastos sin límite, conserva centavos y coincide con Disponible de Resumen', () => {
  const r = budgetOverview(list, budgets, 10, 2026);
  assert.equal(r.budgeted, 100.3);
  assert.equal(r.limitedSpent, 100.3);
  assert.equal(r.remaining, 0);
  assert.equal(r.unbudgetedSpent, 300);
  assert.equal(r.spentByCategory.get(1), 100.2);
  assert.equal(r.remaining, availableToSpend(list, budgets, 10, 2026).remaining);
});
test('el exceso mantiene su importe y sin presupuestos todo gasto queda separado', () => {
  const r = budgetOverview(list, [budgets[0]], 10, 2026);
  assert.equal(r.remaining, -0.1);
  assert.equal(r.unbudgetedSpent, 300.1);
  const none = budgetOverview(list, [], 10, 2026);
  assert.equal(none.remaining, 0);
  assert.equal(none.unbudgetedSpent, 400.3);
});
test('límites vacíos/cero se eliminan explícitamente y se aceptan céntimos', () => {
  for (const value of ['', '  ', '0', '0.00']) assert.equal(parseBudgetAmount(value), 0);
  for (const [text, value] of [
    ['0.01', 0.01],
    ['12.50', 12.5],
    ['1e2', 100],
    ['9999999999.99', 9999999999.99],
  ])
    assert.equal(parseBudgetAmount(text), value);
});
test('un valor negativo, incompleto o inválido nunca se transforma en cero', () => {
  for (const value of ['-1', 'abc', 'NaN', 'Infinity', '0.004', '1.234', '10000000000'])
    assert.throws(() => parseBudgetAmount(value));
  assert.throws(() => parseBudgetAmount('', { badInput: true }), /numérico/);
});
test('alcanzar exactamente el límite se distingue de superarlo', () => {
  assert.equal(budgetStatus(100, 100).label, 'Límite alcanzado');
  assert.equal(budgetStatus(100.01, 100).label, 'Presupuesto superado');
  assert.equal(budgetStatus(99.99, 100).level, 'warn');
});
