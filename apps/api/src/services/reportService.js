const { withUserTransaction } = require('../db/pool');
const users = require('../repositories/userRepository');
const accounts = require('../repositories/accountRepository');
const report = require('../repositories/reportRepository');
const HttpError = require('../utils/httpError');
const cents = (n) => Math.round(Number(n) * 100);
const start = (year, month) => Date.UTC(year, month, 1, 5);

async function monthly(userId, { month, year, accountId }) {
  return withUserTransaction(userId, async (db) => {
    if (typeof accountId === 'number' && !(await accounts.findOwned(accountId, userId, db)))
      throw HttpError.notFound('Cuenta no encontrada');
    const user = await users.findById(userId, db);
    const owned = await accounts.listByUser(userId, db);
    const rows = await report.monthlyTotals(userId, start(year, month - 5), start(year, month + 1), accountId, db);
    const byPeriod = new Map();
    for (const row of rows) {
      const totals = byPeriod.get(row.period) ?? { income: 0, expense: 0 };
      totals[row.type === 'INCOME' ? 'income' : 'expense'] = Number(row.amount);
      byPeriod.set(row.period, totals);
    }
    const periodKey = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;
    const history = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(Date.UTC(year, month - 5 + i, 1));
      const y = date.getUTCFullYear(),
        m = date.getUTCMonth();
      return { month: m, year: y, ...(byPeriod.get(periodKey(y, m)) ?? { income: 0, expense: 0 }) };
    });
    const { income, expense } = history.at(-1);
    const balance = (cents(income) - cents(expense)) / 100;
    const previous = history.at(-2);
    const hasPrevious = byPeriod.has(periodKey(previous.year, previous.month));
    const hasCurrent = byPeriod.has(periodKey(year, month));
    const incomeChange = cents(income) - cents(previous.income);
    const expenseChange = cents(expense) - cents(previous.expense);
    const comparison = {
      hasPrevious,
      hasCurrent,
      change:
        hasPrevious && hasCurrent
          ? {
              income: incomeChange / 100,
              expense: expenseChange / 100,
              balance: (incomeChange - expenseChange) / 100,
            }
          : null,
    };
    const categoryExpenses = await report.categories(userId, start(year, month), start(year, month + 1), accountId, db);
    const activity = await report.accounts(userId, start(year, month), start(year, month + 1), accountId, db);
    return {
      month,
      year,
      currency: user.currency,
      summary: { income, expense, balance, savingRate: income > 0 ? Math.round((balance / income) * 100) : 0 },
      comparison,
      categories: categoryExpenses,
      history,
      accounts: activity.map((r) => ({
        ...r,
        label: r.accountId == null ? 'Sin cuenta' : (owned.find((a) => a.id === r.accountId)?.name ?? 'Cuenta'),
      })),
    };
  });
}
module.exports = { monthly };
