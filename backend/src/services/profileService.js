// Perfil del usuario: datos básicos, moneda y cambio de contraseña.
const HttpError = require('../utils/httpError');
const { hashPassword, verifyPassword } = require('../utils/password');
const userRepository = require('../repositories/userRepository');
const sessionRepository = require('../repositories/sessionRepository');
const { withTransaction } = require('../db/pool');

async function getProfile(userId) {
  const user = await userRepository.findById(userId);
  // Una sesión puede sobrevivir a un usuario borrado: tratarla como inválida.
  if (!user) throw HttpError.unauthorized('Sesión inválida');
  return user;
}

async function updateProfile(userId, { name, currency }) {
  await userRepository.updateProfile(userId, { name, currency });
  return getProfile(userId);
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
  await withTransaction(async (conn) => {
    await userRepository.updatePassword(userId, newHash, conn);
    await sessionRepository.removeAllByUser(userId, conn);
  });
}

module.exports = { getProfile, updateProfile, changePassword };
