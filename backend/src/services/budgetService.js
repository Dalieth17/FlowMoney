// Presupuestos: un límite por categoría y mes. Un monto de 0 elimina el límite.
const HttpError = require('../utils/httpError');
const budgetRepository = require('../repositories/budgetRepository');
const categoryRepository = require('../repositories/categoryRepository');
const { withTransaction } = require('../db/pool');

const list = (userId) => budgetRepository.listByUser(userId);

/** Devuelve el presupuesto guardado, o null si se eliminó. */
async function set(userId, { categoryId, month, year, amount }) {
  return withTransaction(async (conn) => {
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

module.exports = { list, set };
