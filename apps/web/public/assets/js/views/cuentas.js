// Vista Cuentas: saldo de cada cuenta (saldo inicial + ingresos − gastos) y total.
import { h, mount } from '../ui/dom.js';
import { toast, confirmDialog, runAction } from '../ui/feedback.js';
import { statCard } from '../ui/widgets.js';
import { store } from '../core/store.js';
import { money, signedBalance } from '../core/format.js';
import { api } from '../core/api.js';
import { ACCOUNT_TYPES } from '../domain/accountTypes.js';
import { openAccountForm } from '../forms/accountForm.js';

const renders = new WeakMap();
export async function render(root) {
  const token = Symbol();
  renders.set(root, token);
  const currency = store.user.currency;
  const active = () =>
    root.isConnected &&
    location.hash === '#/cuentas' &&
    renders.get(root) === token &&
    store.user.currency === currency;
  mount(root, h('p', { role: 'status' }, 'Cargando saldos…'));
  let rows;
  try {
    const accounts = await api.get('/accounts/balances');
    if (!active()) return;
    rows = accounts.map((account) => ({
      account,
      balance: account.currentBalance,
      projectedBalance: account.projectedBalance,
      count: account.count,
    }));
  } catch (err) {
    if (active())
      mount(
        root,
        h('p', { role: 'alert' }, err.message),
        h('button', { class: 'btn btn-ghost sm', onclick: () => render(root) }, 'Reintentar'),
      );
    return;
  }
  const sum = (list) => list.reduce((acc, r) => acc + Math.round(r.balance * 100), 0) / 100;
  const total = sum(rows);
  const savings = sum(rows.filter((r) => r.account.type === 'SAVINGS'));
  const unassigned = store.transactions.filter((t) => t.accountId == null).length;

  mount(
    root,
    h('div', { class: 'toolbar' }, [
      h(
        'p',
        { class: 'muted' },
        'Saldo actual: movimientos hasta hoy, transferencias y ajustes. Los futuros aparecen en el saldo proyectado.',
      ),
      h('a', { class: 'btn btn-ghost sm', href: '#/operaciones' }, 'Transferir o conciliar'),
      h('button', { class: 'btn btn-primary sm', onclick: () => openAccountForm() }, '+ Nueva cuenta'),
    ]),
    h('div', { class: 'stat-grid' }, [
      statCard('Saldo total', signedBalance(total), 'var(--brass)', { strong: true }),
      statCard('En ahorros', money(savings), 'var(--sage)'),
      statCard('Cuentas', String(rows.length), 'var(--pine)'),
    ]),
    h('div', { class: 'acc-grid' }, rows.map(accountCard)),
    unassigned
      ? h(
          'p',
          { class: 'note-banner' },
          `${unassigned} movimiento${unassigned === 1 ? '' : 's'} sin cuenta asignada: no suman a ningún saldo. Edítalos para asignarles una cuenta.`,
        )
      : null,
  );
}

function accountCard({ account, balance, projectedBalance, count }) {
  const type = ACCOUNT_TYPES[account.type] ?? ACCOUNT_TYPES.CASH;
  const remove = async () => {
    if (!(await confirmDialog(`¿Eliminar la cuenta "${account.name}"?`))) return;
    if (await runAction(null, () => store.deleteAccount(account.id))) toast('Cuenta eliminada');
  };

  return h('article', { class: 'acc-card' }, [
    h('div', { class: 'acc-head' }, [
      h('span', { class: 'acc-ic', 'aria-hidden': 'true' }, type.icon),
      h('div', { class: 'acc-title' }, [h('h3', {}, account.name), h('span', { class: 'acc-type' }, type.label)]),
      h('div', { class: 'cat-actions' }, [
        h(
          'button',
          {
            class: 'icon-btn sm',
            'aria-label': `Editar ${account.name}`,
            title: 'Editar',
            onclick: () => openAccountForm(account),
          },
          '✎',
        ),
        h(
          'button',
          { class: 'icon-btn sm', 'aria-label': `Eliminar ${account.name}`, title: 'Eliminar', onclick: remove },
          '🗑',
        ),
      ]),
    ]),
    h('div', { class: `acc-balance tnum${balance < 0 ? ' neg' : ''}` }, money(balance)),
    h('div', { class: 'acc-meta' }, `Saldo proyectado ${money(projectedBalance)}`),
    h(
      'div',
      { class: 'acc-meta' },
      `Saldo inicial ${money(account.initialBalance)} · ${count} movimiento${count === 1 ? '' : 's'}`,
    ),
  ]);
}
