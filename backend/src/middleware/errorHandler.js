// Traducción centralizada de errores a respuestas JSON { error }.
const HttpError = require('../utils/httpError');
const logger = require('../utils/logger');

function notFound(req, res, next) {
  next(HttpError.notFound('Ruta no encontrada'));
}

// Express reconoce un manejador de errores por tener 4 argumentos (aunque no use _next).
function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  // JSON mal formado en el body.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON no válido' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'La solicitud es demasiado grande' });
  }
  logger.error(`${req.method} ${req.originalUrl}:`, err);
  return res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = { notFound, errorHandler };
