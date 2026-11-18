// Exige una sesión activa en el servidor. Deja el id del usuario en req.userId.
const HttpError = require('../utils/httpError');
const { readSession } = require('../services/sessionService');
const currencyContext = require('../utils/currencyContext');

async function requireAuth(req, res, next) {
  try {
    const session = await readSession(req);
    if (!session) return next(HttpError.unauthorized('Sesión inválida o expirada'));
    req.userId = session.userId;
    const currency = req.get('X-FlowMoney-Currency');
    if (currency && !['COP', 'USD'].includes(currency)) return next(HttpError.badRequest('Moneda no válida'));
    // La carga inicial obtiene la moneda del servidor antes de renovar la caché web.
    const loading = req.method === 'GET' && ['/bootstrap', '/transactions/page'].includes(req.path);
    return currencyContext.run(loading ? undefined : currency, next);
  } catch (err) {
    return next(err);
  }
}

module.exports = requireAuth;
