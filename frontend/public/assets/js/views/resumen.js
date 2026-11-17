// Vista Resumen: totales del mes, flujo semanal, categorías, presupuestos y recientes.
import { h, mount } from '../ui/dom.js';
import { groupedBars } from '../ui/charts.js';
import { panel, emptyState, budgetMeter, movementRow } from '../ui/widgets.js';
import { store } from '../core/store.js';
import { go } from '../core/router.js';
import { money, signedBalance, monthLabel, MONTHS } from '../core/format.js';
import {
  inMonth,
  totals,
  savingRate,
  expenseByCategory,
  weeklyFlow,
  budgetStatus,
  spentInCategory,
  availableToSpend,
  dailyExpense,
} from '../domain/selectors.js';
import { webglAvailable } from '../ui/three/scene3d.js';
import { mountColumns } from '../ui/three/columnsScene.js';

const RECENT_COUNT = 6;
const BUDGET_PREVIEW_COUNT = 4;

export function render(root, { month, year }) {
  const list = inMonth(store.transactions, month, year);
  const t = totals(list);
  const today = new Date();
  const available = availableToSpend(list, store.budgets, month, year, today);

  mount(
    root,
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
      spendChart(list, month, year, today, available),
      panel('Presupuestos', 'el más ajustado primero', budgetPreview(list, month, year)),
    ]),
    h('div', { class: 'grid-2' }, [
      panel(
        'Flujo semanal',
        'ingresos vs. gastos',
        h('div', { class: 'chart-pad', html: groupedBars(weeklyFlow(list, month, year), { width: 560, height: 220 }) }),
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
  if (a.daysLeft > 0 && Math.abs(a.aheadOfPace) >= 1) {
    pace =
      a.aheadOfPace > 0
        ? `Vas ${money(Math.round(a.aheadOfPace))} por encima del ritmo parejo.`
        : `Vas ${money(Math.round(-a.aheadOfPace))} por debajo del ritmo parejo.`;
  }
  let detail;
  if (over) detail = `Te pasaste ${money(-a.remaining)} de la suma de tus presupuestos.`;
  else if (a.daysLeft > 0)
    detail = `Unos ${money(Math.floor(a.perDay))} al día durante ${a.daysLeft === 1 ? 'el día que falta' : `los ${a.daysLeft} días que faltan`}.`;
  else detail = `Te sobraron ${money(a.remaining)} de tus presupuestos.`;
  return h('div', { class: `available${over ? ' over' : ''}` }, [
    h('p', { class: 'av-k' }, a.daysLeft > 0 ? 'Disponible para gastar' : 'Resultado del mes'),
    h('p', { class: 'av-v tnum' }, money(Math.max(0, a.remaining))),
    h('p', { class: 'av-s' }, [detail, pace ? ' ' : '', pace ? h('span', {}, pace) : null]),
  ]);
}

const figure = (label, value, tone) =>
  h('div', { class: 'fig' }, [h('span', {}, label), h('b', { class: `tnum${tone ? ` ${tone}` : ''}` }, value)]);

/** Gasto acumulado del mes: columnas 3D con Three.js o, sin WebGL, las barras semanales. */
function spendChart(list, month, year, today, available) {
  const days = dailyExpense(list, month, year);
  const isCurrent = today.getMonth() === month && today.getFullYear() === year;
  const isPast = year * 12 + month < today.getFullYear() * 12 + today.getMonth();
  let lastDay = 0;
  if (isPast) lastDay = days.length;
  else if (isCurrent) lastDay = today.getDate();
  const shortMonth = MONTHS[month].slice(0, 3).toLowerCase();
  const total = days[days.length - 1].cumulative;

  const card = h('section', { class: 'panel chart3d' }, [
    h('div', { class: 'panel-head' }, [
      h('div', {}, [
        h('h3', {}, 'Gasto acumulado'),
        h('span', { class: 'sub' }, `${monthLabel(month, year)}, una columna por día`),
      ]),
      h('div', { class: 'legend' }, [
        h('span', {}, [h('i', { class: 'lg-spent' }), 'Gastado']),
        lastDay < days.length ? h('span', {}, [h('i', { class: 'lg-proj' }), 'Proyección']) : null,
        available ? h('span', {}, [h('i', { class: 'lg-limit' }), 'Presupuestos']) : null,
      ]),
    ]),
  ]);
  if (!webglAvailable()) {
    card.append(
      h('div', { class: 'chart-pad', html: groupedBars(weeklyFlow(list, month, year), { width: 560, height: 220 }) }),
    );
    return card;
  }
  const canvas = h('canvas', { class: 'scene', 'aria-hidden': 'true' });
  const labels = h('div', { class: 'scene-labels' });
  const perDay = available ? available.perDay : 0;
  card.append(
    h(
      'div',
      {
        class: 'scene-box',
        role: 'img',
        'aria-label': `Gasto acumulado de ${monthLabel(month, year)}: ${money(total)}`,
      },
      [canvas, labels],
    ),
  );
  const lastReal = lastDay ? days[lastDay - 1].cumulative : 0;
  const end = lastReal + Math.max(0, days.length - lastDay) * perDay;
  // Se monta cuando el canvas ya está en el documento (tiene tamaño).
  requestAnimationFrame(() =>
    mountColumns(canvas, {
      days,
      today: lastDay,
      limit: available?.limit ?? null,
      perDay,
      labels,
      text: {
        today: `${isCurrent ? `Hoy, ${lastDay} ${shortMonth}` : 'Total'} <b>${money(lastReal)}</b>`,
        limit: `Presupuestos <b>${money(available?.limit ?? 0)}</b>`,
        end: `Cierre si sigues así <b>${money(Math.round(end))}</b>`,
      },
    }),
  );
  return card;
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
