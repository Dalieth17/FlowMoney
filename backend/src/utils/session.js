// Sesión basada en JWT guardado en una cookie httpOnly (no accesible desde JS,
// lo que mitiga robo de sesión por XSS). sameSite=lax mitiga CSRF.
const jwt = require('jsonwebtoken');
const config = require('../config');

const { jwtSecret, tokenTtl, cookieName, cookieMaxAgeMs, cookieSecure } = config.auth;

const cookieOptions = Object.freeze({
  httpOnly: true,
  sameSite: 'lax',
  secure: cookieSecure,
  path: '/',
});

function startSession(res, user) {
  const token = jwt.sign({ sub: String(user.id) }, jwtSecret, { expiresIn: tokenTtl });
  res.cookie(cookieName, token, { ...cookieOptions, maxAge: cookieMaxAgeMs });
}

function endSession(res) {
  res.clearCookie(cookieName, cookieOptions);
}

/** Devuelve el id de usuario del token o null si falta/no es válido. */
function readSession(req) {
  const token = req.cookies?.[cookieName];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtSecret);
    const userId = Number(payload.sub);
    return Number.isInteger(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
}

module.exports = { startSession, endSession, readSession };
