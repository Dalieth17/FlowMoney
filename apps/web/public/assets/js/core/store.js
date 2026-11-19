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

  subscribe(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #commit(patch) {
    this.#revision++;
    this.#state = { ...this.#state, ...patch };
    this.#listeners.forEach((fn) => fn(this.#state));
  }

  async #mutate(send, apply) {
    const revision = this.#revision;
    const result = await send();
    if (revision === this.#revision) apply(result);
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
  async load() {
    const revision = ++this.#revision;
    try {
      const data = await api.get('/bootstrap?transactions=none');
      if (revision !== this.#revision) return;
      let cursor = null;
      do {
        const page = await api.get(
          `/transactions/page?limit=200&currency=${data.user.currency}${cursor ? `&beforeId=${cursor}` : ''}`,
        );
        if (revision !== this.#revision) return;
        data.transactions.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor !== null);
      setCurrency(data.user.currency);
      this.#syncError = null;
      this.#commit(data);
    } catch (err) {
      if (revision === this.#revision) throw err;
    }
  }

  // ---- Movimientos ----
  async addTransaction(payload) {
    return this.#mutate(
      () => api.post('/transactions', payload),
      (tx) => this.#commit({ transactions: [tx, ...this.transactions] }),
    );
  }
  async updateTransaction(id, payload) {
    return this.#mutate(
      () => api.put(`/transactions/${id}`, payload),
      (tx) => this.#commit({ transactions: replaceById(this.transactions, tx) }),
    );
  }
  async deleteTransaction(id) {
    return this.#mutate(
      () => api.del(`/transactions/${id}`),
      () => this.#commit({ transactions: withoutId(this.transactions, id) }),
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
      this.#commit({ ...convertedData, user });
    };
    if (payload.currency !== this.user?.currency)
      return this.#replace(async () => apply(await api.put('/profile', payload)));
    return this.#mutate(() => api.put('/profile', payload), apply);
  }
  changePassword(payload) {
    return api.put('/profile/password', payload);
  }

  // ---- Sesión / datos ----
  async resetToSample() {
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
