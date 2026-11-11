// data.js — capa de datos del frontend.
// Mantiene una caché en memoria hidratada desde la API (MySQL) y expone getters
// síncronos para las vistas. Las mutaciones llaman a la API y luego actualizan la caché.

import { api } from './api.js';

// Reglas de la IA (las usa ai.js). Viven aquí porque son parte del "dominio".
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

class Store {
  constructor() {
    this.state = { user: null, categories: [], transactions: [], budgets: [], accounts: [] };
    this._subs = new Set();
  }

  // Carga inicial desde la API. Lanza si no hay sesión (api.js redirige al login).
  async load() {
    const d = await api.get('/bootstrap');
    this.state = { user: d.user, categories: d.categories, transactions: d.transactions, budgets: d.budgets, accounts: d.accounts };
    this._emit();
  }

  subscribe(fn) { this._subs.add(fn); return () => this._subs.delete(fn); }
  _emit() { this._subs.forEach((fn) => fn(this.state)); }

  // getters síncronos (leen la caché)
  get user() { return this.state.user; }
  get categories() { return this.state.categories; }
  get transactions() { return this.state.transactions; }
  get budgets() { return this.state.budgets; }
  get accounts() { return this.state.accounts; }
  category(id) { return this.categories.find((c) => c.id === id); }
  budgetFor(categoryId, month, year) {
    return this.budgets.find((b) => b.categoryId === categoryId && b.month === month && b.year === year);
  }

  // --- Movimientos ---
  async addTransaction(t) {
    const row = await api.post('/transactions', t);
    this.state.transactions.unshift(row);
    this._emit();
    return row;
  }
  async updateTransaction(id, patch) {
    const row = await api.put(`/transactions/${id}`, patch);
    const i = this.state.transactions.findIndex((x) => x.id === id);
    if (i >= 0) this.state.transactions[i] = row;
    this._emit();
  }
  async deleteTransaction(id) {
    await api.del(`/transactions/${id}`);
    this.state.transactions = this.transactions.filter((x) => x.id !== id);
    this._emit();
  }

  // --- Categorías ---
  async addCategory(c) {
    const row = await api.post('/categories', c);
    this.state.categories.push(row);
    this._emit();
    return row;
  }
  async updateCategory(id, patch) {
    const row = await api.put(`/categories/${id}`, patch);
    const i = this.state.categories.findIndex((x) => x.id === id);
    if (i >= 0) this.state.categories[i] = row;
    this._emit();
  }
  async deleteCategory(id) {
    await api.del(`/categories/${id}`); // lanza con mensaje si no se puede
    this.state.categories = this.categories.filter((x) => x.id !== id);
    this.state.budgets = this.budgets.filter((b) => b.categoryId !== id);
    this._emit();
  }

  // --- Presupuestos ---
  async setBudget(categoryId, month, year, amount) {
    const resp = await api.put('/budgets', { categoryId, month, year, amount });
    this.state.budgets = this.budgets.filter((b) => !(b.categoryId === categoryId && b.month === month && b.year === year));
    if (resp && !resp.removed) this.state.budgets.push(resp);
    this._emit();
  }

  // --- Datos ---
  async reset() { await api.post('/data/reset'); await this.load(); }

  async logout() { try { await api.logout(); } catch (e) { /* ignore */ } location.href = 'login.html'; }
}

export const store = new Store();
