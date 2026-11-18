const { z } = require('zod');
const { day } = require('./financeSchemas');
const { transactionSchema } = require('./schemas');
const uuid = z.string().uuid().toLowerCase();
const goal = z.object({
  name: z.string().trim().min(1).max(80),
  target: transactionSchema.shape.amount,
  deadline: day.nullable().default(null),
  archived: z.boolean().default(false),
});
const entry = z.object({
  amount: transactionSchema.shape.amount,
  type: z.enum(['ADD', 'WITHDRAW']),
  date: day,
  note: z.string().trim().max(200).default(''),
});
const params = z.object({ id: uuid });
const entryParams = z.object({ id: uuid, entryId: uuid });
module.exports = { goal, entry, params, entryParams, uuid };
