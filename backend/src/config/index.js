// Configuración centralizada. Único lugar que lee process.env.
const crypto = require('node:crypto');

const env = process.env.NODE_ENV || 'development';

const toInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

// Sin JWT_SECRET generamos uno aleatorio: es seguro, pero las sesiones
// se invalidan en cada reinicio. En producción conviene fijarlo en .env.
const jwtSecretFromEnv = process.env.JWT_SECRET;
const jwtSecret = jwtSecretFromEnv || crypto.randomBytes(32).toString('hex');

const config = Object.freeze({
  env,
  isProduction: env === 'production',
  isTest: env === 'test',
  port: toInt(process.env.PORT, 3000),

  db: Object.freeze({
    host: process.env.DB_HOST || 'localhost',
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'flowmoney',
    password: process.env.DB_PASSWORD || 'flowmoney',
    database: process.env.DB_NAME || 'flowmoney',
    connectionLimit: toInt(process.env.DB_POOL_SIZE, 10),
  }),

  auth: Object.freeze({
    jwtSecret,
    jwtSecretIsEphemeral: !jwtSecretFromEnv,
    tokenTtl: '7d',
    cookieName: 'fm_token',
    cookieMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    bcryptRounds: toInt(process.env.BCRYPT_ROUNDS, env === 'test' ? 4 : 10),
  }),

  rateLimit: Object.freeze({
    authWindowMs: 15 * 60 * 1000,
    // Intentos de login/registro por IP en la ventana.
    authMax: toInt(process.env.AUTH_RATE_LIMIT, env === 'test' ? 1000 : 20),
  }),
});

module.exports = config;
