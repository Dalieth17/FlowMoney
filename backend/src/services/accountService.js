// Reglas de cuentas: siempre debe quedar al menos una y no se borran si tienen movimientos.
const HttpError = require('../utils/httpError');
const accountRepository = require('../repositories/accountRepository');
const { withTransaction } = require('../db/pool');

const list = (userId) => accountRepository.listByUser(userId);

const create = (userId, data) => accountRepository.create(userId, data);

async function update(userId, id, data) {
  if (!(await accountRepository.findOwned(id, userId))) throw HttpError.notFound('Cuenta no encontrada');
  return accountRepository.update(id, userId, data);
}

/**
 * Comprobar y borrar ocurre en UNA transacción con las cuentas del usuario bloqueadas:
 * si llegan dos borrados a la vez, el segundo espera y ve el estado ya actualizado
 * (antes, ambos veían "2 cuentas" y borraban las dos).
 */
async function remove(userId, id) {
  await withTransaction(async (conn) => {
    const accountIds = await accountRepository.lockAllByUser(userId, conn);
    if (!accountIds.includes(id)) throw HttpError.notFound('Cuenta no encontrada');
    if ((await accountRepository.countTransactions(id, userId, conn)) > 0) {
      throw HttpError.conflict('La cuenta tiene movimientos');
    }
    if (accountIds.length <= 1) throw HttpError.conflict('Debes tener al menos una cuenta');
    await accountRepository.remove(id, userId, conn);
  });
}

module.exports = { list, create, update, remove };
