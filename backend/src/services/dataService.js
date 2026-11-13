// Operaciones sobre el conjunto de datos del usuario: carga inicial y reinicio.
const { withTransaction } = require('../db/pool');
const { seedUserData } = require('../db/seed');
const userRepository = require('../repositories/userRepository');
const profileService = require('./profileService');
const categoryRepository = require('../repositories/categoryRepository');
const accountRepository = require('../repositories/accountRepository');
const transactionRepository = require('../repositories/transactionRepository');
const budgetRepository = require('../repositories/budgetRepository');

/** Todo lo que el panel necesita, en una sola respuesta. */
async function bootstrap(userId) {
  const [user, categories, accounts, transactions, budgets] = await Promise.all([
    profileService.getProfile(userId),
    categoryRepository.listByUser(userId),
    accountRepository.listByUser(userId),
    transactionRepository.listByUser(userId),
    budgetRepository.listByUser(userId),
  ]);
  return { user, categories, accounts, transactions, budgets };
}

/** Borra los datos del usuario y vuelve a sembrar el mes de ejemplo (atómico). */
async function resetToSample(userId) {
  await withTransaction(async (conn) => {
    // Orden: primero lo que referencia a categorías/cuentas.
    await transactionRepository.removeAllByUser(userId, conn);
    await budgetRepository.removeAllByUser(userId, conn);
    await categoryRepository.removeAllByUser(userId, conn);
    await accountRepository.removeAllByUser(userId, conn);
    const user = await userRepository.findById(userId, conn);
    await seedUserData(userId, conn, new Date(), user?.currency);
  });
}

module.exports = { bootstrap, resetToSample };
