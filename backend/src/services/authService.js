// Registro e inicio de sesión.
const bcrypt = require('bcryptjs');
const config = require('../config');
const HttpError = require('../utils/httpError');
const userRepository = require('../repositories/userRepository');
const { withTransaction } = require('../db/pool');
const { seedUserData } = require('../db/seed');

// Hash ficticio para comparar cuando el correo no existe: así el tiempo de
// respuesta no revela qué correos están registrados.
let dummyHash;
const getDummyHash = async () => (dummyHash ??= await bcrypt.hash('flowmoney-dummy', config.auth.bcryptRounds));

async function register({ name, email, password }) {
  if (await userRepository.existsByEmail(email)) {
    throw HttpError.conflict('Ese correo ya está registrado');
  }
  const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);
  try {
    return await withTransaction(async (conn) => {
      const userId = await userRepository.create({ name, email, passwordHash }, conn);
      await seedUserData(userId, conn);
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
  const hash = credentials?.passwordHash ?? (await getDummyHash());
  const valid = await bcrypt.compare(password, hash);
  if (!credentials || !valid) {
    throw HttpError.unauthorized('Correo o contraseña incorrectos');
  }
  return credentials.user;
}

module.exports = { register, login };
