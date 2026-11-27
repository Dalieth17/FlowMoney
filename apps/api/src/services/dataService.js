// Operaciones sobre el conjunto de datos del usuario: carga inicial y reinicio.
const { withUserTransaction } = require('../db/pool');
const { initializeUserData } = require('../db/seed');
const profileService = require('./profileService');
const categoryRepository = require('../repositories/categoryRepository');
const accountRepository = require('../repositories/accountRepository');
const transactionRepository = require('../repositories/transactionRepository');
const budgetRepository = require('../repositories/budgetRepository');

/** Todo lo que el panel necesita, en una sola respuesta. */
async function bootstrap(userId, { includeTransactions = true, period } = {}) {
  return withUserTransaction(userId, async (db) => {
    const user = await profileService.getProfile(userId, db);
    const categories = await categoryRepository.listByUser(userId, db);
    const accounts = await accountRepository.listByUser(userId, db);
    const budgets = await budgetRepository.listByUser(userId, db);
    if (period)
      return {
        user,
        categories,
        accounts,
        budgets,
        transactions: await transactionRepository.listMonth(userId, period, db),
        transactionSummary: await transactionRepository.summaryByUser(userId, db),
      };
    const transactions = includeTransactions ? await transactionRepository.listByUser(userId, db) : [];
    return { user, categories, accounts, transactions, budgets };
  });
}

/** Borra los datos financieros y deja categorías y cuentas en cero (atómico). */
async function resetData(userId) {
  await withUserTransaction(userId, async (conn) => {
    // Orden: primero lo que referencia a categorías/cuentas.
    await require('./backupService').clear(userId, conn);
    await initializeUserData(userId, conn);
  });
}

module.exports = { bootstrap, resetData };
