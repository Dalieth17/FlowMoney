// Esquemas de validación (zod). Definen la forma exacta de cada payload:
// lo que no pasa aquí nunca llega a los servicios.
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

const CURRENCIES = Object.freeze(['$', 'S/', 'US$', '€']);
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

// ---- Auth / perfil ----
const registerSchema = z.object({ name: personName, email, password });

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Escribe tu contraseña'),
});

const profileSchema = z.object({
  name: personName,
  currency: z.enum(CURRENCIES, { errorMap: () => ({ message: 'Moneda no válida' }) }),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Escribe tu contraseña actual'),
    newPassword: password,
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'La nueva contraseña debe ser distinta a la actual',
    path: ['newPassword'],
  });

// ---- Recursos ----
const categorySchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre').max(40, 'Nombre demasiado largo'),
  icon: z.string().trim().min(1).max(16).default('✨'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color no válido'),
});

const accountSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre a la cuenta').max(40, 'Nombre demasiado largo'),
  type: z.enum(ACCOUNT_TYPES, { errorMap: () => ({ message: 'Tipo de cuenta no válido' }) }),
  initialBalance: z.coerce
    .number({ invalid_type_error: 'Saldo inicial no válido' })
    .finite('Saldo inicial no válido')
    .min(-MAX_AMOUNT)
    .max(MAX_AMOUNT)
    .transform(roundCents)
    .default(0),
});

const transactionSchema = z.object({
  description: z.string().trim().min(1, 'Escribe una descripción').max(120, 'Descripción demasiado larga'),
  amount: z.coerce
    .number({ invalid_type_error: 'Monto no válido' })
    // Se valida ANTES de redondear: 0.001 se rechaza en vez de guardarse como 0.
    .min(MIN_AMOUNT, 'El monto mínimo es 0.01')
    .max(MAX_AMOUNT, 'Monto demasiado alto')
    .transform(roundCents),
  type: z.enum(TRANSACTION_TYPES, { errorMap: () => ({ message: 'Tipo no válido' }) }),
  categoryId: positiveId('Elige una categoría'),
  accountId: positiveId('Cuenta no válida').nullable().optional().default(null),
  date: z.coerce
    .number({ invalid_type_error: 'Fecha no válida' })
    .int('Fecha no válida')
    .nonnegative('Fecha no válida'),
  note: z.string().trim().max(200, 'Nota demasiado larga').optional().default(''),
});

const budgetSchema = z.object({
  categoryId: positiveId('Elige una categoría'),
  month: z.coerce.number().int().min(0, 'Mes no válido').max(11, 'Mes no válido'),
  year: z.coerce.number().int().min(2000, 'Año no válido').max(2100, 'Año no válido'),
  // 0 quita el límite; cualquier otro valor debe ser de al menos un céntimo (0.004 ya no borra el presupuesto).
  amount: z.coerce
    .number({ invalid_type_error: 'Límite no válido' })
    .min(0, 'El límite no puede ser negativo')
    .max(MAX_AMOUNT)
    .refine((v) => v === 0 || v >= MIN_AMOUNT, 'El límite mínimo es 0.01 (usa 0 para quitarlo)')
    .transform(roundCents),
});

const idParamSchema = z.object({ id: positiveId('Identificador no válido') });

module.exports = {
  CURRENCIES,
  TRANSACTION_TYPES,
  ACCOUNT_TYPES,
  registerSchema,
  loginSchema,
  profileSchema,
  changePasswordSchema,
  categorySchema,
  accountSchema,
  transactionSchema,
  budgetSchema,
  idParamSchema,
};
