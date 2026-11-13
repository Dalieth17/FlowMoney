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

// Mes de ejemplo según la moneda del usuario, con comercios y montos realistas para cada una.
// [descripción, monto, tipo, categoría, día del mes, cuenta, nota]
const SAMPLES = Object.freeze({
  COP: {
    balances: { cash: 400000, bank: 2500000 },
    transactions: [
      ['Sueldo del mes', 4500000, 'INCOME', 'Salario', 3, 'Banco', ''],
      ['Freelance diseño', 800000, 'INCOME', 'Salario', 15, 'Banco', ''],
      ['Éxito', 320000, 'EXPENSE', 'Alimentación', 5, 'Banco', 'Mercado semanal'],
      ['D1', 145000, 'EXPENSE', 'Alimentación', 19, 'Banco', ''],
      ['Rappi', 48900, 'EXPENSE', 'Alimentación', 8, 'Banco', ''],
      ['Juan Valdez', 14500, 'EXPENSE', 'Alimentación', 11, 'Efectivo', ''],
      ['Terpel', 180000, 'EXPENSE', 'Transporte', 6, 'Banco', 'Gasolina'],
      ['Uber', 23500, 'EXPENSE', 'Transporte', 9, 'Efectivo', ''],
      ['TransMilenio', 60000, 'EXPENSE', 'Transporte', 22, 'Efectivo', 'Recarga'],
      ['Netflix', 44900, 'EXPENSE', 'Entretenimiento', 10, 'Banco', ''],
      ['Spotify', 17900, 'EXPENSE', 'Entretenimiento', 14, 'Banco', ''],
      ['Cine Colombia', 32000, 'EXPENSE', 'Entretenimiento', 23, 'Efectivo', ''],
      ['Cruz Verde', 65000, 'EXPENSE', 'Salud', 7, 'Efectivo', ''],
      ['Consulta médica', 150000, 'EXPENSE', 'Salud', 18, 'Banco', ''],
      ['Energía Enel', 135000, 'EXPENSE', 'Servicios', 4, 'Banco', ''],
      ['Internet Claro', 110000, 'EXPENSE', 'Servicios', 4, 'Banco', ''],
      ['Acueducto', 85000, 'EXPENSE', 'Servicios', 12, 'Banco', ''],
    ],
    budgets: [
      ['Alimentación', 650000],
      ['Transporte', 300000],
      ['Entretenimiento', 120000],
      ['Salud', 250000],
      ['Servicios', 350000],
    ],
  },
  USD: {
    balances: { cash: 300, bank: 1500 },
    transactions: [
      ['Sueldo del mes', 4200.0, 'INCOME', 'Salario', 3, 'Banco', ''],
      ['Freelance diseño', 650.0, 'INCOME', 'Salario', 15, 'Banco', ''],
      ['Supermercado', 210.4, 'EXPENSE', 'Alimentación', 5, 'Banco', 'Compra semanal'],
      ['Mercado', 165.0, 'EXPENSE', 'Alimentación', 19, 'Banco', ''],
      ["McDonald's", 28.9, 'EXPENSE', 'Alimentación', 8, 'Efectivo', ''],
      ['Starbucks', 12.5, 'EXPENSE', 'Alimentación', 11, 'Efectivo', ''],
      ['Gasolina', 120.0, 'EXPENSE', 'Transporte', 6, 'Banco', ''],
      ['Uber', 14.5, 'EXPENSE', 'Transporte', 9, 'Efectivo', ''],
      ['Bus', 30.0, 'EXPENSE', 'Transporte', 22, 'Efectivo', 'Recarga'],
      ['Netflix', 15.49, 'EXPENSE', 'Entretenimiento', 10, 'Banco', ''],
      ['Spotify', 11.99, 'EXPENSE', 'Entretenimiento', 14, 'Banco', ''],
      ['Cine', 36.0, 'EXPENSE', 'Entretenimiento', 23, 'Efectivo', ''],
      ['Farmacia', 58.0, 'EXPENSE', 'Salud', 7, 'Efectivo', ''],
      ['Consulta médica', 180.0, 'EXPENSE', 'Salud', 18, 'Banco', ''],
      ['Recibo de luz', 95.5, 'EXPENSE', 'Servicios', 4, 'Banco', ''],
      ['Internet', 60.0, 'EXPENSE', 'Servicios', 4, 'Banco', ''],
      ['Agua', 45.0, 'EXPENSE', 'Servicios', 12, 'Banco', ''],
    ],
    budgets: [
      ['Alimentación', 400],
      ['Transporte', 200],
      ['Entretenimiento', 140],
      ['Salud', 250],
      ['Servicios', 300],
    ],
  },
});

/** @param {'COP'|'USD'} currency define los montos y comercios del mes de ejemplo. */
async function seedUserData(userId, conn, now = new Date(), currency = 'COP') {
  const sample = SAMPLES[currency] ?? SAMPLES.COP;
  const categoryIds = {};
  for (const category of DEFAULT_CATEGORIES) {
    const created = await categoryRepository.create(userId, { ...category, isDefault: true }, conn);
    categoryIds[category.name] = created.id;
  }

  // Saldos iniciales realistas: así ninguna cuenta del ejemplo empieza en negativo.
  const cash = await accountRepository.create(
    userId,
    { name: 'Efectivo', type: 'CASH', initialBalance: sample.balances.cash },
    conn,
  );
  const bank = await accountRepository.create(
    userId,
    { name: 'Banco', type: 'BANK', initialBalance: sample.balances.bank },
    conn,
  );
  const accountIds = { Efectivo: cash.id, Banco: bank.id };

  const year = now.getFullYear();
  const month = now.getMonth();
  const dayToMs = (day) => new Date(year, month, day, 12, 0, 0).getTime();

  for (const [description, amount, type, category, day, account, note] of sample.transactions) {
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

  for (const [category, amount] of sample.budgets) {
    await budgetRepository.upsert(userId, { categoryId: categoryIds[category], month, year, amount }, conn);
  }
}

module.exports = { seedUserData, DEFAULT_CATEGORIES };
