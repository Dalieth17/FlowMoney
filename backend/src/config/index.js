// Configuración centralizada. Único lugar que lee process.env.

const env = process.env.NODE_ENV || 'development';

const toInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

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
    // Sesiones en el servidor (tabla sessions): duran 7 días o hasta cerrar sesión.
    cookieName: 'fm_session',
    cookieMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    // scrypt: N=2^15 (~32 MB, ~50-100 ms por hash) en producción; barato en tests.
    scrypt: Object.freeze({
      cost: toInt(process.env.SCRYPT_COST, env === 'test' ? 1024 : 32768),
      blockSize: 8,
      parallelization: 1,
    }),
  }),

  rateLimit: Object.freeze({
    authWindowMs: 15 * 60 * 1000,
    // Intentos de login/registro por IP en la ventana.
    authMax: toInt(process.env.AUTH_RATE_LIMIT, env === 'test' ? 1000 : 20),
  }),
});

module.exports = config;
