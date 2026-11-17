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

/**
 * Cuánto queda para gastar en el mes según los presupuestos, y a qué ritmo.
 * - limit/spent: suma de los presupuestos del mes y lo gastado en esas categorías.
 * - daysLeft: días que faltan contando hoy (0 si el mes ya pasó; todo el mes si es futuro).
 * - perDay: lo que queda repartido entre los días que faltan (nunca negativo).
 * - aheadOfPace: cuánto se gastó por encima (+) o por debajo (−) del ritmo parejo a la fecha.
 * Devuelve null si el mes no tiene presupuestos.
 */
export function availableToSpend(list, budgets, month, year, today = new Date()) {
  const own = budgets.filter((b) => b.month === month && b.year === year);
  if (!own.length) return null;
  const limit = own.reduce((acc, b) => acc + b.amount, 0);
  const spent = own.reduce((acc, b) => acc + spentInCategory(list, b.categoryId), 0);
  const days = new Date(year, month + 1, 0).getDate();
  const monthKey = year * 12 + month;
  const todayKey = today.getFullYear() * 12 + today.getMonth();
  // Días del mes ya "en juego" contando hoy: todos si el mes pasó, ninguno si es futuro.
  let throughToday;
  if (monthKey < todayKey) throughToday = days;
  else if (monthKey > todayKey) throughToday = 0;
  else throughToday = today.getDate();
  const daysLeft = monthKey < todayKey ? 0 : days - Math.max(0, throughToday - 1);
  const remaining = limit - spent;
  const perDay = daysLeft > 0 ? Math.max(0, remaining) / daysLeft : 0;
  const expectedByNow = (limit * throughToday) / days;
  return { limit, spent, remaining, daysLeft, perDay, aheadOfPace: spent - expectedByNow };
}

/** Gasto de cada día del mes y su acumulado (para la gráfica 3D). */
export function dailyExpense(list, month, year) {
  const days = new Date(year, month + 1, 0).getDate();
  const out = Array.from({ length: days }, (_, i) => ({ day: i + 1, expense: 0, cumulative: 0 }));
  list.forEach((t) => {
    const d = new Date(t.date);
    if (t.type === 'EXPENSE' && d.getMonth() === month && d.getFullYear() === year)
      out[d.getDate() - 1].expense += t.amount;
  });
  let acc = 0;
  out.forEach((d) => {
    acc += d.expense;
    d.cumulative = acc;
  });
  return out;
}
