// Primitivas, constantes y mapa de errores compartido para los esquemas de validación (zod).
const { z } = require('zod');

// Mensajes por defecto en español para errores de tipo/campos faltantes.
z.setErrorMap((issue, ctx) => {
  const field = issue.path.join('.') || 'dato';
  if (issue.code === z.ZodIssueCode.invalid_type) {
    return { message: issue.received === 'undefined' ? `Falta el campo ${field}` : `Valor no válido en ${field}` };
  }
  if (issue.code === z.ZodIssueCode.invalid_enum_value) return { message: `Valor no válido en ${field}` };
  return { message: ctx.defaultError };
});

/** Monedas que maneja la app: peso colombiano y dólar estadounidense (códigos ISO 4217). */
const CURRENCIES = Object.freeze(['COP', 'USD']);
const TRANSACTION_TYPES = Object.freeze(['INCOME', 'EXPENSE']);
const ACCOUNT_TYPES = Object.freeze(['CASH', 'BANK', 'SAVINGS']);
const MAX_AMOUNT = 9_999_999_999.99; // DECIMAL(12,2)
const MIN_AMOUNT = 0.01; // un céntimo: el mínimo representable en DECIMAL(12,2)

// EPSILON corrige el error binario: sin él, Math.round(0.015 * 100) da 1 (0.01) en vez de 2.
const roundCents = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const email = z.string().trim().toLowerCase().email('Correo no válido').max(160, 'Correo demasiado largo');
const password = z
  .string()
  .min(6, 'La contraseña debe tener al menos 6 caracteres')
  .max(128, 'La contraseña es demasiado larga');
const personName = z.string().trim().min(2, 'Escribe tu nombre').max(80, 'Nombre demasiado largo');
const positiveId = (msg) => z.coerce.number({ invalid_type_error: msg }).int(msg).positive(msg);
const currency = z.enum(CURRENCIES, { errorMap: () => ({ message: 'Moneda no válida' }) });
const idParamSchema = z.object({ id: positiveId('Identificador no válido') });

module.exports = {
  z,
  CURRENCIES,
  TRANSACTION_TYPES,
  ACCOUNT_TYPES,
  MAX_AMOUNT,
  MIN_AMOUNT,
  roundCents,
  email,
  password,
  personName,
  positiveId,
  currency,
  idParamSchema,
};

