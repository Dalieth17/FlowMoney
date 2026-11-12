// Reglas de movimientos: la categoría y la cuenta deben pertenecer al usuario.
const HttpError = require('../utils/httpError');
const transactionRepository = require('../repositories/transactionRepository');
const categoryRepository = require('../repositories/categoryRepository');
const accountRepository = require('../repositories/accountRepository');
const { withTransaction } = require('../db/pool');

/**
 * Verifica que la categoría y la cuenta sean del usuario y las bloquea en modo compartido
 * hasta el commit: así no pueden borrarse mientras se guarda un movimiento que las usa.
 */
async function assertReferencesOwned(userId, { categoryId, accountId }, conn) {
  if (!(await categoryRepository.findOwned(categoryId, userId, conn, { lock: 'share' }))) {
    throw HttpError.badRequest('Categoría no válida');
  }
  if (accountId != null && !(await accountRepository.findOwned(accountId, userId, conn, { lock: 'share' }))) {
    throw HttpError.badRequest('Cuenta no válida');
  }
}

const list = (userId) => transactionRepository.listByUser(userId);

function create(userId, data) {
  return withTransaction(async (conn) => {
    await assertReferencesOwned(userId, data, conn);
    return transactionRepository.create(userId, data, conn);
  });
}

function update(userId, id, data) {
  return withTransaction(async (conn) => {
    if (!(await transactionRepository.findOwned(id, userId, conn))) {
      throw HttpError.notFound('Movimiento no encontrado');
    }
    await assertReferencesOwned(userId, data, conn);
    return transactionRepository.update(id, userId, data, conn);
  });
}

async function remove(userId, id) {
  if (!(await transactionRepository.remove(id, userId))) throw HttpError.notFound('Movimiento no encontrado');
}

module.exports = { list, create, update, remove };
