// Reglas de cuentas: siempre debe quedar al menos una y no se borran si tienen movimientos.
const HttpError = require('../utils/httpError');
const accountRepository = require('../repositories/accountRepository');

const list = (userId) => accountRepository.listByUser(userId);

const create = (userId, data) => accountRepository.create(userId, data);

async function update(userId, id, data) {
  if (!(await accountRepository.findOwned(id, userId))) throw HttpError.notFound('Cuenta no encontrada');
  return accountRepository.update(id, userId, data);
}

async function remove(userId, id) {
  if (!(await accountRepository.findOwned(id, userId))) throw HttpError.notFound('Cuenta no encontrada');
  if ((await accountRepository.countTransactions(id, userId)) > 0) {
    throw HttpError.conflict('La cuenta tiene movimientos');
  }
  if ((await accountRepository.countByUser(userId)) <= 1) {
    throw HttpError.conflict('Debes tener al menos una cuenta');
  }
  await accountRepository.remove(id, userId);
}

module.exports = { list, create, update, remove };
