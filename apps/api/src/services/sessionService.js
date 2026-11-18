// Sesiones opacas y revocables en el servidor.
// - La cookie (httpOnly, SameSite=Lax) lleva un token aleatorio de 256 bits.
// - En la base de datos solo se guarda su SHA-256: un volcado de la tabla no sirve para entrar.
// - Cerrar sesión o cambiar la contraseña borra filas: la cookie copiada deja de funcionar al instante.
const crypto = require('node:crypto');
const config = require('../config');
const sessionRepository = require('../repositories/sessionRepository');

const { cookieName, cookieMaxAgeMs, cookieSecure } = config.auth;
const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/; // 32 bytes en base64url
const TTL_SECONDS = Math.floor(cookieMaxAgeMs / 1000);

const cookieOptions = Object.freeze({ httpOnly: true, sameSite: 'lax', secure: cookieSecure, path: '/' });

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Hash del token de la cookie, o null si no hay cookie o su formato no es válido (sin tocar la BD). */
function tokenHashFrom(req) {
  const token = req.cookies?.[cookieName];
  return typeof token === 'string' && TOKEN_PATTERN.test(token) ? hashToken(token) : null;
}

/** Crea una sesión y la entrega en la cookie. Acepta una conexión para usarse dentro de una transacción. */
async function startSession(res, userId, db) {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
  await sessionRepository.removeExpiredByUser(userId, db);
  await sessionRepository.create({ tokenHash: hashToken(token), userId, ttlSeconds: TTL_SECONDS }, db);
  res.cookie(cookieName, token, { ...cookieOptions, maxAge: cookieMaxAgeMs });
}

/** { userId, tokenHash } de una sesión activa, o null. */
async function readSession(req) {
  const tokenHash = tokenHashFrom(req);
  if (!tokenHash) return null;
  const userId = await sessionRepository.findActiveUserId(tokenHash);
  return userId ? { userId, tokenHash } : null;
}

async function endSession(req, res) {
  const tokenHash = tokenHashFrom(req);
  if (tokenHash) await sessionRepository.remove(tokenHash);
  res.clearCookie(cookieName, cookieOptions);
}

module.exports = { startSession, readSession, endSession };
