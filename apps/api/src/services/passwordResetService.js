const crypto = require('node:crypto');
const config = require('../config');
const { withUserTransaction } = require('../db/pool');
const users = require('../repositories/userRepository');
const resets = require('../repositories/passwordResetRepository');
const sessions = require('../repositories/sessionRepository');
const mail = require('./mailService');
const { hashPassword } = require('../utils/password');
const HttpError = require('../utils/httpError');
const logger = require('../utils/logger');
const digest = (token) => crypto.createHash('sha256').update(token).digest('hex');
const MESSAGE =
  'Si existe una cuenta con ese correo, recibirás un enlace para cambiar tu contraseña. Revisa también la carpeta de spam.';

async function requestReset(email) {
  if (!config.mail.enabled)
    throw new HttpError(503, 'La recuperación por correo no está configurada. Contacta al administrador.');
  const credentials = await users.findCredentialsByEmail(email);
  if (!credentials) return { message: MESSAGE };
  const userId = credentials.user.id;
  const issued = await withUserTransaction(userId, async (db) => {
    if (await resets.coolingDown(userId, db)) return null;
    const token = crypto.randomBytes(32).toString('base64url');
    await resets.save(userId, digest(token), db);
    return token;
  }).catch((err) => {
    // Una eliminación concurrente conserva la misma respuesta pública.
    if (err.status === 401) return null;
    throw err;
  });
  if (issued) {
    // SMTP no bloquea la respuesta ni revela si el correo está registrado.
    const link = `${config.publicUrl}/recover.html#token=${issued}`;
    Promise.resolve()
      .then(() => mail.sendPasswordReset(email, link))
      .catch(async () => {
        logger.error('No se pudo entregar un correo de recuperación. Revisa la conexión SMTP.');
        await resets
          .removeToken(userId, digest(issued))
          .catch(() => logger.error('No se pudo invalidar un enlace no entregado.'));
      });
  }
  return { message: MESSAGE };
}

async function resetPassword(token, password) {
  const tokenHash = digest(token);
  const record = await resets.findActive(tokenHash);
  const invalid = () =>
    HttpError.badRequest('El enlace no es válido, ya fue utilizado o ha caducado. Solicita uno nuevo.');
  if (!record) throw invalid();
  const newHash = await hashPassword(password);
  await withUserTransaction(record.userId, async (db) => {
    if (!(await resets.findActive(tokenHash, db))) throw invalid();
    await users.updatePassword(record.userId, newHash, db);
    await sessions.removeAllByUser(record.userId, db);
    await resets.removeByUser(record.userId, db);
  }).catch((err) => {
    if (err.status === 401) throw invalid();
    throw err;
  });
  return { message: 'Contraseña actualizada. Ya puedes iniciar sesión con tu nueva contraseña.' };
}
module.exports = { requestReset, resetPassword };
