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
  #revision = 0;
  #replacement = Promise.resolve();
  #syncError = null;
  #requestedMonth = null;
  #loadedMonth = null;

  hasMonth({ month, year }) {
    return [this.#loadedMonth, this.#requestedMonth].every(
      (period) => period?.month === month && period?.year === year,
    );
  }

  get transactionCount() {
    return this.#state.transactionSummary?.total ?? this.transactions.length;
  }
  get unassignedCount() {
    return this.#state.transactionSummary?.unassigned ?? this.transactions.filter((t) => t.accountId == null).length;
  }
  get categoryCounts() {
    if (this.#state.transactionSummary) return this.#state.transactionSummary.byCategory;
    const counts = {};
    for (const t of this.transactions) counts[t.categoryId] = (counts[t.categoryId] ?? 0) + 1;
    return counts;
  }

  subscribe(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #commit(patch) {
    this.#revision++;
    this.#state = { ...this.#state, ...patch };
    this.#listeners.forEach((fn) => fn(this.#state));
  }

  async #mutate(send, apply, { refreshMonth = false } = {}) {
    const revision = this.#revision;
    const result = await send();
    if (revision === this.#revision && !(refreshMonth && this.#requestedMonth)) apply(result);
    else {
      // Otra respuesta o una carga completa ya modificó la caché. El resultado
      // antiguo no se puede mezclar con IDs o importes de una versión distinta.
      await this.#replacement;
      try {
        await this.load();
      } catch {
        // La escritura SÍ terminó: no informar que falló ni invitar a duplicarla.
        this.#syncError =
          'El cambio se guardó, pero no se pudieron actualizar los datos en pantalla. Vuelve a cargar antes de continuar.';
        this.#commit({});
      }
    }
    return result;
  }

  async #replace(action) {
    const previous = this.#replacement;
    let finish;
    this.#replacement = new Promise((resolve) => {
      finish = resolve;
    });
    this.#revision++;
    try {
      await previous;
      return await action();
    } finally {
      finish();
    }
  }

  // ---- Lectura ----
  get user() {
    return this.#state.user;
  }
  get syncError() {
    return this.#syncError;
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
  async allTransactions(currency = this.user.currency, revision = this.#revision) {
    const transactions = [];
    let cursor = null;
    do {
      const page = await api.get(
        `/transactions/page?limit=200&currency=${currency}${cursor ? `&beforeId=${cursor}` : ''}`,
      );
      if (revision !== this.#revision) throw Error('Los datos cambiaron. Vuelve a solicitar la exportación.');
      transactions.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor !== null);
    return transactions;
  }

  async load(period = this.#requestedMonth) {
    const revision = ++this.#revision;
    this.#requestedMonth = period;
    try {
      const path = period
        ? `/bootstrap/month?month=${period.month}&year=${period.year}`
        : '/bootstrap?transactions=none';
      const data = await api.get(path);
      if (revision !== this.#revision) return;
      if (!period) data.transactions = await this.allTransactions(data.user.currency, revision);
      if (revision !== this.#revision) return;
      this.#loadedMonth = period;
      setCurrency(data.user.currency);
      this.#syncError = null;
      this.#commit(data);
    } catch (err) {
      if (revision === this.#revision) throw err;
    }
  }

  // ---- Movimientos ----
  async importTransactions(payload) {
    return this.#replace(async () => {
      const result = await api.post('/transactions/import', payload);
      try {
        await this.load();
      } catch {
        this.#syncError =
          'La importación se guardó, pero no se pudieron actualizar los datos en pantalla. Vuelve a cargar el panel.';
        this.#commit({});
      }
      return result;
    });
  }
  async addTransaction(payload) {
    return this.#mutate(
      () => api.post('/transactions', payload),
      (tx) => this.#commit({ transactions: [tx, ...this.transactions] }),
      { refreshMonth: true },
    );
  }
  async updateTransaction(id, payload) {
    return this.#mutate(
      () => api.put(`/transactions/${id}`, payload),
      (tx) => this.#commit({ transactions: replaceById(this.transactions, tx) }),
      { refreshMonth: true },
    );
  }
  async deleteTransaction(id) {
    return this.#mutate(
      () => api.del(`/transactions/${id}`),
      () => this.#commit({ transactions: withoutId(this.transactions, id) }),
      { refreshMonth: true },
    );
  }

  // ---- Categorías ----
  async addCategory(payload) {
    return this.#mutate(
      () => api.post('/categories', payload),
      (category) => this.#commit({ categories: [...this.categories, category] }),
    );
  }
  async updateCategory(id, payload) {
    return this.#mutate(
      () => api.put(`/categories/${id}`, payload),
      (category) => this.#commit({ categories: replaceById(this.categories, category) }),
    );
  }
  async deleteCategory(id) {
    return this.#mutate(
      () => api.del(`/categories/${id}`),
      () =>
        this.#commit({
          categories: withoutId(this.categories, id),
          budgets: this.budgets.filter((b) => b.categoryId !== id),
        }),
    );
  }

  // ---- Cuentas ----
  async addAccount(payload) {
    return this.#mutate(
      () => api.post('/accounts', payload),
      (account) => this.#commit({ accounts: [...this.accounts, account] }),
    );
  }
  async updateAccount(id, payload) {
    return this.#mutate(
      () => api.put(`/accounts/${id}`, payload),
      (account) => this.#commit({ accounts: replaceById(this.accounts, account) }),
    );
  }
  async deleteAccount(id) {
    return this.#mutate(
      () => api.del(`/accounts/${id}`),
      () => this.#commit({ accounts: withoutId(this.accounts, id) }),
    );
  }

  // ---- Presupuestos ----
  async copyPreviousBudgets(month, year) {
    return this.#mutate(
      () => api.post('/budgets/copy-previous', { month, year }),
      (result) =>
        this.#commit({
          budgets: [...this.budgets.filter((b) => b.month !== month || b.year !== year), ...result.budgets],
        }),
    );
  }
  async setBudget(categoryId, month, year, amount) {
    return this.#mutate(
      () => api.put('/budgets', { categoryId, month, year, amount }),
      (saved) => {
        const others = this.budgets.filter(
          (b) => !(b.categoryId === categoryId && b.month === month && b.year === year),
        );
        this.#commit({ budgets: saved ? [...others, saved] : others });
      },
    );
  }

  // ---- Perfil ----
  async updateProfile(payload) {
    const apply = ({ convertedData, ...user }) => {
      setCurrency(user.currency);
      if (convertedData) this.#syncError = null;
      this.#commit({ ...(convertedData && { ...convertedData, transactionSummary: null }), user });
    };
    if (payload.currency !== this.user?.currency)
      return this.#replace(async () => apply(await api.put('/profile', payload)));
    return this.#mutate(() => api.put('/profile', payload), apply);
  }
  changePassword(payload) {
    return api.put('/profile/password', payload);
  }

  // ---- Sesión / datos ----
  async resetData() {
    return this.#replace(async () => {
      await api.post('/data/reset');
      await this.load();
    });
  }
  /** Derecho de supresión: borra la cuenta de usuario en el servidor y vuelve a la página pública. */
  async deleteProfile(password) {
    await api.deleteProfile(password);
    location.replace('index.html');
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
