const { z } = require('zod');
const input = z.object({
  csv: z
    .string()
    .min(1)
    .max(256 * 1024),
  currency: z.enum(['COP', 'USD']),
});
const confirmation = input.extend({
  digest: z.string().regex(/^[0-9a-f]{64}$/, 'Revisa el archivo antes de importar'),
});
module.exports = { input, confirmation };
