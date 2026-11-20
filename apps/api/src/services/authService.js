// Registro e inicio de sesión.
const HttpError = require('../utils/httpError');
const { hashPassword, verifyPassword } = require('../utils/password');
const userRepository = require('../repositories/userRepository');
const { withTransaction, withUserTransaction } = require('../db/pool');
const { createSession } = require('./sessionService');
const { initializeUserData } = require('../db/seed');
const { TERMS_VERSION } = require('../config/legal');

// Hash ficticio para comparar cuando el correo no existe: así el tiempo de
// respuesta no revela qué correos están registrados.
let dummyHash;
const getDummyHash = () => (dummyHash ??= hashPassword('flowmoney-dummy-password'));

/** Crea la cuenta. La ruta ya validó que la persona aceptó los términos (acceptTerms). */
async function register({ name, email, password, currency = 'COP' }) {
  if (await userRepository.existsByEmail(email)) {
    throw HttpError.conflict('Ese correo ya está registrado');
  }
  const passwordHash = await hashPassword(password);
  try {
    return await withTransaction(async (conn) => {
      const userId = await userRepository.create(
        { name, email, passwordHash, currency, termsVersion: TERMS_VERSION },
        conn,
      );
      await initializeUserData(userId, conn);
      const user = await userRepository.findById(userId, conn);
      const token = await createSession(userId, conn);
      return { user, token };
    });
  } catch (err) {
    // Carrera entre dos registros simultáneos con el mismo correo.
    if (err.code === 'ER_DUP_ENTRY') throw HttpError.conflict('Ese correo ya está registrado');
    throw err;
  }
}

async function login({ email, password }) {
  const credentials = await userRepository.findCredentialsByEmail(email);
  const { valid, needsRehash } = await verifyPassword(password, credentials?.passwordHash ?? (await getDummyHash()));
  if (!credentials || !valid) {
    throw HttpError.unauthorized('Correo o contraseña incorrectos');
  }
  // La criptografía costosa se hace antes del bloqueo. Se vuelve a comprobar el hash
  // bajo el mismo bloqueo que usan cambio de contraseña, borrado y creación de sesión.
  const newHash = needsRehash ? await hashPassword(password) : null;
  return withUserTransaction(credentials.user.id, async (conn) => {
    const currentHash = await userRepository.findPasswordHash(credentials.user.id, conn);
    if (currentHash !== credentials.passwordHash && !(await verifyPassword(password, currentHash)).valid)
      throw HttpError.unauthorized('Correo o contraseña incorrectos');
    // Dos logins pueden migrar el mismo bcrypt a la vez. El segundo acepta la nueva
    // representación del mismo secreto, pero nunca sobrescribe una contraseña distinta.
    if (newHash && currentHash === credentials.passwordHash)
      await userRepository.updatePassword(credentials.user.id, newHash, conn);
    const user = await userRepository.findById(credentials.user.id, conn);
    const token = await createSession(user.id, conn);
    return { user, token };
  });
}

module.exports = { register, login };
