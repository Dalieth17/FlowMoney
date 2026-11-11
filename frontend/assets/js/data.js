// data.js — capa de datos (equivalente web de Room).
// Persiste en localStorage. Siembra categorías y datos de ejemplo la primera vez.
// Expone un Store reactivo con pub/sub para que las vistas se re-rendericen.

const KEY = 'flowmoney.v1';

// ---- Categorías predeterminadas (espejo de la entidad Category) ----
export const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Alimentación',    icon: '🍽', color: '#C25A44', isDefault: true },
  { id: 2, name: 'Transporte',      icon: '🚌', color: '#3E78A8', isDefault: true },
  { id: 3, name: 'Entretenimiento', icon: '🎬', color: '#7A5BA8', isDefault: true },
  { id: 4, name: 'Salud',           icon: '🩺', color: '#5B9E86', isDefault: true },
  { id: 5, name: 'Educación',       icon: '📚', color: '#D9A648', isDefault: true },
  { id: 6, name: 'Servicios',       icon: '💡', color: '#C08A3E', isDefault: true },
  { id: 7, name: 'Hogar',           icon: '🏠', color: '#A86A54', isDefault: true },
  { id: 8, name: 'Salario',         icon: '💼', color: '#1F4D3A', isDefault: true },
  { id: 9, name: 'Otros',           icon: '✨', color: '#8A94A6', isDefault: true },
];

// ---- Reglas de la IA: palabras clave por categoría ----
export const KEYWORD_RULES = {
  'Alimentación': ['mcdonald', 'kfc', 'burger', 'bembos', 'norkys', 'starbucks', 'juan valdez', 'cafe', 'café',
    'restaurant', 'rappi', 'uber eats', 'pedidosya', 'pizza', 'papa john', 'dominos', 'mercado', 'supermercado',
    'wong', 'metro', 'plaza vea', 'tottus', 'vivanda', 'comida', 'almuerzo', 'cena', 'desayuno', 'menu', 'tambo', 'oxxo'],
  'Transporte': ['uber', 'taxi', 'cabify', 'didi', 'indriver', 'beat', 'grifo', 'gasolina', 'combustible', 'primax',
    'repsol', 'petroperu', 'pasaje', 'bus', 'metropolitano', 'tren', 'peaje', 'estacionamiento', 'cochera', 'scooter'],
  'Entretenimiento': ['netflix', 'spotify', 'disney', 'hbo', 'max', 'prime video', 'youtube', 'cine', 'cinepolis',
    'cineplanet', 'steam', 'playstation', 'xbox', 'juego', 'concierto', 'teatro', 'bar', 'discoteca'],
  'Salud': ['farmacia', 'botica', 'inkafarma', 'mifarma', 'boticas', 'clinica', 'clínica', 'hospital', 'doctor',
    'medico', 'médico', 'dentista', 'medicina', 'consulta', 'laboratorio', 'gym', 'gimnasio'],
  'Educación': ['universidad', 'colegio', 'instituto', 'curso', 'udemy', 'platzi', 'coursera', 'libro', 'libreria',
    'matricula', 'matrícula', 'pension', 'pensión', 'utiles', 'útiles'],
  'Servicios': ['luz', 'agua', 'internet', 'telefono', 'teléfono', 'claro', 'movistar', 'entel', 'bitel', 'gas',
    'recibo', 'cable', 'wifi', 'plan', 'suscripcion', 'suscripción', 'seguro'],
  'Hogar': ['alquiler', 'renta', 'sodimac', 'promart', 'maestro', 'muebles', 'ferreteria', 'limpieza', 'lavanderia'],
  'Salario': ['sueldo', 'salario', 'pago', 'nomina', 'nómina', 'honorarios', 'freelance', 'deposito', 'depósito', 'bono'],
};

