// Error de dominio con código HTTP. Los servicios lanzan estos errores y el
// middleware de errores los traduce a respuestas JSON { error }.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }

  static badRequest(msg = 'Solicitud inválida') {
    return new HttpError(400, msg);
  }
  static unauthorized(msg = 'No autenticado') {
    return new HttpError(401, msg);
  }
  static notFound(msg = 'No encontrado') {
    return new HttpError(404, msg);
  }
  static conflict(msg = 'Conflicto') {
    return new HttpError(409, msg);
  }
}

module.exports = HttpError;
