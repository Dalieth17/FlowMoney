// Esquemas de autenticación, recuperación de contraseña y perfil de usuario.
const { z, email, password, personName, currency } = require('./commonSchemas');

// La autorización del tratamiento de datos debe ser previa, expresa e informada (Ley 1581 de 2012, art. 9).
const acceptTerms = z.literal(true, {
  errorMap: () => ({
    message: 'Para crear la cuenta debes aceptar los Términos de uso y la Política de tratamiento de datos',
  }),
});

const registerSchema = z.object({ name: personName, email, password, currency: currency.default('COP'), acceptTerms });

/** Eliminar la cuenta pide la contraseña: es irreversible. */
const deleteAccountSchema = z.object({ password: z.string().min(1, 'Escribe tu contraseña para confirmar').max(128) });

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Escribe tu contraseña').max(128),
});

const forgotPasswordSchema = z.object({ email });

const resetPasswordSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Enlace de recuperación no válido'),
  password,
});

const profileSchema = z.object({
  name: personName,
  currency,
  exchange: z
    .object({
      fromCurrency: currency,
      copPerUsd: z
        .number()
        .finite()
        .min(0.000001)
        .max(1000000)
        .refine((n) => Math.abs(n * 1e6 - Math.round(n * 1e6)) < 0.001, 'La tasa admite hasta 6 decimales'),
      source: z.enum(['automatic', 'manual']),
      quotedAt: z.string().datetime().optional(),
    })
    .optional(),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Escribe tu contraseña actual').max(128),
    newPassword: password,
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'La nueva contraseña debe ser distinta a la actual',
    path: ['newPassword'],
  });

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  profileSchema,
  changePasswordSchema,
  deleteAccountSchema,
};

