// Reglas de cuentas: siempre debe quedar al menos una y no se borran si tienen movimientos.
const HttpError = require('../utils/httpError');
const accountRepository = require('../repositories/accountRepository');
const { withUserTransaction } = require('../db/pool');
const finance = require('../repositories/financeRepository');

const list = (userId) => accountRepository.listByUser(userId);

const create = (userId, data) => withUserTransaction(userId, (db) => accountRepository.create(userId, data, db));

async function update(userId, id, data) {
  return withUserTransaction(userId, async (db) => {
    if (!(await accountRepository.findOwned(id, userId, db))) throw HttpError.notFound('Cuenta no encontrada');
    return accountRepository.update(id, userId, data, db);
  });
}

/**
 * Comprobar y borrar ocurre en UNA transacción con las cuentas del usuario bloqueadas:
 * si llegan dos borrados a la vez, el segundo espera y ve el estado ya actualizado
 * (antes, ambos veían "2 cuentas" y borraban las dos).
 */
async function remove(userId, id) {
  await withUserTransaction(userId, async (conn) => {
    const schedules = await finance.schedules(userId, conn);
    const operations = await finance.operations(userId, conn);
    if (operations.some((o) => [o.data.accountId, o.data.fromAccountId, o.data.toAccountId].includes(id)))
      throw HttpError.conflict('La cuenta figura en el historial de operaciones');
    if (schedules.some((s) => s.data.transaction.accountId === id))
      throw HttpError.conflict('La cuenta está asociada a una recurrencia');
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
