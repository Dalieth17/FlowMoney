// Modelo compartido por las barras 3D, el gráfico SVG y la tabla accesible.
import { dailyExpense } from './selectors.js';
import { MONTHS_SHORT, transactionDate } from '../core/format.js';

export function spendingChart(transactions, month, year, today = transactionDate()) {
  const todayKey = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const days = dailyExpense(transactions, month, year).map((day) => ({
    ...day,
    label: `${day.day} ${MONTHS_SHORT[month].toLowerCase()}`,
    scheduled: year * 10000 + (month + 1) * 100 + day.day > todayKey,
  }));
  const total = days.at(-1).cumulative;
  const scheduled = days.filter((d) => d.scheduled).reduce((n, d) => n + Math.round(d.expense * 100), 0) / 100;
  const max = Math.max(...days.map((d) => d.expense));
  // Escala monetaria visible, también para importes menores a un dólar.
  const raw = (max || 1) / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const factor = [1, 2, 5, 10].find((n) => n >= raw / power) ?? 10;
  const stepCents = Math.max(1, Math.round(factor * power * 100));
  const topCents = Math.max(stepCents, Math.ceil(Math.round(max * 100) / stepCents) * stepCents);
  return {
    days,
    total,
    spent: Math.round((total - scheduled) * 100) / 100,
    scheduled,
    max,
    top: topCents / 100,
    ticks: Array.from({ length: topCents / stepCents + 1 }, (_, i) => (i * stepCents) / 100),
  };
}

export const dayTick = (day, count) => day === 1 || day % 5 === 0 || day === count;
