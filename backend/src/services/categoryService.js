// Reglas de categorías: las predeterminadas y las que tienen movimientos no se borran.
const HttpError = require('../utils/httpError');
const categoryRepository = require('../repositories/categoryRepository');
const { withTransaction } = require('../db/pool');

const list = (userId) => categoryRepository.listByUser(userId);

const create = (userId, data) => categoryRepository.create(userId, { ...data, isDefault: false });

async function update(userId, id, data) {
  if (!(await categoryRepository.findOwned(id, userId))) throw HttpError.notFound('Categoría no encontrada');
  return categoryRepository.update(id, userId, data);
}

/** Comprobar y borrar con la categoría bloqueada (ver accountService.remove). */
async function remove(userId, id) {
  await withTransaction(async (conn) => {
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
