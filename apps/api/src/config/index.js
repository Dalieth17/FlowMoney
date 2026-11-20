// Configuración centralizada. Único lugar que lee process.env.

const env = process.env.NODE_ENV || 'development';
const path = require('node:path');
// Railway publica estos nombres; DB_* conserva prioridad para Compose y otras instalaciones.
const dbPassword = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '';

if (env === 'production') {
  const password = dbPassword;
  if (password.length < 16 || /^(flowmoney|rootpass|cambia-esta-clave)$/i.test(password)) {
    throw new Error(
      'En producción DB_PASSWORD (o MYSQLPASSWORD) debe ser una contraseña propia de al menos 16 caracteres',
    );
  }
  if (process.env.COOKIE_SECURE !== 'true') {
    throw new Error('En producción se requiere HTTPS y COOKIE_SECURE=true');
  }
}

const trustProxy = process.env.TRUST_PROXY || '0';
if (!/^[0-9]+$/.test(trustProxy)) throw new Error('TRUST_PROXY debe ser un número de proxies de confianza');

const toInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const mailHost = process.env.SMTP_HOST || (env === 'development' ? 'mailpit' : '');
const publicUrl = new URL(process.env.PUBLIC_APP_URL || `http://localhost:${process.env.WEB_PORT || 8080}`);
if (
  !['http:', 'https:'].includes(publicUrl.protocol) ||
  publicUrl.username ||
  publicUrl.password ||
  publicUrl.search ||
  publicUrl.hash ||
  publicUrl.pathname !== '/'
)
  throw new Error('PUBLIC_APP_URL debe ser el origen HTTP/HTTPS del sitio, sin ruta ni credenciales');
if (env === 'production' && mailHost && (!process.env.PUBLIC_APP_URL || publicUrl.protocol !== 'https:'))
  throw new Error('Configura PUBLIC_APP_URL con HTTPS para los enlaces de recuperación en producción');

const config = Object.freeze({
  env,
  isProduction: env === 'production',
  isTest: env === 'test',
  port: toInt(process.env.PORT, 3000),
  trustProxy: Number(trustProxy),
  web: Object.freeze({
    enabled: process.env.SERVE_WEB === 'true',
    root: path.resolve(process.env.WEB_ROOT || path.join(__dirname, '../../../web/public')),
  }),
  publicUrl: publicUrl.origin,
  mail: Object.freeze({
    enabled: Boolean(mailHost),
    host: mailHost,
    port: toInt(process.env.SMTP_PORT, 1025),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'FlowMoney <no-reply@flowmoney.local>',
  }),

  db: Object.freeze({
    host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
    port: toInt(process.env.DB_PORT || process.env.MYSQLPORT, 3306),
    user: process.env.DB_USER || process.env.MYSQLUSER || 'flowmoney',
    password: dbPassword || 'flowmoney',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'flowmoney',
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
    recoveryMax: toInt(process.env.RECOVERY_RATE_LIMIT, env === 'test' ? 1000 : 5),
  }),
});

module.exports = config;
