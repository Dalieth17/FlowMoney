// Vista Cuentas: saldo de cada cuenta (saldo inicial + ingresos − gastos) y total.
import { h, mount } from '../ui/dom.js';
import { toast, confirmDialog, runAction } from '../ui/feedback.js';
import { statCard } from '../ui/widgets.js';
import { store } from '../core/store.js';
import { money, signedBalance } from '../core/format.js';
import { accountBalances } from '../domain/selectors.js';
import { ACCOUNT_TYPES } from '../domain/accountTypes.js';
import { openAccountForm } from '../forms/accountForm.js';

export function render(root) {
  const rows = accountBalances(store.accounts, store.transactions);
  const total = rows.reduce((acc, r) => acc + r.balance, 0);
  const savings = rows.filter((r) => r.account.type === 'SAVINGS').reduce((acc, r) => acc + r.balance, 0);
  const unassigned = store.transactions.filter((t) => t.accountId == null).length;

  mount(
    root,
    h('div', { class: 'toolbar' }, [
      h('p', { class: 'muted' }, 'El saldo de cada cuenta es su saldo inicial más ingresos menos gastos registrados.'),
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

function accountCard({ account, balance, count }) {
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
    h(
      'div',
      { class: 'acc-meta' },
      `Saldo inicial ${money(account.initialBalance)} · ${count} movimiento${count === 1 ? '' : 's'}`,
    ),
  ]);
}
