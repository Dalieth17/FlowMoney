// Perfil del usuario: datos básicos, moneda y cambio de contraseña.
const bcrypt = require('bcryptjs');
const config = require('../config');
const HttpError = require('../utils/httpError');
const userRepository = require('../repositories/userRepository');

async function getProfile(userId) {
  const user = await userRepository.findById(userId);
  // El token puede sobrevivir a un usuario borrado: tratarlo como sesión inválida.
  if (!user) throw HttpError.unauthorized('Sesión inválida');
  return user;
}

async function updateProfile(userId, { name, currency }) {
  await userRepository.updateProfile(userId, { name, currency });
  return getProfile(userId);
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const hash = await userRepository.findPasswordHash(userId);
  if (!hash) throw HttpError.unauthorized('Sesión inválida');
  // 400 (no 401): el usuario sí está autenticado, solo se equivocó de contraseña.
  if (!(await bcrypt.compare(currentPassword, hash))) {
    throw HttpError.badRequest('La contraseña actual no es correcta');
  }
  await userRepository.updatePassword(userId, await bcrypt.hash(newPassword, config.auth.bcryptRounds));
}

module.exports = { getProfile, updateProfile, changePassword };
