// Cálculos financieros puros: reciben arreglos, devuelven datos derivados.
// No tocan el DOM ni el store, así se prueban fácilmente.

import { weekOfMonth, weeksInMonth } from '../core/format.js';

export const BUDGET_WARNING_PCT = 80;

const sum = (list) => list.reduce((acc, t) => acc + t.amount, 0);

export function inMonth(transactions, month, year) {
  return transactions
    .filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .sort((a, b) => b.date - a.date || b.id - a.id);
}

export function totals(list) {
  const income = sum(list.filter((t) => t.type === 'INCOME'));
  const expense = sum(list.filter((t) => t.type === 'EXPENSE'));
  return { income, expense, balance: income - expense };
}

export const savingRate = ({ income, balance }) => (income > 0 ? Math.round((balance / income) * 100) : 0);

export const spentInCategory = (list, categoryId) =>
  sum(list.filter((t) => t.type === 'EXPENSE' && t.categoryId === categoryId));

/** Gasto agrupado por categoría, de mayor a menor. */
export function expenseByCategory(list, categories) {
  const byId = new Map();
  list
    .filter((t) => t.type === 'EXPENSE')
    .forEach((t) => byId.set(t.categoryId, (byId.get(t.categoryId) || 0) + t.amount));
  return [...byId.entries()]
    .map(([id, value]) => ({ category: categories.find((c) => c.id === id), value }))
    .filter((x) => x.category)
    .sort((a, b) => b.value - a.value);
}

/** Ingresos y gastos por semana del mes. */
export function weeklyFlow(list, month, year) {
  const weeks = Array.from({ length: weeksInMonth(month, year) }, (_, i) => ({
    label: `Sem ${i + 1}`,
    income: 0,
    expense: 0,
  }));
  list.forEach((t) => {
    const week = weeks[weekOfMonth(t.date) - 1];
    if (week) week[t.type === 'INCOME' ? 'income' : 'expense'] += t.amount;
  });
  return weeks;
}

/** Ingresos y gastos de los últimos `count` meses hasta (month, year). */
export function monthlySeries(transactions, month, year, count, labelOf) {
  const series = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(year, month - i, 1);
    const t = totals(inMonth(transactions, d.getMonth(), d.getFullYear()));
    series.push({ label: labelOf(d.getMonth()), income: t.income, expense: t.expense });
  }
  return series;
}

/** Estado de un presupuesto: ok (<80%), warn (>=80%), over (>=100%). */
export function budgetStatus(spent, budget) {
  if (!(budget > 0)) return null;
  const pct = (spent / budget) * 100;
  if (pct >= 100) return { pct, level: 'over', label: 'Presupuesto superado' };
  if (pct >= BUDGET_WARNING_PCT) return { pct, level: 'warn', label: 'Cerca del límite' };
  return { pct, level: 'ok', label: 'En control' };
}

/** Saldo de cada cuenta: saldo inicial + ingresos − gastos (histórico). */
export function accountBalances(accounts, transactions) {
  return accounts.map((account) => {
    const own = transactions.filter((t) => t.accountId === account.id);
    const { income, expense } = totals(own);
    return { account, balance: account.initialBalance + income - expense, count: own.length };
  });
}

/** Filtros de la lista de movimientos (todos opcionales). */
export function filterTransactions(list, { type = 'ALL', categoryId = 'ALL', accountId = 'ALL', query = '' } = {}) {
  const q = query.trim().toLowerCase();
  return list.filter(
    (t) =>
      (type === 'ALL' || t.type === type) &&
      (categoryId === 'ALL' || t.categoryId === Number(categoryId)) &&
      (accountId === 'ALL' || t.accountId === Number(accountId)) &&
      (!q || t.description.toLowerCase().includes(q) || (t.note || '').toLowerCase().includes(q)),
  );
}
