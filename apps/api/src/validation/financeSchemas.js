const { z } = require('zod');
const { transactionSchema, accountSchema, categorySchema, budgetSchema } = require('./schemas');

const id = z.number().int().positive();
const uuid = z.string().uuid().toLowerCase();
const amount = transactionSchema.shape.amount;
const balance = accountSchema.shape.initialBalance;
const date = transactionSchema.shape.date;
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const ms = Date.parse(`${v}T17:00:00Z`);
    return (
      Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === v && v >= '2000-01-01' && v <= '2100-12-31'
    );
  }, 'Fecha no válida');
const transfer = z
  .object({
    fromAccountId: id,
    toAccountId: id,
    amount,
    date,
    categoryId: id,
    description: transactionSchema.shape.description,
    fee: z
      .number()
      .min(0)
      .max(9999999999.99)
      .default(0)
      .transform((v) => Math.round(v * 100) / 100),
    note: transactionSchema.shape.note,
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, 'Las cuentas deben ser distintas');
const reconciliation = z.object({
  accountId: id,
  expectedBalance: balance,
  actualBalance: balance,
  categoryId: id,
  note: z.string().trim().min(1, 'Escribe el motivo del ajuste').max(200),
});
const schedule = z
  .object({
    transaction: transactionSchema.omit({ date: true }),
    startDate: day,
    endDate: day.nullable().default(null),
    dayOfMonth: z.number().int().min(1).max(31),
    active: z.boolean().default(true),
    creationKey: uuid.optional(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, 'La fecha final debe ser posterior al inicio');
const uuidParam = z.object({ id: uuid });
const storedTx = transactionSchema.extend({
  id,
  kind: z.enum(['NORMAL', 'TRANSFER', 'ADJUSTMENT']).default('NORMAL'),
  operationId: uuid.nullable().default(null),
});
const backup = z.object({
  version: z.literal(2),
  currency: z.enum(['COP', 'USD']),
  accounts: z.array(accountSchema.extend({ id })).min(1).max(1000),
  categories: z
    .array(categorySchema.extend({ id, isDefault: z.boolean() }))
    .min(1)
    .max(1000),
  transactions: z.array(storedTx).max(20000),
  budgets: z.array(budgetSchema.extend({ id })).max(20000),
  operations: z
    .array(
      z.discriminatedUnion('kind', [
        z.object({ id: uuid, kind: z.literal('TRANSFER'), data: transfer }),
        z.object({ id: uuid, kind: z.literal('RECONCILIATION'), data: reconciliation.extend({ date }) }),
      ]),
    )
    .max(20000),
  schedules: z.array(z.object({ id, data: schedule })).max(1000),
  occurrences: z
    .array(
      z.object({ scheduleId: id, period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), transactionId: id.nullable() }),
    )
    .max(20000),
});
module.exports = { transfer, reconciliation, schedule, uuidParam, backup, day };
