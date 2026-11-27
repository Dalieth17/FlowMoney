// Esquemas de recursos financieros principales: categorías, cuentas, movimientos, presupuestos y reportes.
const {
  z,
  TRANSACTION_TYPES,
  ACCOUNT_TYPES,
  MAX_AMOUNT,
  MIN_AMOUNT,
  roundCents,
  positiveId,
  currency,
} = require('./commonSchemas');

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
    .min(Date.UTC(2000, 0, 1), 'La fecha debe estar entre 2000 y 2100')
    .max(Date.UTC(2101, 0, 1) - 1, 'La fecha debe estar entre 2000 y 2100'),
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

const copyBudgetSchema = budgetSchema.pick({ month: true, year: true });

const transactionQuerySchema = z
  .object({
    currency: currency.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
    beforeId: positiveId('Cursor no válido').optional(),
    from: z.coerce
      .number()
      .int()
      .min(Date.UTC(2000, 0, 1))
      .max(Date.UTC(2101, 0, 1) - 1)
      .optional(),
    to: z.coerce
      .number()
      .int()
      .min(Date.UTC(2000, 0, 1))
      .max(Date.UTC(2101, 0, 1) - 1)
      .optional(),
  })
  .refine((q) => q.from == null || q.to == null || q.from <= q.to, 'Rango de fechas no válido');

const monthlyReportQuery = z.object({
  month: z.coerce.number().int().min(0).max(11),
  year: z.coerce.number().int().min(2000).max(2100),
  accountId: z.union([z.literal('none'), positiveId('Cuenta no válida')]).optional(),
});

module.exports = {
  categorySchema,
  accountSchema,
  transactionSchema,
  budgetSchema,
  copyBudgetSchema,
  transactionQuerySchema,
  monthlyReportQuery,
};

