// Envuelve un handler async para que los errores lleguen a next() sin try/catch.
// (Express 4 no captura promesas rechazadas por sí solo.)
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
