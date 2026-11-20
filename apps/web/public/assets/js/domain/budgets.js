import { isOperating } from './selectors.js';

/** list contiene los movimientos del mes, incluidos los registrados para fechas futuras. */
export function budgetOverview(list, budgets, month, year) {
  const limits = new Map(
    budgets
      .filter((b) => b.month === month && b.year === year && b.amount > 0)
      .map((b) => [b.categoryId, Math.round(b.amount * 100)]),
  );
  const spentByCategory = new Map();
  for (const tx of list) {
    if (isOperating(tx) && tx.type === 'EXPENSE')
      spentByCategory.set(tx.categoryId, (spentByCategory.get(tx.categoryId) || 0) + Math.round(tx.amount * 100));
  }
  const budgeted = [...limits.values()].reduce((sum, n) => sum + n, 0);
  let limitedSpent = 0,
    unbudgetedSpent = 0;
  for (const [id, cents] of spentByCategory) {
    if (limits.has(id)) limitedSpent += cents;
    else unbudgetedSpent += cents;
  }
  return {
    budgeted: budgeted / 100,
    limitedSpent: limitedSpent / 100,
    unbudgetedSpent: unbudgetedSpent / 100,
    remaining: (budgeted - limitedSpent) / 100,
    spentByCategory: new Map([...spentByCategory].map(([id, cents]) => [id, cents / 100])),
  };
}

export function parseBudgetAmount(value, { badInput = false } = {}) {
  if (badInput) throw Error('Escribe un límite numérico válido');
  if (!value.trim()) return 0;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw Error('El límite debe ser un número mayor o igual a cero');
  if (amount > 9999999999.99) throw Error('El límite máximo es 9.999.999.999,99');
  if (amount > 0 && amount < 0.01) throw Error('El límite mínimo es 0.01; usa 0 o deja vacío para quitarlo');
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  if (rounded !== amount) throw Error('Usa como máximo dos decimales');
  return rounded;
}
