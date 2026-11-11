require('../helpers');
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  registerSchema,
  transactionSchema,
  budgetSchema,
  categorySchema,
  profileSchema,
  changePasswordSchema,
} = require('../../src/validation/schemas');

const firstError = (result) => result.error.issues[0].message;

describe('registerSchema', () => {
  test('normaliza el correo (trim + minúsculas)', () => {
    const r = registerSchema.parse({ name: ' Ana ', email: '  ANA@Mail.COM ', password: 'secret123' });
    assert.equal(r.email, 'ana@mail.com');
    assert.equal(r.name, 'Ana');
  });

  test('rechaza contraseñas cortas con mensaje en español', () => {
    const r = registerSchema.safeParse({ name: 'Ana', email: 'a@b.co', password: '123' });
    assert.equal(r.success, false);
    assert.match(firstError(r), /al menos 6 caracteres/);
  });

  test('informa campos faltantes en español', () => {
    const r = registerSchema.safeParse({ email: 'a@b.co', password: 'secret123' });
    assert.equal(firstError(r), 'Falta el campo name');
  });
});

describe('transactionSchema', () => {
  const base = { description: 'Uber', amount: '15.555', type: 'EXPENSE', categoryId: '3', date: 1731340800000 };

  test('convierte tipos y redondea a céntimos', () => {
    const r = transactionSchema.parse(base);
    assert.equal(r.amount, 15.56);
    assert.equal(r.categoryId, 3);
    assert.equal(r.accountId, null);
    assert.equal(r.note, '');
  });

  test('rechaza montos no positivos', () => {
    const r = transactionSchema.safeParse({ ...base, amount: 0 });
    assert.equal(firstError(r), 'El monto debe ser mayor a 0');
  });

  test('rechaza tipos desconocidos', () => {
    assert.equal(transactionSchema.safeParse({ ...base, type: 'GIFT' }).success, false);
  });
});

describe('budgetSchema', () => {
  test('el mes va de 0 a 11', () => {
    assert.equal(budgetSchema.safeParse({ categoryId: 1, month: 12, year: 2026, amount: 10 }).success, false);
    assert.equal(budgetSchema.safeParse({ categoryId: 1, month: 0, year: 2026, amount: 10 }).success, true);
  });
});

describe('categorySchema', () => {
  test('exige un color hexadecimal #RRGGBB', () => {
    assert.equal(categorySchema.safeParse({ name: 'X', icon: '🐶', color: 'red' }).success, false);
    assert.equal(categorySchema.safeParse({ name: 'X', icon: '🐶', color: '#B0506B' }).success, true);
  });
});

describe('perfil', () => {
  test('solo acepta monedas soportadas', () => {
    assert.equal(profileSchema.safeParse({ name: 'Ana', currency: 'S/' }).success, true);
    assert.equal(firstError(profileSchema.safeParse({ name: 'Ana', currency: 'BTC' })), 'Moneda no válida');
  });

  test('la nueva contraseña debe ser distinta', () => {
    const r = changePasswordSchema.safeParse({ currentPassword: 'secret123', newPassword: 'secret123' });
    assert.match(firstError(r), /distinta/);
  });
});
