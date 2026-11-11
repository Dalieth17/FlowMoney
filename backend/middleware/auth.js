// middleware/auth.js — emisión y verificación de JWT en cookie httpOnly.
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const COOKIE = 'fm_token';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 días

if (SECRET === 'dev-insecure-secret-change-me') {
  console.warn('[auth] ⚠ Usando JWT_SECRET de desarrollo. Define JWT_SECRET en producción.');
}

function issueToken(res, user) {
  const token = jwt.sign({ uid: user.id, name: user.name }, SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: MAX_AGE,
    path: '/',
  });
}

function clearToken(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const payload = jwt.verify(token, SECRET);
    req.userId = payload.uid;
    req.userName = payload.name;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

module.exports = { issueToken, clearToken, requireAuth, COOKIE };
