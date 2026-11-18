// Valida req[source] con un esquema zod. Los datos ya limpios/convertidos
// quedan en req.valid[source]; los handlers solo leen de ahí.
const HttpError = require('../utils/httpError');

const validate =
  (schema, source = 'body') =>
  (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const message = result.error.issues[0]?.message || 'Datos no válidos';
      return next(HttpError.badRequest(message));
    }
    req.valid = { ...req.valid, [source]: result.data };
    return next();
  };

module.exports = validate;
