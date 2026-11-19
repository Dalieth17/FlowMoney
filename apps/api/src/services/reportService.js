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
    const rows = await report.daily(userId, start(year, month - 5), start(year, month + 1), accountId, db);
    const history = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(Date.UTC(year, month - 5 + i, 1));
      const y = date.getUTCFullYear(),
        m = date.getUTCMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const sum = (type) =>
        rows.filter((r) => r.day.startsWith(key) && r.type === type).reduce((n, r) => n + cents(r.amount), 0) / 100;
      return { month: m, year: y, income: sum('INCOME'), expense: sum('EXPENSE') };
    });
    const { income, expense } = history.at(-1);
    const balance = (cents(income) - cents(expense)) / 100;
    const categoryExpenses = await report.categories(userId, start(year, month), start(year, month + 1), accountId, db);
    const activity = await report.accounts(userId, start(year, month), start(year, month + 1), accountId, db);
    return {
      month,
      year,
      currency: user.currency,
      summary: { income, expense, balance, savingRate: income > 0 ? Math.round((balance / income) * 100) : 0 },
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
