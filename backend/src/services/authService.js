// Registro e inicio de sesión.
const HttpError = require('../utils/httpError');
const { hashPassword, verifyPassword } = require('../utils/password');
const userRepository = require('../repositories/userRepository');
const { withTransaction } = require('../db/pool');
const { seedUserData } = require('../db/seed');

// Hash ficticio para comparar cuando el correo no existe: así el tiempo de
// respuesta no revela qué correos están registrados.
let dummyHash;
const getDummyHash = async () => (dummyHash ??= await hashPassword('flowmoney-dummy-password'));

async function register({ name, email, password, currency = 'COP' }) {
  if (await userRepository.existsByEmail(email)) {
    throw HttpError.conflict('Ese correo ya está registrado');
  }
  const passwordHash = await hashPassword(password);
  try {
    return await withTransaction(async (conn) => {
      const userId = await userRepository.create({ name, email, passwordHash, currency }, conn);
      await seedUserData(userId, conn, new Date(), currency);
      return userRepository.findById(userId, conn);
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
  // Migración transparente: hashes antiguos (bcrypt) o con parámetros viejos se renuevan.
  if (needsRehash) {
    await userRepository.updatePassword(credentials.user.id, await hashPassword(password));
  }
  return credentials.user;
}

module.exports = { register, login };
