// Vista Resumen: totales del mes, flujo semanal, categorías, presupuestos y recientes.
import { h, mount } from '../ui/dom.js';
import { groupedBars } from '../ui/charts.js';
import { statCard, panel, emptyState, budgetMeter, movementRow } from '../ui/widgets.js';
import { store } from '../core/store.js';
import { go } from '../core/router.js';
import { money, signedBalance, monthLabel } from '../core/format.js';
import { inMonth, totals, expenseByCategory, weeklyFlow, budgetStatus, spentInCategory } from '../domain/selectors.js';

const RECENT_COUNT = 6;
const BUDGET_PREVIEW_COUNT = 4;

export function render(root, { month, year }) {
  const list = inMonth(store.transactions, month, year);
  const t = totals(list);

  mount(
    root,
    h('div', { class: 'stat-grid' }, [
      statCard('Ingresos', money(t.income), 'var(--pine)'),
      statCard('Gastos', money(t.expense), 'var(--clay)'),
      statCard('Balance', signedBalance(t.balance), 'var(--brass)', { strong: true }),
    ]),
    h('div', { class: 'grid-2' }, [
      panel(
        'Flujo semanal',
        'ingresos vs. gastos',
        h('div', { class: 'chart-pad', html: groupedBars(weeklyFlow(list, month, year), { width: 560, height: 220 }) }),
      ),
      panel('Gasto por categoría', monthLabel(month, year), categoryBreakdown(list)),
    ]),
    h('div', { class: 'grid-2' }, [
      panel('Presupuestos', 'alertas del mes', budgetPreview(list, month, year)),
      panel(
        'Movimientos recientes',
        `${list.length} este mes`,
        list.length
          ? h('ul', { class: 'mv-list' }, list.slice(0, RECENT_COUNT).map(movementRow))
          : emptyState('Todo tranquilo', 'Aún no hay movimientos en este mes.'),
        h('a', { class: 'link-btn', href: '#/movimientos' }, 'Ver todos'),
      ),
    ]),
  );
}

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
