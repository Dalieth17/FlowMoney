// Vista Movimientos: lista del mes con búsqueda, filtros y exportación a CSV.
import { h, mount } from '../ui/dom.js';
import { emptyState, movementRow } from '../ui/widgets.js';
import { exportTransactionsCsv } from '../ui/exportCsv.js';
import { store } from '../core/store.js';
import { money } from '../core/format.js';
import { inMonth, totals, filterTransactions } from '../domain/selectors.js';
import { openMovementForm } from '../forms/movementForm.js';

const DEFAULT_FILTERS = Object.freeze({ type: 'ALL', categoryId: 'ALL', accountId: 'ALL', query: '' });
// A nivel de módulo: los filtros sobreviven a los re-renders (p. ej. tras guardar).
let filters = { ...DEFAULT_FILTERS };

const isFiltered = () => Object.keys(DEFAULT_FILTERS).some((k) => filters[k] !== DEFAULT_FILTERS[k]);

export function render(root, { month, year }) {
  // Si la categoría/cuenta filtrada ya no existe, quitamos ese filtro.
  if (filters.categoryId !== 'ALL' && !store.category(Number(filters.categoryId))) filters.categoryId = 'ALL';
  if (filters.accountId !== 'ALL' && !store.account(Number(filters.accountId))) filters.accountId = 'ALL';

  const monthList = inMonth(store.transactions, month, year);
  let visible = [];

  const summary = h('div', { class: 'toolbar-sum tnum', 'aria-live': 'polite' });
  const listHost = h('div');
  const exportButton = h(
    'button',
    {
      class: 'btn btn-ghost sm',
      onclick: () =>
        exportTransactionsCsv(visible, `flowmoney-movimientos-${year}-${String(month + 1).padStart(2, '0')}.csv`),
    },
    'Exportar CSV',
  );
  const makeResetButton = () =>
    h(
      'button',
      {
        class: 'link-btn',
        onclick: () => {
          filters = { ...DEFAULT_FILTERS };
          render(root, { month, year });
        },
      },
      'Limpiar filtros',
    );
  const resetButton = makeResetButton();

  function draw() {
    visible = filterTransactions(monthList, filters);
    const t = totals(visible);
    summary.replaceChildren(
      h('span', { class: 'count' }, `${visible.length} de ${monthList.length}`),
      h('span', { class: 'in' }, `+${money(t.income)}`),
      h('span', { class: 'out' }, `−${money(t.expense)}`),
    );
    listHost.replaceChildren(
      visible.length
        ? h('ul', { class: 'mv-list big' }, visible.map(movementRow))
        : monthList.length
          ? emptyState('Sin resultados', 'Ningún movimiento coincide con la búsqueda o los filtros.', makeResetButton())
          : emptyState(
              'Sin movimientos este mes',
              'Registra un ingreso o un gasto para empezar.',
              h('button', { class: 'btn btn-primary sm', onclick: () => openMovementForm() }, 'Nuevo movimiento'),
            ),
    );
    exportButton.disabled = visible.length === 0;
    resetButton.hidden = !isFiltered();
  }

  const search = h('input', {
    class: 'input slim search',
    type: 'search',
    placeholder: 'Buscar por descripción o nota…',
    value: filters.query,
    'aria-label': 'Buscar movimientos',
  });
  search.addEventListener('input', () => {
    filters.query = search.value;
    draw();
  });

  const select = (key, label, options) => {
    const el = h(
      'select',
      { class: 'input slim', 'aria-label': label },
      options.map(([value, text]) =>
        h('option', { value: String(value), selected: String(filters[key]) === String(value) }, text),
      ),
    );
    el.addEventListener('change', () => {
      filters[key] = el.value;
      draw();
    });
    return el;
  };

  mount(
    root,
    h('div', { class: 'toolbar' }, [
      h('div', { class: 'filters' }, [
        search,
        select('type', 'Tipo', [
          ['ALL', 'Todos los tipos'],
          ['INCOME', 'Ingresos'],
          ['EXPENSE', 'Gastos'],
        ]),
        select('categoryId', 'Categoría', [
          ['ALL', 'Todas las categorías'],
          ...store.categories.map((c) => [c.id, `${c.icon}  ${c.name}`]),
        ]),
        select('accountId', 'Cuenta', [['ALL', 'Todas las cuentas'], ...store.accounts.map((a) => [a.id, a.name])]),
        resetButton,
      ]),
      h('div', { class: 'toolbar-end' }, [summary, exportButton]),
    ]),
    listHost,
  );
  draw();
}
