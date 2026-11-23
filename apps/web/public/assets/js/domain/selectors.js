// Cálculos financieros puros: reciben arreglos, devuelven datos derivados.
// No tocan el DOM ni el store, así se prueban fácilmente.

import { weekOfMonth, weeksInMonth, transactionDate } from '../core/format.js';

export const BUDGET_WARNING_PCT = 80;

const sum = (list) => list.reduce((acc, t) => acc + Math.round(t.amount * 100), 0) / 100;
export const isOperating = (t) => !t.kind || t.kind === 'NORMAL';

// Primer instante del día siguiente en Bogotá a partir de una fecha civil.
const nextDayStart = (day) => Date.UTC(day.getFullYear(), day.getMonth(), day.getDate() + 1, 5);

export function inMonth(transactions, month, year) {
  return transactions
    .filter((t) => {
      const d = transactionDate(t.date);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .sort((a, b) => b.date - a.date || b.id - a.id);
}

export function totals(list) {
  const income = sum(list.filter((t) => isOperating(t) && t.type === 'INCOME'));
  const expense = sum(list.filter((t) => isOperating(t) && t.type === 'EXPENSE'));
  return { income, expense, balance: Math.round((income - expense) * 100) / 100 };
}

export const savingRate = ({ income, balance }) => (income > 0 ? Math.round((balance / income) * 100) : 0);

export const spentInCategory = (list, categoryId) =>
  sum(list.filter((t) => isOperating(t) && t.type === 'EXPENSE' && t.categoryId === categoryId));

/** Gasto agrupado por categoría, de mayor a menor. */
export function expenseByCategory(list, categories) {
  const byId = new Map();
  list
    .filter((t) => isOperating(t) && t.type === 'EXPENSE')
    .forEach((t) => byId.set(t.categoryId, (byId.get(t.categoryId) || 0) + Math.round(t.amount * 100)));
  return [...byId.entries()]
    .map(([id, cents]) => ({ category: categories.find((c) => c.id === id), value: cents / 100 }))
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
    if (!isOperating(t)) return;
    const week = weeks[weekOfMonth(t.date) - 1];
    if (week) week[t.type === 'INCOME' ? 'income' : 'expense'] += Math.round(t.amount * 100);
  });
  return weeks.map((w) => ({ ...w, income: w.income / 100, expense: w.expense / 100 }));
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
  if (pct >= 100) return { pct, level: 'over', label: pct === 100 ? 'Límite alcanzado' : 'Presupuesto superado' };
  if (pct >= BUDGET_WARNING_PCT) return { pct, level: 'warn', label: 'Cerca del límite' };
  return { pct, level: 'ok', label: 'En control' };
}

/** Saldo de cada cuenta: saldo inicial + ingresos − gastos (histórico). */
export function accountBalances(accounts, transactions, now = Date.now()) {
  const tomorrow = nextDayStart(transactionDate(now));
  const sums = new Map(
    accounts.map((a) => [
      a.id,
      { current: Math.round(a.initialBalance * 100), projected: Math.round(a.initialBalance * 100), count: 0 },
    ]),
  );
  for (const tx of transactions) {
    const sum = sums.get(tx.accountId);
    if (!sum) continue;
    const delta = (tx.type === 'INCOME' ? 1 : -1) * Math.round(tx.amount * 100);
    sum.projected += delta;
    if (tx.date < tomorrow) sum.current += delta;
    sum.count++;
  }
  return accounts.map((account) => {
    const sum = sums.get(account.id);
    return {
      account,
      balance: sum.current / 100,
      projectedBalance: sum.projected / 100,
      count: sum.count,
    };
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
export function availableToSpend(list, budgets, month, year, today = transactionDate()) {
  const own = budgets.filter((b) => b.month === month && b.year === year);
  if (!own.length) return null;
  const limitCents = own.reduce((total, b) => total + Math.round(b.amount * 100), 0);
  const categories = new Set(own.map((b) => b.categoryId));
  const tomorrow = nextDayStart(today);
  let spentCents = 0;
  let spentToDateCents = 0;
  for (const tx of list) {
    if (tx.type !== 'EXPENSE' || !isOperating(tx) || !categories.has(tx.categoryId)) continue;
    const cents = Math.round(tx.amount * 100);
    spentCents += cents;
    if (tx.date < tomorrow) spentToDateCents += cents;
  }
  const days = new Date(year, month + 1, 0).getDate();
  const monthKey = year * 12 + month;
  const todayKey = today.getFullYear() * 12 + today.getMonth();
  // Días del mes ya "en juego" contando hoy: todos si el mes pasó, ninguno si es futuro.
  let throughToday;
  if (monthKey < todayKey) throughToday = days;
  else if (monthKey > todayKey) throughToday = 0;
  else throughToday = today.getDate();
  const daysLeft = monthKey < todayKey ? 0 : days - Math.max(0, throughToday - 1);
  const remainingCents = limitCents - spentCents;
  const expectedCents = Math.round((limitCents * throughToday) / days);
  return {
    limit: limitCents / 100,
    spent: spentCents / 100,
    remaining: remainingCents / 100,
    daysLeft,
    perDay: daysLeft > 0 ? Math.floor(Math.max(0, remainingCents) / daysLeft) / 100 : 0,
    aheadOfPace: (spentToDateCents - expectedCents) / 100,
  };
}

/** Gasto de cada día del mes y su acumulado (para la gráfica 3D). */
export function dailyExpense(list, month, year) {
  const days = new Date(year, month + 1, 0).getDate();
  const out = Array.from({ length: days }, (_, i) => ({ day: i + 1, expense: 0, cumulative: 0 }));
  list.forEach((t) => {
    const d = transactionDate(t.date);
    if (isOperating(t) && t.type === 'EXPENSE' && d.getMonth() === month && d.getFullYear() === year)
      out[d.getDate() - 1].expense += Math.round(t.amount * 100);
  });
  let acc = 0;
  out.forEach((d) => {
    acc += d.expense;
    d.expense /= 100;
    d.cumulative = acc / 100;
  });
  return out;
}
