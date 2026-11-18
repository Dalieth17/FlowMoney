// Perfil del usuario: datos básicos, moneda y cambio de contraseña.
const HttpError = require('../utils/httpError');
const { hashPassword, verifyPassword } = require('../utils/password');
const userRepository = require('../repositories/userRepository');
const sessionRepository = require('../repositories/sessionRepository');
const { withUserTransaction, pool } = require('../db/pool');
const currencyRepository = require('../repositories/currencyRepository');
const exchangeRate = require('./exchangeRateService');
const { snapshot } = require('./backupService');
const { convertData } = require('./currencyConversion');

async function getProfile(userId, db = pool) {
  const user = await userRepository.findById(userId, db);
  // Una sesión puede sobrevivir a un usuario borrado: tratarla como inválida.
  if (!user) throw HttpError.unauthorized('Sesión inválida');
  return { ...user, lastCurrencyChange: await currencyRepository.latest(userId, db) };
}

async function updateProfile(userId, { name, currency, exchange }) {
  const quote = exchange ? await exchangeRate.validateExchange(exchange) : null;
  return withUserTransaction(userId, async (db) => {
    const user = await userRepository.findById(userId, db);
    let convertedData;
    if (exchange && exchange.fromCurrency !== user.currency)
      throw HttpError.conflict('La moneda cambió en otra solicitud. Recarga antes de convertir.');
    if (currency !== user.currency) {
      if (!quote) throw HttpError.badRequest('Para cambiar de moneda debes confirmar una tasa de cambio.');
      const before = await snapshot(userId, db);
      const after = convertData(before, currency, quote.copPerUsd);
      await currencyRepository.apply(userId, before, after, db);
      await currencyRepository.record(userId, user.currency, currency, quote, db);
      const { accounts, categories, transactions, budgets } = after;
      convertedData = { accounts, categories, transactions, budgets };
    }
    await userRepository.updateProfile(userId, { name, currency }, db);
    const updated = await getProfile(userId, db);
    return convertedData ? { ...updated, convertedData } : updated;
  });
}

/**
 * Cambia la contraseña y revoca TODAS las sesiones del usuario en la misma transacción
 * (quien la cambió recibe una sesión nueva desde la ruta).
 */
async function changePassword(userId, { currentPassword, newPassword }) {
  const hash = await userRepository.findPasswordHash(userId);
  if (!hash) throw HttpError.unauthorized('Sesión inválida');
  // 400 (no 401): el usuario sí está autenticado, solo se equivocó de contraseña.
  if (!(await verifyPassword(currentPassword, hash)).valid) {
    throw HttpError.badRequest('La contraseña actual no es correcta');
  }
  const newHash = await hashPassword(newPassword);
  await withUserTransaction(userId, async (conn) => {
    if ((await userRepository.findPasswordHash(userId, conn)) !== hash) {
      throw HttpError.badRequest('La contraseña cambió. Vuelve a intentarlo con la actual');
    }
    await userRepository.updatePassword(userId, newHash, conn);
    await sessionRepository.removeAllByUser(userId, conn);
  });
}

/**
 * Derecho de supresión (Ley 1581 de 2012, art. 8 lit. e): borra la cuenta y todos sus datos.
 * Pide la contraseña para que nadie con la sesión abierta lo haga por error.
 */
async function deleteAccount(userId, { password }) {
  const hash = await userRepository.findPasswordHash(userId);
  if (!hash) throw HttpError.unauthorized('Sesión inválida');
  if (!(await verifyPassword(password, hash)).valid) {
    throw HttpError.badRequest('La contraseña no es correcta');
  }
  await withUserTransaction(userId, async (conn) => {
    if ((await userRepository.findPasswordHash(userId, conn)) !== hash) {
      throw HttpError.badRequest('La contraseña cambió. Vuelve a intentarlo con la actual');
    }
    await userRepository.removeWithData(userId, conn);
  });
}

module.exports = { getProfile, updateProfile, changePassword, deleteAccount };
