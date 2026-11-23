// Vista Resumen: totales del mes, flujo semanal, categorías, presupuestos y recientes.
import { h, mount } from '../ui/dom.js';
import { barsChart } from '../ui/financialChart.js';
import { panel, emptyState, budgetMeter, movementRow } from '../ui/widgets.js';
import { store } from '../core/store.js';
import { go } from '../core/router.js';
import { money, signedBalance, monthLabel, transactionDate } from '../core/format.js';
import {
  inMonth,
  totals,
  savingRate,
  expenseByCategory,
  weeklyFlow,
  budgetStatus,
  spentInCategory,
  availableToSpend,
} from '../domain/selectors.js';
import { gettingStartedCard } from '../ui/gettingStarted.js';
import { openMovementForm } from '../forms/movementForm.js';
import { spendingChartCard } from '../ui/spendingChart.js';

const RECENT_COUNT = 6;
const BUDGET_PREVIEW_COUNT = 4;

export function render(root, { month, year }) {
  const list = inMonth(store.transactions, month, year);
  const t = totals(list);
  const today = transactionDate();
  const available = availableToSpend(list, store.budgets, month, year, today);

  mount(
    root,
    gettingStartedCard(store, () => openMovementForm()),
    h('div', { class: 'overview' }, [
      availableBlock(available, t),
      h('div', { class: 'figs' }, [
        figure('Ingresos', money(t.income), 'in'),
        figure('Gastos', money(t.expense)),
        figure('Balance', signedBalance(t.balance)),
        figure('Ahorro', `${savingRate(t)} %`),
      ]),
    ]),
    h('div', { class: 'grid-wide' }, [
      spendingChartCard(list, month, year, today),
      panel('Presupuestos', 'el más ajustado primero', budgetPreview(list, month, year)),
    ]),
    h('div', { class: 'grid-2' }, [
      panel(
        'Flujo semanal',
        'ingresos vs. gastos',
        h('div', { class: 'chart-pad' }, barsChart(weeklyFlow(list, month, year), { width: 560, height: 220 })),
      ),
      panel('Gasto por categoría', monthLabel(month, year), categoryBreakdown(list)),
    ]),
    panel(
      'Movimientos recientes',
      `${list.length} este mes`,
      list.length
        ? h('ul', { class: 'mv-list' }, list.slice(0, RECENT_COUNT).map(movementRow))
        : emptyState('Todo tranquilo', 'Aún no hay movimientos en este mes.'),
      h('a', { class: 'link-btn', href: '#/movimientos' }, 'Ver todos'),
    ),
  );
}

/** Lo primero que se ve: cuánto se puede gastar y a qué ritmo (o el balance si no hay presupuestos). */
function availableBlock(a, t) {
  if (!a) {
    return h('div', { class: 'available' }, [
      h('p', { class: 'av-k' }, 'Balance del mes'),
      h('p', { class: 'av-v tnum' }, signedBalance(t.balance)),
      h('p', { class: 'av-s' }, [
        'Crea presupuestos y te diré cuánto puedes gastar cada día. ',
        h('a', { href: '#/presupuestos' }, 'Crear presupuestos'),
      ]),
    ]);
  }
  const over = a.remaining < 0;
  let pace = '';
  if (a.daysLeft > 0 && a.aheadOfPace !== 0) {
    const direction = a.aheadOfPace > 0 ? 'por encima' : 'por debajo';
    pace = `Vas ${money(Math.abs(a.aheadOfPace))} ${direction} del ritmo previsto hasta hoy.`;
  }
  let detail;
  if (over) detail = `Los gastos registrados superan tus presupuestos en ${money(-a.remaining)}.`;
  else if (a.daysLeft > 0)
    detail = `Unos ${money(a.perDay)} al día durante ${a.daysLeft === 1 ? 'el día que falta' : `los ${a.daysLeft} días que faltan`}.`;
  else detail = `Te sobraron ${money(a.remaining)} de tus presupuestos.`;
  return h('div', { class: `available${over ? ' over' : ''}` }, [
    h('p', { class: 'av-k' }, a.daysLeft > 0 ? 'Disponible para gastar' : 'Resultado del mes'),
    h('p', { class: 'av-v tnum' }, money(a.daysLeft > 0 ? Math.max(0, a.remaining) : a.remaining)),
    h('p', { class: 'av-s' }, [detail, pace ? ' ' : '', pace ? h('span', {}, pace) : null]),
  ]);
}

const figure = (label, value, tone) =>
  h('div', { class: 'fig' }, [h('span', {}, label), h('b', { class: `tnum${tone ? ` ${tone}` : ''}` }, value)]);

function categoryBreakdown(list) {
  const cats = expenseByCategory(list, store.categories);
  if (!cats.length)
    return emptyState('Sin gastos este mes', 'Registra tu primer movimiento para ver aquí el desglose.');
  const max = Math.max(...cats.map((c) => c.value));
  return h(
    'ul',
    { class: 'cat-bars' },
    cats.map(({ category, value }) =>
      h('li', {}, [
        h('span', { class: 'ic', style: { background: category.color }, 'aria-hidden': 'true' }, category.icon),
        h('div', { class: 'cb-meta' }, [
          h('div', { class: 'cb-top' }, [
            h('span', { class: 'nm' }, category.name),
            h('span', { class: 'amt tnum' }, money(value)),
          ]),
          h('div', { class: 'track' }, [
            h('div', { class: 'fill', style: { width: `${(value / max) * 100}%`, background: category.color } }),
          ]),
        ]),
      ]),
    ),
  );
}

function budgetPreview(list, month, year) {
  const budgets = store.budgets.filter((b) => b.month === month && b.year === year);
  if (!budgets.length) {
    return emptyState(
      'Sin presupuestos',
      'Define límites por categoría para recibir alertas.',
      h('button', { class: 'btn btn-ghost sm', onclick: () => go('presupuestos') }, 'Crear presupuesto'),
    );
  }
  const rows = budgets
    .map((b) => ({ budget: b, category: store.category(b.categoryId), spent: spentInCategory(list, b.categoryId) }))
    .filter((r) => r.category)
    .map((r) => ({ ...r, status: budgetStatus(r.spent, r.budget.amount) }))
    .sort((a, b) => b.status.pct - a.status.pct) // los más comprometidos primero
    .slice(0, BUDGET_PREVIEW_COUNT);

  return h(
    'div',
    { class: 'bud-list' },
    rows.map(({ category, spent, budget, status }) =>
      h('div', { class: 'bud' }, [
        h('div', { class: 'bud-top' }, [
          h('span', { class: 'nm' }, [
            h('span', { class: 'dotc', style: { background: category.color } }),
            category.name,
          ]),
          h('span', { class: 'fig tnum' }, [h('b', {}, money(spent)), ' de ', money(budget.amount)]),
        ]),
        budgetMeter(status),
      ]),
    ),
  );
}
