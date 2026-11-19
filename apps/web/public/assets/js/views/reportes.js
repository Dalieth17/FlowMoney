// Vista Reportes: resumen, dona por categoría y barras de 6 meses. Exporta a PDF (imprimir).
import { h, mount, field } from '../ui/dom.js';
import { donut, groupedBars } from '../ui/charts.js';
import { statCard, panel, emptyState } from '../ui/widgets.js';
import { store } from '../core/store.js';
import { money, signedBalance, monthLabel, MONTHS_SHORT } from '../core/format.js';
import { api } from '../core/api.js';

const HISTORY_MONTHS = 6;
const renders = new WeakMap();
let selectedAccount = 'all';

export async function render(root, { month, year }) {
  const token = Symbol();
  renders.set(root, token);
  const currency = store.user.currency;
  const active = () =>
    root.isConnected &&
    location.hash === '#/reportes' &&
    renders.get(root) === token &&
    store.user.currency === currency;
  if (!['all', 'none', ...store.accounts.map((a) => String(a.id))].includes(selectedAccount)) selectedAccount = 'all';
  const account = h(
    'select',
    {
      class: 'input',
      onchange: () => {
        selectedAccount = account.value;
        render(root, { month, year });
      },
    },
    [['all', 'Todas las cuentas'], ['none', 'Sin cuenta'], ...store.accounts.map((a) => [String(a.id), a.name])].map(
      ([value, label]) => h('option', { value, selected: value === selectedAccount }, label),
    ),
  );
  const pdf = h(
    'button',
    { class: 'btn btn-ghost sm no-print', disabled: true, onclick: () => window.print() },
    'Exportar PDF',
  );
  const scope =
    selectedAccount === 'all'
      ? 'Todas las cuentas'
      : selectedAccount === 'none'
        ? 'Sin cuenta'
        : store.accounts.find((a) => String(a.id) === selectedAccount)?.name;
  const body = h('div', { class: 'report-content', 'aria-busy': 'true', 'aria-live': 'polite' }, 'Cargando reporte…');
  mount(
    root,
    h('div', { class: 'toolbar' }, [
      h('p', { class: 'muted' }, `Resumen de ${monthLabel(month, year)} · ${scope}`),
      h('div', { class: 'no-print' }, field('Filtrar por cuenta', account)),
      pdf,
    ]),
    body,
  );
  let data;
  try {
    const query = new URLSearchParams({ month, year });
    if (selectedAccount !== 'all') query.set('accountId', selectedAccount);
    data = await api.get(`/reports/monthly?${query}`);
    if (!active()) return;
    if (data.currency !== currency) throw Error('La moneda cambió. Recarga los datos antes de generar el reporte.');
  } catch (err) {
    if (active()) {
      body.setAttribute('aria-busy', 'false');
      mount(
        body,
        h('p', { role: 'alert' }, err.message),
        h('button', { class: 'btn btn-ghost sm', onclick: () => render(root, { month, year }) }, 'Reintentar'),
      );
    }
    return;
  }
  body.setAttribute('aria-busy', 'false');
  pdf.disabled = false;
  const t = data.summary;
  const cats = data.categories;
  const history = data.history.map((r) => ({ ...r, label: `${MONTHS_SHORT[r.month]} ${r.year}` }));
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
    body,
    h('div', { class: 'stat-grid four' }, [
      statCard('Ingresos', money(t.income), 'var(--pine)'),
      statCard('Gastos', money(t.expense), 'var(--clay)'),
      statCard('Balance', signedBalance(t.balance), 'var(--brass)', { strong: true }),
      statCard('Tasa de ahorro', `${t.savingRate}%`, 'var(--sage)'),
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
    panel(
      'Actividad por cuenta',
      'Ingresos y gastos del mes. Las transferencias y conciliaciones no se cuentan como consumo.',
      data.accounts.length
        ? accountActivity(data.accounts)
        : emptyState('Sin movimientos', 'No hay ingresos ni gastos en este período.'),
    ),
  );
}

function accountActivity(accounts) {
  const width = Math.max(560, accounts.length * 140);
  return h('div', {}, [
    h(
      'div',
      {
        class: 'account-chart-scroll',
        tabindex: '0',
        role: 'region',
        'aria-label': 'Gráfico de ingresos y gastos por cuenta',
      },
      h('div', {
        style: { minWidth: `${width}px`, width: `${width}px`, marginInline: 'auto' },
        html: groupedBars(
          accounts.map((a) => ({ ...a, label: a.label.length > 18 ? `${a.label.slice(0, 17)}…` : a.label })),
          { width, height: 240 },
        ),
      }),
    ),
    h(
      'div',
      { class: 'report-table-wrap' },
      h('table', { class: 'report-table' }, [
        h('caption', { class: 'muted' }, 'Importes del mes por cuenta'),
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            ['Cuenta', 'Ingresos', 'Gastos'].map((label) => h('th', { scope: 'col' }, label)),
          ),
        ),
        h(
          'tbody',
          {},
          accounts.map((a) =>
            h('tr', {}, [
              h('th', { scope: 'row' }, a.label),
              h('td', { class: 'tnum' }, money(a.income)),
              h('td', { class: 'tnum' }, money(a.expense)),
            ]),
          ),
        ),
      ]),
    ),
  ]);
}
