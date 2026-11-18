import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goalProgress } from '../public/assets/js/domain/goals.js';
const goal = { id: 'g', data: { target: 100, deadline: '2026-11-20' } };
const entries = [
  { goalId: 'g', data: { type: 'ADD', amount: 40 } },
  { goalId: 'g', data: { type: 'WITHDRAW', amount: 10 } },
  { goalId: 'other', data: { type: 'ADD', amount: 999 } },
];
test('meta: progreso y aporte diario incluyen hoy y excluyen aportes de otras metas', () => {
  const p = goalProgress(goal, entries, Date.UTC(2026, 10, 18, 17));
  assert.equal(p.saved, 30);
  assert.equal(p.remaining, 70);
  assert.equal(p.percent, 30);
  assert.equal(p.daily, 23.34);
});
test('meta: completada, vencida y sin fecha no sugieren aportes incorrectos', () => {
  const now = Date.UTC(2026, 10, 21, 17);
  assert.equal(goalProgress(goal, entries, now).overdue, true);
  assert.equal(goalProgress(goal, entries, now).daily, null);
  const complete = goalProgress(goal, [{ goalId: 'g', data: { type: 'ADD', amount: 150 } }], now);
  assert.equal(complete.percent, 100);
  assert.equal(complete.remaining, 0);
  assert.equal(complete.complete, true);
  assert.equal(complete.overdue, false);
  assert.equal(goalProgress({ ...goal, data: { ...goal.data, deadline: null } }, entries, now).daily, null);
});
test('meta: centavos se acumulan exactamente', () => {
  const p = goalProgress(
    goal,
    [0.1, 0.2].map((amount) => ({ goalId: 'g', data: { type: 'ADD', amount } })),
  );
  assert.equal(p.saved, 0.3);
});
