// Presupuestos: un límite por categoría y mes. Un monto de 0 elimina el límite.
const HttpError = require('../utils/httpError');
const budgetRepository = require('../repositories/budgetRepository');
const categoryRepository = require('../repositories/categoryRepository');
const { withUserTransaction } = require('../db/pool');

const list = (userId) => budgetRepository.listByUser(userId);

/** Devuelve el presupuesto guardado, o null si se eliminó. */
async function set(userId, { categoryId, month, year, amount }) {
  return withUserTransaction(userId, async (conn) => {
    if (!(await categoryRepository.findOwned(categoryId, userId, conn, { lock: 'share' }))) {
      throw HttpError.badRequest('Categoría no válida');
    }
    if (amount <= 0) {
      await budgetRepository.remove(userId, { categoryId, month, year }, conn);
      return null;
    }
    return budgetRepository.upsert(userId, { categoryId, month, year, amount }, conn);
  });
}

async function copyPrevious(userId, target) {
  const previous = new Date(Date.UTC(target.year, target.month - 1, 1));
  const source = { month: previous.getUTCMonth(), year: previous.getUTCFullYear() };
  if (source.year < 2000) throw HttpError.badRequest('No hay un mes anterior válido para enero de 2000');
  return withUserTransaction(userId, async (db) => {
    const available = await budgetRepository.listPeriod(userId, source, db);
    const copied = await budgetRepository.copyMissing(userId, source, target, db);
    return {
      copied,
      existing: available.length - copied,
      source,
      budgets: await budgetRepository.listPeriod(userId, target, db),
    };
  });
}
module.exports = { list, set, copyPrevious };
