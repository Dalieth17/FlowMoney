// Hash de contraseñas con scrypt (incluido en Node, sin límite de longitud).
//
// Por qué no bcrypt: bcrypt ignora todo lo que pase de 72 bytes, así que dos
// contraseñas con los mismos primeros 72 bytes serían equivalentes.
//
// Formato guardado: scrypt$N$r$p$<sal base64>$<hash base64>. Los parámetros viajan
// con el hash, así se pueden endurecer en el futuro sin romper cuentas existentes.
// Los hashes bcrypt antiguos ($2…) se siguen aceptando y se reemplazan al iniciar sesión.
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const bcrypt = require('bcryptjs');
const config = require('../config');

const scrypt = promisify(crypto.scrypt);

const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const BCRYPT_MAX_BYTES = 72;
const { cost: N, blockSize: r, parallelization: p } = config.auth.scrypt;

// Memoria que necesita scrypt: 128 · N · r bytes (+ margen).
const maxmemFor = (n, blockSize) => 128 * n * blockSize * 2;

// NFC: la misma contraseña escrita con distintos teclados ("ñ" compuesta o "n"+"~") es igual.
const normalize = (password) => password.normalize('NFC');

async function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = await scrypt(normalize(password), salt, KEY_LENGTH, { N, r, p, maxmem: maxmemFor(N, r) });
  return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
}

async function verifyScrypt(password, stored) {
  const [, n, blockSize, par, saltB64, keyB64] = stored.split('$');
  const params = { N: Number(n), r: Number(blockSize), p: Number(par) };
  if (![params.N, params.r, params.p].every(Number.isSafeInteger) || !saltB64 || !keyB64) {
    return { valid: false, needsRehash: false };
  }
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(normalize(password), Buffer.from(saltB64, 'base64'), expected.length, {
    ...params,
    maxmem: maxmemFor(params.N, params.r),
  });
  const valid = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  const needsRehash = params.N !== N || params.r !== r || params.p !== p;
  return { valid, needsRehash };
}

async function verifyLegacyBcrypt(password, stored) {
  // bcrypt no distingue lo que pasa de 72 bytes: una entrada más larga no puede validarse con certeza.
  if (Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_BYTES) return { valid: false, needsRehash: false };
  return { valid: await bcrypt.compare(password, stored), needsRehash: true };
}

/**
 * Comprueba una contraseña contra el hash guardado.
 * @returns {Promise<{ valid: boolean, needsRehash: boolean }>}
 */
async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return { valid: false, needsRehash: false };
  if (stored.startsWith('scrypt$')) return verifyScrypt(password, stored);
  if (stored.startsWith('$2')) return verifyLegacyBcrypt(password, stored);
  return { valid: false, needsRehash: false };
}

module.exports = { hashPassword, verifyPassword, BCRYPT_MAX_BYTES };
