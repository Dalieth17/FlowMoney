// Exige una sesión activa en el servidor. Deja el id del usuario en req.userId.
const HttpError = require('../utils/httpError');
const { readSession } = require('../services/sessionService');

async function requireAuth(req, res, next) {
  try {
    const session = await readSession(req);
    if (!session) return next(HttpError.unauthorized('Sesión inválida o expirada'));
    req.userId = session.userId;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = requireAuth;