// ---- Datos de ejemplo (mes actual) ----
function seed() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based, igual que Room guardará
  const at = (day) => new Date(y, m, day, 12, 0, 0).getTime();

  const transactions = [
    { description: 'Sueldo del mes',      amount: 4200.00, type: 'INCOME',  categoryId: 8, date: at(3),  note: '' },
    { description: 'Freelance diseño',    amount: 650.00,  type: 'INCOME',  categoryId: 8, date: at(15), note: '' },
    { description: 'Plaza Vea',           amount: 210.40,  type: 'EXPENSE', categoryId: 1, date: at(5),  note: 'Compra semanal' },
    { description: 'Wong',                amount: 165.00,  type: 'EXPENSE', categoryId: 1, date: at(19), note: '' },
    { description: "McDonald's",          amount: 28.90,   type: 'EXPENSE', categoryId: 1, date: at(8),  note: '' },
    { description: 'Starbucks',           amount: 12.50,   type: 'EXPENSE', categoryId: 1, date: at(11), note: '' },
    { description: 'Grifo Primax',        amount: 120.00,  type: 'EXPENSE', categoryId: 2, date: at(6),  note: '' },
    { description: 'Uber',                amount: 14.50,   type: 'EXPENSE', categoryId: 2, date: at(9),  note: '' },
    { description: 'Metropolitano',       amount: 30.00,   type: 'EXPENSE', categoryId: 2, date: at(22), note: 'Recarga' },
    { description: 'Netflix',             amount: 44.90,   type: 'EXPENSE', categoryId: 3, date: at(10), note: '' },
    { description: 'Spotify',             amount: 21.90,   type: 'EXPENSE', categoryId: 3, date: at(14), note: '' },
    { description: 'Cineplanet',          amount: 36.00,   type: 'EXPENSE', categoryId: 3, date: at(23), note: '' },
    { description: 'Inkafarma',           amount: 58.00,   type: 'EXPENSE', categoryId: 4, date: at(7),  note: '' },
    { description: 'Consulta médica',     amount: 180.00,  type: 'EXPENSE', categoryId: 4, date: at(18), note: '' },
    { description: 'Recibo de luz',       amount: 95.50,   type: 'EXPENSE', categoryId: 6, date: at(4),  note: '' },
    { description: 'Internet Movistar',   amount: 120.00,  type: 'EXPENSE', categoryId: 6, date: at(4),  note: '' },
    { description: 'Agua',                amount: 45.00,   type: 'EXPENSE', categoryId: 6, date: at(12), note: '' },
  ].map((t, i) => ({ id: i + 1, accountId: 1, ...t }));

  const budgets = [
    { id: 1, categoryId: 1, amount: 400, month: m, year: y }, // Alimentación -> superado
    { id: 2, categoryId: 2, amount: 200, month: m, year: y }, // Transporte   -> cerca
    { id: 3, categoryId: 3, amount: 140, month: m, year: y }, // Entretenim.  -> en control
    { id: 4, categoryId: 4, amount: 250, month: m, year: y }, // Salud        -> cerca
    { id: 5, categoryId: 6, amount: 300, month: m, year: y }, // Servicios    -> cerca
  ];

  const accounts = [
    { id: 1, name: 'Efectivo', type: 'CASH', initialBalance: 0 },
    { id: 2, name: 'Banco',    type: 'BANK', initialBalance: 0 },
  ];

  return {
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    transactions,
    budgets,
    accounts,
    seq: { category: 100, transaction: 100, budget: 100, account: 100 },
  };
}

// ---- Store ----
class Store {
  constructor() {
    this.state = this._load();
    this._subs = new Set();
  }

  _load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* almacenamiento no disponible: usamos memoria */ }
    const s = seed();
    this._persist(s);
    return s;
  }

  _persist(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }

  save() { this._persist(this.state); this._emit(); }

  reset() { this.state = seed(); this.save(); }

  clearAll() {
    this.state = { ...seed(), transactions: [], budgets: [] };
    this.save();
  }

  // pub/sub
  subscribe(fn) { this._subs.add(fn); return () => this._subs.delete(fn); }
  _emit() { this._subs.forEach((fn) => fn(this.state)); }

  _nextId(kind) { return ++this.state.seq[kind]; }

  // --- getters ---
  get categories() { return this.state.categories; }
  get transactions() { return this.state.transactions; }
  get budgets() { return this.state.budgets; }
  get accounts() { return this.state.accounts; }

  category(id) { return this.categories.find((c) => c.id === id); }

  // --- Transactions ---
  addTransaction(t) {
    const row = { id: this._nextId('transaction'), accountId: 1, note: '', ...t };
    this.state.transactions.push(row);
    this.save();
    return row;
  }
  updateTransaction(id, patch) {
    const t = this.transactions.find((x) => x.id === id);
    if (t) { Object.assign(t, patch); this.save(); }
  }
  deleteTransaction(id) {
    this.state.transactions = this.transactions.filter((x) => x.id !== id);
    this.save();
  }

  // --- Categories ---
  addCategory(c) {
    const row = { id: this._nextId('category'), isDefault: false, ...c };
    this.state.categories.push(row);
    this.save();
    return row;
  }
  updateCategory(id, patch) {
    const c = this.category(id);
    if (c) { Object.assign(c, patch); this.save(); }
  }
  deleteCategory(id) {
    const c = this.category(id);
    if (!c || c.isDefault) return false;              // no se borran las predeterminadas
    const inUse = this.transactions.some((t) => t.categoryId === id);
    if (inUse) return false;                           // ni las que tienen movimientos
    this.state.categories = this.categories.filter((x) => x.id !== id);
    this.state.budgets = this.budgets.filter((b) => b.categoryId !== id);
    this.save();
    return true;
  }

  // --- Budgets (uno por categoría/mes/año) ---
  setBudget(categoryId, month, year, amount) {
    let b = this.budgets.find((x) => x.categoryId === categoryId && x.month === month && x.year === year);
    if (amount == null || amount <= 0) {
      if (b) { this.state.budgets = this.budgets.filter((x) => x !== b); this.save(); }
      return;
    }
    if (b) b.amount = amount;
    else this.state.budgets.push({ id: this._nextId('budget'), categoryId, month, year, amount });
    this.save();
  }
  budgetFor(categoryId, month, year) {
    return this.budgets.find((b) => b.categoryId === categoryId && b.month === month && b.year === year);
  }
}

export const store = new Store();
