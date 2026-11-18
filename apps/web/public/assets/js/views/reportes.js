// Vista Reportes: resumen, dona por categoría y barras de 6 meses. Exporta a PDF (imprimir).
import { h, mount } from '../ui/dom.js';
import { donut, groupedBars } from '../ui/charts.js';
import { statCard, panel, emptyState } from '../ui/widgets.js';
import { store } from '../core/store.js';
import { money, signedBalance, monthLabel, MONTHS_SHORT } from '../core/format.js';
import { inMonth, totals, savingRate, expenseByCategory, monthlySeries } from '../domain/selectors.js';

const HISTORY_MONTHS = 6;

export function render(root, { month, year }) {
  const list = inMonth(store.transactions, month, year);
  const t = totals(list);
  const cats = expenseByCategory(list, store.categories);
  const history = monthlySeries(store.transactions, month, year, HISTORY_MONTHS, (m) => MONTHS_SHORT[m]);
  const pct = (value) => (t.expense > 0 ? `${Math.round((value / t.expense) * 100)}%` : '0%');

  const legend = h(
    'ul',
    { class: 'legend' },
    cats.map(({ category, value }) =>
      h('li', {}, [
        h('span', { class: 'sw', style: { background: category.color } }),
        h('span', { class: 'lg-nm' }, category.name),
        h('span', { class: 'lg-amt tnum' }, money(value)),
        h('span', { class: 'lg-pct muted' }, pct(value)),
      ]),
    ),
  );

  mount(
    root,
    h('div', { class: 'toolbar' }, [
      h('p', { class: 'muted' }, `Resumen de ${monthLabel(month, year)}`),
      h('button', { class: 'btn btn-ghost sm', onclick: () => window.print() }, 'Exportar PDF'),
    ]),
    h('div', { class: 'stat-grid four' }, [
      statCard('Ingresos', money(t.income), 'var(--pine)'),
      statCard('Gastos', money(t.expense), 'var(--clay)'),
      statCard('Balance', signedBalance(t.balance), 'var(--brass)', { strong: true }),
      statCard('Tasa de ahorro', `${savingRate(t)}%`, 'var(--sage)'),
    ]),
    h('div', { class: 'grid-2' }, [
      panel(
        'Gastos por categoría',
        monthLabel(month, year),
        h('div', { class: 'donut-wrap' }, [
          h('div', {
            class: 'donut-chart',
            html: donut(
              cats.map((c) => ({ label: c.category.name, value: c.value, color: c.category.color })),
              { total: t.expense },
            ),
          }),
          cats.length ? legend : emptyState('Sin gastos', 'No hay gastos este mes para graficar.'),
        ]),
      ),
      panel(
        'Ingresos y gastos',
        `últimos ${HISTORY_MONTHS} meses`,
        h('div', { class: 'chart-pad', html: groupedBars(history, { width: 560, height: 240 }) }),
      ),
    ]),
  );
}
