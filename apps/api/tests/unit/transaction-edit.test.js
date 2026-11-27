const { test } = require('node:test');
const assert = require('node:assert/strict');
const { transactionSchema, transactionUpdateSchema } = require('../../src/validation/schemas');

const original = {
  description: ' Original ',
  amount: 12.25,
  type: 'EXPENSE',
  date: Date.UTC(2024, 0, 1, 10),
  accountId: null,
  categoryId: 1,
  note: '',
};

test('el PUT conserva la copia original literal y sigue admitiendo el formato anterior', () => {
  const draft = { ...original, amount: '14.50' };
  const legacy = transactionSchema.parse(draft);
  assert.deepEqual(transactionUpdateSchema.parse(draft), legacy);
  assert.deepEqual(transactionUpdateSchema.parse({ ...draft, expected: original }), { ...legacy, expected: original });
  assert.deepEqual(transactionSchema.parse({ ...draft, expected: original }), legacy);
});

test('una copia parcial o nula no se interpreta como una edición sin comprobación', () => {
  for (const key of Object.keys(original)) {
    const expected = { ...original };
    delete expected[key];
    assert.equal(transactionUpdateSchema.safeParse({ ...original, expected }).success, false, key);
  }
  assert.equal(transactionUpdateSchema.safeParse({ ...original, expected: null }).success, false);
});
