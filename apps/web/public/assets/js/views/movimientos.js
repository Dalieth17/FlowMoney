// Vista Movimientos: lista del mes con búsqueda, filtros y exportación a CSV.
import { h, mount } from '../ui/dom.js';
import { movementFilter, filterIcon } from '../ui/movementFilter.js';
import { ACCOUNT_TYPES } from '../domain/accountTypes.js';
import { emptyState, movementRow } from '../ui/widgets.js';
import { exportTransactionsCsv } from '../ui/exportCsv.js';
import { store } from '../core/store.js';
import { money } from '../core/format.js';
import { inMonth, totals, filterTransactions } from '../domain/selectors.js';
import { openMovementForm } from '../forms/movementForm.js';
import { openTransactionImport } from '../forms/importTransactions.js';

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
  let page = 0;
  const pageSize = 50;
  const previous = h(
    'button',
    {
      class: 'btn btn-ghost sm',
      type: 'button',
      onclick: () => {
        page--;
        draw();
      },
    },
    'Anterior',
  );
  const next = h(
    'button',
    {
      class: 'btn btn-ghost sm',
      type: 'button',
      onclick: () => {
        page++;
        draw();
      },
    },
    'Siguiente',
  );
  const pageLabel = h('span', { 'aria-live': 'polite' });

  const summary = h('div', { class: 'toolbar-sum tnum', 'aria-live': 'polite' });
  const activeFilters = h('div', {
    class: 'active-filters',
    role: 'group',
    'aria-label': 'Filtros activos',
    hidden: true,
  });
  const resetControls = {};
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
          root.querySelector('[aria-label="Buscar movimientos"]')?.focus();
        },
      },
      'Limpiar filtros',
    );
  const resetButton = makeResetButton();

  function drawFilters() {
    const labels = {
      type: `Tipo: ${filters.type === 'INCOME' ? 'Ingresos' : 'Gastos'}`,
      categoryId: `Categoría: ${store.category(Number(filters.categoryId))?.name ?? ''}`,
      accountId: `Cuenta: ${store.account(Number(filters.accountId))?.name ?? ''}`,
      query: `Búsqueda: “${filters.query}”`,
    };
    activeFilters.hidden = !isFiltered();
    activeFilters.replaceChildren(
      ...Object.keys(DEFAULT_FILTERS)
        .filter((key) => filters[key] !== DEFAULT_FILTERS[key])
        .map((key) =>
          h(
            'button',
            {
              type: 'button',
              class: 'filter-chip',
              title: `Quitar ${labels[key]}`,
              'aria-label': `Quitar filtro ${labels[key]}`,
              onclick: () => {
                filters[key] = DEFAULT_FILTERS[key];
                resetControls[key]();
                page = 0;
                draw();
              },
            },
            [h('span', { class: 'filter-chip-text' }, labels[key]), h('span', { 'aria-hidden': 'true' }, '×')],
          ),
        ),
      resetButton,
    );
  }

  function draw() {
    visible = filterTransactions(monthList, filters);
    const t = totals(visible);
    const pages = Math.max(1, Math.ceil(visible.length / pageSize));
    page = Math.max(0, Math.min(page, pages - 1));
    previous.disabled = page === 0;
    next.disabled = page === pages - 1;
    pageLabel.textContent = `Página ${page + 1} de ${pages}`;
    summary.replaceChildren(
      h('div', { class: 'movement-metric count' }, [
        h('span', {}, 'Movimientos'),
        h('b', {}, `${visible.length} de ${monthList.length}`),
      ]),
      h('div', { class: 'movement-metric in' }, [h('span', {}, 'Ingresos'), h('b', {}, `+${money(t.income)}`)]),
      h('div', { class: 'movement-metric out' }, [h('span', {}, 'Gastos'), h('b', {}, `−${money(t.expense)}`)]),
    );
    listHost.replaceChildren(
      visible.length
        ? h('ul', { class: 'mv-list big' }, visible.slice(page * pageSize, (page + 1) * pageSize).map(movementRow))
        : monthList.length
          ? emptyState('Sin resultados', 'Ningún movimiento coincide con la búsqueda o los filtros.', makeResetButton())
          : emptyState(
              'Sin movimientos este mes',
              'Registra un ingreso o un gasto para empezar.',
              h('button', { class: 'btn btn-primary sm', onclick: () => openMovementForm() }, 'Nuevo movimiento'),
            ),
    );
    exportButton.disabled = visible.length === 0;
    drawFilters();
    exportButton.title = `Exportar ${visible.length} movimientos${isFiltered() ? ' filtrados' : ' del mes'}`;
    listHost.append(
      h('nav', { class: 'toolbar', 'aria-label': 'Páginas de movimientos' }, [previous, pageLabel, next]),
    );
  }

  const search = h('input', {
    class: 'movement-query',
    type: 'search',
    placeholder: 'Descripción o nota…',
    value: filters.query,
    'aria-label': 'Buscar movimientos',
  });
  resetControls.query = () => {
    search.value = '';
    search.focus();
  };
  search.addEventListener('input', () => {
    filters.query = search.value;
    page = 0;
    draw();
  });

  const select = (key, label, options) => {
    const picker = movementFilter({
      key,
      label,
      options,
      value: filters[key],
      onChange: (value) => {
        filters[key] = value;
        page = 0;
        draw();
      },
    });
    resetControls[key] = picker.reset;
    return picker.root;
  };

  mount(
    root,
    h('div', { class: 'movement-tools' }, [
      h('div', { class: 'movement-filters', role: 'group', 'aria-label': 'Filtrar movimientos' }, [
        h('label', { class: 'movement-search' }, [
          filterIcon('search'),
          h('span', { class: 'filter-copy' }, [h('small', {}, 'Buscar'), search]),
        ]),
        select('type', 'Tipo', [
          { value: 'ALL', name: 'Todos los tipos' },
          { value: 'INCOME', name: 'Ingresos', icon: '↙' },
          { value: 'EXPENSE', name: 'Gastos', icon: '↗' },
        ]),
        select('categoryId', 'Categoría', [
          { value: 'ALL', name: 'Todas las categorías' },
          ...store.categories.map((c) => ({ value: String(c.id), name: c.name, icon: c.icon, color: c.color })),
        ]),
        select('accountId', 'Cuenta', [
          { value: 'ALL', name: 'Todas las cuentas' },
          ...store.accounts.map((a) => ({ value: String(a.id), name: a.name, icon: ACCOUNT_TYPES[a.type]?.icon })),
        ]),
      ]),
      h('div', { class: 'toolbar-end' }, [
        summary,
        h('button', { class: 'btn btn-ghost sm', onclick: openTransactionImport }, 'Importar CSV'),
        exportButton,
      ]),
    ]),
    activeFilters,
    listHost,
  );
  draw();
}
