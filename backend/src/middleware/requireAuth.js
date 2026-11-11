// Exige sesión válida. Deja el id del usuario en req.userId.
const HttpError = require('../utils/httpError');
const { readSession } = require('../utils/session');

function requireAuth(req, res, next) {
  const userId = readSession(req);
  if (!userId) return next(HttpError.unauthorized('Sesión inválida o expirada'));
  req.userId = userId;
  return next();
}

module.exports = requireAuth;
