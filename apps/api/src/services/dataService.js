// Operaciones sobre el conjunto de datos del usuario: carga inicial y reinicio.
const { withUserTransaction } = require('../db/pool');
const { seedUserData } = require('../db/seed');
const userRepository = require('../repositories/userRepository');
const profileService = require('./profileService');
const categoryRepository = require('../repositories/categoryRepository');
const accountRepository = require('../repositories/accountRepository');
const transactionRepository = require('../repositories/transactionRepository');
const budgetRepository = require('../repositories/budgetRepository');

/** Todo lo que el panel necesita, en una sola respuesta. */
async function bootstrap(userId, { includeTransactions = true } = {}) {
  return withUserTransaction(userId, async (db) => {
    const user = await profileService.getProfile(userId, db);
    const categories = await categoryRepository.listByUser(userId, db);
    const accounts = await accountRepository.listByUser(userId, db);
    const transactions = includeTransactions ? await transactionRepository.listByUser(userId, db) : [];
    const budgets = await budgetRepository.listByUser(userId, db);
    return { user, categories, accounts, transactions, budgets };
  });
}

/** Borra los datos del usuario y vuelve a sembrar el mes de ejemplo (atómico). */
async function resetToSample(userId) {
  await withUserTransaction(userId, async (conn) => {
    // Orden: primero lo que referencia a categorías/cuentas.
    await require('./backupService').clear(userId, conn);
    const user = await userRepository.findById(userId, conn);
    await seedUserData(userId, conn, new Date(), user?.currency);
  });
}

module.exports = { bootstrap, resetToSample };
