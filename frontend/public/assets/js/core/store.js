// Estado de la app: caché en memoria hidratada desde la API.
// Las vistas leen con getters síncronos; las mutaciones van a la API y,
// si salen bien, actualizan la caché y notifican a los suscriptores.

import { api } from './api.js';
import { setCurrency } from './format.js';

const replaceById = (list, item) => list.map((x) => (x.id === item.id ? item : x));
const withoutId = (list, id) => list.filter((x) => x.id !== id);

class Store {
  #state = { user: null, categories: [], accounts: [], transactions: [], budgets: [] };
  #listeners = new Set();

  subscribe(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #commit(patch) {
    this.#state = { ...this.#state, ...patch };
    this.#listeners.forEach((fn) => fn(this.#state));
  }

  // ---- Lectura ----
  get user() {
    return this.#state.user;
  }
  get categories() {
    return this.#state.categories;
  }
  get accounts() {
    return this.#state.accounts;
  }
  get transactions() {
    return this.#state.transactions;
  }
  get budgets() {
    return this.#state.budgets;
  }

  category(id) {
    return this.categories.find((c) => c.id === id);
  }
  account(id) {
    return this.accounts.find((a) => a.id === id);
  }
  budgetFor(categoryId, month, year) {
    return this.budgets.find((b) => b.categoryId === categoryId && b.month === month && b.year === year);
  }

  // ---- Carga ----
  async load() {
    const data = await api.get('/bootstrap');
    setCurrency(data.user.currency);
    this.#commit(data);
  }

  // ---- Movimientos ----
  async addTransaction(payload) {
    const tx = await api.post('/transactions', payload);
    this.#commit({ transactions: [tx, ...this.transactions] });
    return tx;
  }
  async updateTransaction(id, payload) {
    const tx = await api.put(`/transactions/${id}`, payload);
    this.#commit({ transactions: replaceById(this.transactions, tx) });
  }
  async deleteTransaction(id) {
    await api.del(`/transactions/${id}`);
    this.#commit({ transactions: withoutId(this.transactions, id) });
  }

  // ---- Categorías ----
  async addCategory(payload) {
    const category = await api.post('/categories', payload);
    this.#commit({ categories: [...this.categories, category] });
  }
  async updateCategory(id, payload) {
    const category = await api.put(`/categories/${id}`, payload);
    this.#commit({ categories: replaceById(this.categories, category) });
  }
  async deleteCategory(id) {
    await api.del(`/categories/${id}`);
    this.#commit({
      categories: withoutId(this.categories, id),
      budgets: this.budgets.filter((b) => b.categoryId !== id),
    });
  }

  // ---- Cuentas ----
  async addAccount(payload) {
    const account = await api.post('/accounts', payload);
    this.#commit({ accounts: [...this.accounts, account] });
  }
  async updateAccount(id, payload) {
    const account = await api.put(`/accounts/${id}`, payload);
    this.#commit({ accounts: replaceById(this.accounts, account) });
  }
  async deleteAccount(id) {
    await api.del(`/accounts/${id}`);
    this.#commit({ accounts: withoutId(this.accounts, id) });
  }

  // ---- Presupuestos ----
  async setBudget(categoryId, month, year, amount) {
    const saved = await api.put('/budgets', { categoryId, month, year, amount });
    const others = this.budgets.filter((b) => !(b.categoryId === categoryId && b.month === month && b.year === year));
    this.#commit({ budgets: saved ? [...others, saved] : others });
  }

  // ---- Perfil ----
  async updateProfile(payload) {
    const user = await api.put('/profile', payload);
    setCurrency(user.currency);
    this.#commit({ user });
  }
  changePassword(payload) {
    return api.put('/profile/password', payload);
  }

  // ---- Sesión / datos ----
  async resetToSample() {
    await api.post('/data/reset');
    await this.load();
  }
  async logout() {
    try {
      await api.logout();
    } finally {
      location.replace('login.html');
    }
  }
}

export const store = new Store();
