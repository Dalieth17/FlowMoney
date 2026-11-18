import { isoDate } from '../core/format.js';
export function goalProgress(goal, entries, now = Date.now()) {
  const cents = entries
    .filter((e) => e.goalId === goal.id)
    .reduce((n, e) => n + (e.data.type === 'ADD' ? 1n : -1n) * BigInt(Math.round(e.data.amount * 100)), 0n);
  const saved = Number(cents) / 100;
  const remaining = Math.max(0, Math.round(goal.data.target * 100) - Number(cents)) / 100;
  const day = isoDate(now);
  const days = goal.data.deadline
    ? Math.floor((Date.parse(`${goal.data.deadline}T17:00:00Z`) - Date.parse(`${day}T17:00:00Z`)) / 86400000)
    : null;
  return {
    saved,
    remaining,
    percent: Math.min(100, Math.floor((saved / goal.data.target) * 100)),
    complete: remaining === 0,
    overdue: remaining > 0 && days !== null && days < 0,
    daily: days !== null && days >= 0 ? Math.ceil((remaining * 100) / (days + 1)) / 100 : null,
  };
}
