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
    assert.equal(r.currency, 'COP', 'la moneda por defecto es el peso colombiano');
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

  test('rechaza montos menores a un céntimo antes de redondear (QA #4)', () => {
    for (const amount of [0, -5, 0.001, 0.0049]) {
      const r = transactionSchema.safeParse({ ...base, amount });
      assert.equal(firstError(r), 'El monto mínimo es 0.01', `monto ${amount}`);
    }
    assert.equal(transactionSchema.parse({ ...base, amount: 0.01 }).amount, 0.01);
  });

  test('redondea medios céntimos hacia arriba pese al error binario', () => {
    assert.equal(transactionSchema.parse({ ...base, amount: 0.015 }).amount, 0.02);
    assert.equal(transactionSchema.parse({ ...base, amount: 1.005 }).amount, 1.01);
  });

  test('rechaza tipos desconocidos', () => {
    assert.equal(transactionSchema.safeParse({ ...base, type: 'GIFT' }).success, false);
  });
});

describe('budgetSchema', () => {
  test('0 quita el límite; entre 0 y 0.01 se rechaza (QA #4)', () => {
    const period = { categoryId: 1, month: 0, year: 2026 };
    assert.equal(budgetSchema.parse({ ...period, amount: 0 }).amount, 0);
    assert.match(firstError(budgetSchema.safeParse({ ...period, amount: 0.004 })), /mínimo es 0.01/);
    assert.equal(budgetSchema.parse({ ...period, amount: 0.01 }).amount, 0.01);
  });

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
  test('solo acepta pesos colombianos o dólares', () => {
    assert.equal(profileSchema.safeParse({ name: 'Ana', currency: 'COP' }).success, true);
    assert.equal(profileSchema.safeParse({ name: 'Ana', currency: 'USD' }).success, true);
    assert.equal(firstError(profileSchema.safeParse({ name: 'Ana', currency: '$' })), 'Moneda no válida');
    assert.equal(firstError(profileSchema.safeParse({ name: 'Ana', currency: 'BTC' })), 'Moneda no válida');
  });

  test('la nueva contraseña debe ser distinta', () => {
    const r = changePasswordSchema.safeParse({ currentPassword: 'secret123', newPassword: 'secret123' });
    assert.match(firstError(r), /distinta/);
  });
});
