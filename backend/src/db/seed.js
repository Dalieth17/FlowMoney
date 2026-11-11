// Datos iniciales para un usuario nuevo: categorías predeterminadas, cuentas
// y un mes de ejemplo. Se ejecuta dentro de la transacción del registro/reinicio.
const categoryRepository = require('../repositories/categoryRepository');
const accountRepository = require('../repositories/accountRepository');
const transactionRepository = require('../repositories/transactionRepository');
const budgetRepository = require('../repositories/budgetRepository');

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

// [descripción, monto, tipo, categoría, día del mes, cuenta, nota]
const SAMPLE_TRANSACTIONS = Object.freeze([
  ['Sueldo del mes', 4200.0, 'INCOME', 'Salario', 3, 'Banco', ''],
  ['Freelance diseño', 650.0, 'INCOME', 'Salario', 15, 'Banco', ''],
  ['Plaza Vea', 210.4, 'EXPENSE', 'Alimentación', 5, 'Banco', 'Compra semanal'],
  ['Wong', 165.0, 'EXPENSE', 'Alimentación', 19, 'Banco', ''],
  ["McDonald's", 28.9, 'EXPENSE', 'Alimentación', 8, 'Efectivo', ''],
  ['Starbucks', 12.5, 'EXPENSE', 'Alimentación', 11, 'Efectivo', ''],
  ['Grifo Primax', 120.0, 'EXPENSE', 'Transporte', 6, 'Banco', ''],
  ['Uber', 14.5, 'EXPENSE', 'Transporte', 9, 'Efectivo', ''],
  ['Metropolitano', 30.0, 'EXPENSE', 'Transporte', 22, 'Efectivo', 'Recarga'],
  ['Netflix', 44.9, 'EXPENSE', 'Entretenimiento', 10, 'Banco', ''],
  ['Spotify', 21.9, 'EXPENSE', 'Entretenimiento', 14, 'Banco', ''],
  ['Cineplanet', 36.0, 'EXPENSE', 'Entretenimiento', 23, 'Efectivo', ''],
  ['Inkafarma', 58.0, 'EXPENSE', 'Salud', 7, 'Efectivo', ''],
  ['Consulta médica', 180.0, 'EXPENSE', 'Salud', 18, 'Banco', ''],
  ['Recibo de luz', 95.5, 'EXPENSE', 'Servicios', 4, 'Banco', ''],
  ['Internet Movistar', 120.0, 'EXPENSE', 'Servicios', 4, 'Banco', ''],
  ['Agua', 45.0, 'EXPENSE', 'Servicios', 12, 'Banco', ''],
]);

const SAMPLE_BUDGETS = Object.freeze([
  ['Alimentación', 400],
  ['Transporte', 200],
  ['Entretenimiento', 140],
  ['Salud', 250],
  ['Servicios', 300],
]);

async function seedUserData(userId, conn, now = new Date()) {
  const categoryIds = {};
  for (const category of DEFAULT_CATEGORIES) {
    const created = await categoryRepository.create(userId, { ...category, isDefault: true }, conn);
    categoryIds[category.name] = created.id;
  }

  // Saldos iniciales realistas: así ninguna cuenta del ejemplo empieza en negativo.
  const cash = await accountRepository.create(userId, { name: 'Efectivo', type: 'CASH', initialBalance: 300 }, conn);
  const bank = await accountRepository.create(userId, { name: 'Banco', type: 'BANK', initialBalance: 1500 }, conn);
  const accountIds = { Efectivo: cash.id, Banco: bank.id };

  const year = now.getFullYear();
  const month = now.getMonth();
  const dayToMs = (day) => new Date(year, month, day, 12, 0, 0).getTime();

  for (const [description, amount, type, category, day, account, note] of SAMPLE_TRANSACTIONS) {
    await transactionRepository.create(
      userId,
      {
        description,
        amount,
        type,
        categoryId: categoryIds[category],
        accountId: accountIds[account],
        date: dayToMs(day),
        note,
      },
      conn,
    );
  }

  for (const [category, amount] of SAMPLE_BUDGETS) {
    await budgetRepository.upsert(userId, { categoryId: categoryIds[category], month, year, amount }, conn);
  }
}

module.exports = { seedUserData, DEFAULT_CATEGORIES };
