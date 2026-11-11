// Reglas de movimientos: la categoría y la cuenta deben pertenecer al usuario.
const HttpError = require('../utils/httpError');
const transactionRepository = require('../repositories/transactionRepository');
const categoryRepository = require('../repositories/categoryRepository');
const accountRepository = require('../repositories/accountRepository');

async function assertReferencesOwned(userId, { categoryId, accountId }) {
  if (!(await categoryRepository.findOwned(categoryId, userId))) {
    throw HttpError.badRequest('Categoría no válida');
  }
  if (accountId != null && !(await accountRepository.findOwned(accountId, userId))) {
    throw HttpError.badRequest('Cuenta no válida');
  }
}

const list = (userId) => transactionRepository.listByUser(userId);

async function create(userId, data) {
  await assertReferencesOwned(userId, data);
  return transactionRepository.create(userId, data);
}

async function update(userId, id, data) {
  if (!(await transactionRepository.findOwned(id, userId))) throw HttpError.notFound('Movimiento no encontrado');
  await assertReferencesOwned(userId, data);
  return transactionRepository.update(id, userId, data);
}

async function remove(userId, id) {
  if (!(await transactionRepository.remove(id, userId))) throw HttpError.notFound('Movimiento no encontrado');
}

module.exports = { list, create, update, remove };
