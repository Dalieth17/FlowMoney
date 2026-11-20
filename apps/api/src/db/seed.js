// Valores iniciales de una cuenta: categorías y cuentas sin dinero ficticio.
const categoryRepository = require('../repositories/categoryRepository');
const accountRepository = require('../repositories/accountRepository');

const DEFAULT_CATEGORIES = Object.freeze([
  { name: 'Alimentación', icon: '🍽', color: '#C25A44' },
  { name: 'Transporte', icon: '🚌', color: '#3E78A8' },
  { name: 'Entretenimiento', icon: '🎬', color: '#7A5BA8' },
  { name: 'Salud', icon: '🩺', color: '#5B9E86' },
  { name: 'Educación', icon: '📚', color: '#D9A648' },
  { name: 'Servicios', icon: '💡', color: '#C08A3E' },
  { name: 'Hogar', icon: '🏠', color: '#A86A54' },
  { name: 'Salario', icon: '💼', color: '#1F4D3A' },
  { name: 'Otros', icon: '✨', color: '#8A94A6' },
]);

/** Categorías y cuentas vacías para el registro; nunca crea dinero ni movimientos. */
async function initializeUserData(userId, conn) {
  const categoryIds = {};
  for (const category of DEFAULT_CATEGORIES) {
    const created = await categoryRepository.create(userId, { ...category, isDefault: true }, conn);
    categoryIds[category.name] = created.id;
  }
  const cash = await accountRepository.create(userId, { name: 'Efectivo', type: 'CASH', initialBalance: 0 }, conn);
  const bank = await accountRepository.create(userId, { name: 'Banco', type: 'BANK', initialBalance: 0 }, conn);
  return { categoryIds, accountIds: { Efectivo: cash.id, Banco: bank.id } };
}

module.exports = { initializeUserData, DEFAULT_CATEGORIES };
