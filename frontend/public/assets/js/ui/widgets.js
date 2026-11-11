// Piezas de interfaz reutilizadas por varias vistas.
import { h, withAlpha } from './dom.js';
import { shortDate, signedMoney } from '../core/format.js';
import { BUDGET_WARNING_PCT } from '../domain/selectors.js';
import { store } from '../core/store.js';
import { openMovementForm } from '../forms/movementForm.js';

export function statCard(label, value, color, { strong = false } = {}) {
  return h('div', { class: `stat${strong ? ' strong' : ''}` }, [
    h('div', { class: 'k' }, [h('i', { style: { background: color } }), label]),
    h('div', { class: 'v tnum', style: strong ? { color } : null }, value),
  ]);
}

export function sumPill(label, value, color) {
  return h('div', { class: 'sum-pill' }, [
    h('span', { class: 'sp-k' }, label),
    h('span', { class: 'sp-v tnum', style: { color } }, value),
  ]);
}

export function panel(title, subtitle, body, action) {
  return h('section', { class: 'panel' }, [
    h('div', { class: 'panel-head' }, [
      h('div', {}, [h('h3', {}, title), subtitle ? h('span', { class: 'sub' }, subtitle) : null]),
      action || null,
    ]),
    body,
  ]);
}

export function emptyState(title, text, action) {
  return h('div', { class: 'empty' }, [
    h('div', { class: 'empty-ic', 'aria-hidden': 'true' }, '◎'),
    h('p', { class: 'empty-t' }, title),
    h('p', { class: 'empty-s' }, text),
    action || null,
  ]);
}

const METER_FILL = {
  over: 'linear-gradient(90deg,var(--brass),var(--clay))',
  warn: 'linear-gradient(90deg,var(--sage),var(--brass))',
  ok: 'var(--sage)',
};

/** Barra de presupuesto con marca del 80% y estado. */
export function budgetMeter(status) {
  const pct = Math.round(status.pct);
  return h('div', { class: 'meter-wrap' }, [
    h(
      'div',
      {
        class: 'meter',
        role: 'meter',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': String(Math.min(100, pct)),
        'aria-label': `${pct}% del presupuesto`,
      },
      [
        h('div', {
          class: 'lvl',
          style: { width: `${Math.min(100, status.pct)}%`, background: METER_FILL[status.level] },
        }),
        h('div', { class: 'mark', style: { left: `${BUDGET_WARNING_PCT}%` } }),
      ],
    ),
    h('div', { class: 'bud-foot' }, [
      h('span', { class: `flag ${status.level}` }, [h('span', { class: 'd' }), status.label]),
      h('span', { class: 'pct tnum' }, `${pct}%`),
    ]),
  ]);
}

export function categoryTag(category) {
  const color = category?.color || '#6B8F7D';
  return h(
    'span',
    { class: 'tag-cat', style: { background: withAlpha(color, 0.12), color } },
    category?.name || 'Otros',
  );
}

/** Fila de movimiento; clic o Enter abre el formulario de edición. */
export function movementRow(tx) {
  const category = store.category(tx.categoryId);
  const account = store.account(tx.accountId);
  const open = () => openMovementForm(tx);
  return h(
    'li',
    {
      class: 'mv',
      tabindex: '0',
      role: 'button',
      'aria-label': `Editar ${tx.description}`,
      onclick: open,
      onkeydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      },
    },
    [
      h(
        'span',
        { class: 'av', style: { background: category?.color || 'var(--sage)' }, 'aria-hidden': 'true' },
        category?.icon || '•',
      ),
      h('div', { class: 'd' }, [
        h('div', { class: 't' }, tx.description),
        h('div', { class: 's' }, [
          shortDate(tx.date),
          categoryTag(category),
          account ? h('span', { class: 'acc-name' }, account.name) : null,
          tx.note ? h('span', { class: 'note-dot', title: tx.note }, 'nota') : null,
        ]),
      ]),
      h('div', { class: `amt ${tx.type === 'INCOME' ? 'in' : 'out'} tnum` }, signedMoney(tx.amount, tx.type)),
    ],
  );
}
