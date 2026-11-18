// Reglas de categorías: las predeterminadas y las que tienen movimientos no se borran.
const HttpError = require('../utils/httpError');
const categoryRepository = require('../repositories/categoryRepository');
const { withUserTransaction } = require('../db/pool');
const finance = require('../repositories/financeRepository');

const list = (userId) => categoryRepository.listByUser(userId);

const create = (userId, data) =>
  withUserTransaction(userId, (db) => categoryRepository.create(userId, { ...data, isDefault: false }, db));

async function update(userId, id, data) {
  return withUserTransaction(userId, async (conn) => {
    const category = await categoryRepository.findOwned(id, userId, conn, { lock: 'update' });
    if (!category) throw HttpError.notFound('Categoría no encontrada');
    if (category.isDefault && category.name !== data.name) {
      throw HttpError.conflict('No se puede cambiar el nombre de una categoría predeterminada');
    }
    return categoryRepository.update(id, userId, data, conn);
  });
}

/** Comprobar y borrar con la categoría bloqueada (ver accountService.remove). */
async function remove(userId, id) {
  await withUserTransaction(userId, async (conn) => {
    const schedules = await finance.schedules(userId, conn);
    const operations = await finance.operations(userId, conn);
    if (operations.some((o) => o.data.categoryId === id))
      throw HttpError.conflict('La categoría figura en el historial de operaciones');
    if (schedules.some((s) => s.data.transaction.categoryId === id))
      throw HttpError.conflict('La categoría está asociada a una recurrencia');
    const category = await categoryRepository.findOwned(id, userId, conn, { lock: 'update' });
    if (!category) throw HttpError.notFound('Categoría no encontrada');
    if (category.isDefault) throw HttpError.conflict('No se pueden eliminar las categorías predeterminadas');
    if ((await categoryRepository.countTransactions(id, userId, conn)) > 0) {
      throw HttpError.conflict('La categoría tiene movimientos');
    }
    await categoryRepository.remove(id, userId, conn);
  });
}

module.exports = { list, create, update, remove };
