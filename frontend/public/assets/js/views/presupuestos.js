// Vista Presupuestos: límite por categoría y mes, con aviso al 80%.
import { h, field, mount } from '../ui/dom.js';
import { toast, runAction } from '../ui/feedback.js';
import { budgetMeter, sumPill } from '../ui/widgets.js';
import { store } from '../core/store.js';
import { money, monthLabel } from '../core/format.js';
import { inMonth, spentInCategory, budgetStatus, BUDGET_WARNING_PCT } from '../domain/selectors.js';

// Las categorías de ingreso no llevan presupuesto de gasto.
const INCOME_CATEGORIES = new Set(['Salario']);

export function render(root, { month, year }) {
  const list = inMonth(store.transactions, month, year);
  const categories = store.categories.filter((c) => !INCOME_CATEGORIES.has(c.name));
  const budgeted = store.budgets.filter((b) => b.month === month && b.year === year).reduce((a, b) => a + b.amount, 0);
  const spent = list.filter((t) => t.type === 'EXPENSE').reduce((a, t) => a + t.amount, 0);

  mount(
    root,
    h('div', { class: 'bud-summary' }, [
      sumPill('Presupuestado', money(budgeted), 'var(--pine)'),
      sumPill('Gastado', money(spent), 'var(--clay)'),
      sumPill('Disponible', money(Math.max(0, budgeted - spent)), 'var(--brass)'),
      h('div', { class: 'spacer' }),
      h('p', { class: 'muted sm' }, `Aviso al llegar al ${BUDGET_WARNING_PCT}% · ${monthLabel(month, year)}`),
    ]),
    h(
      'div',
      { class: 'bud-rows' },
      categories.map((c) => budgetRow(c, list, month, year)),
    ),
  );
}

function budgetRow(category, list, month, year) {
  const spent = spentInCategory(list, category.id);
  const limit = store.budgetFor(category.id, month, year)?.amount ?? 0;
  const status = budgetStatus(spent, limit);

  const input = h('input', {
    class: 'input slim tnum bud-input',
    type: 'number',
    min: '0',
    step: '10',
    inputmode: 'decimal',
    placeholder: 'Sin límite',
    value: limit ? String(limit) : '',
    'aria-label': `Límite de ${category.name}`,
  });
  input.addEventListener('change', async () => {
    const amount = Math.max(0, Number.parseFloat(input.value) || 0);
    const ok = await runAction(input, () => store.setBudget(category.id, month, year, amount));
    if (ok) toast(amount > 0 ? `Límite de ${category.name}: ${money(amount)}` : `Límite de ${category.name} quitado`);
  });

  return h('div', { class: 'bud-row' }, [
    h('div', { class: 'bud-cat' }, [
      h('span', { class: 'ic', style: { background: category.color }, 'aria-hidden': 'true' }, category.icon),
      h('span', { class: 'nm' }, category.name),
    ]),
    h('div', { class: 'bud-mid' }, [
      h('div', { class: 'bud-figs' }, [
        h('span', { class: 'tnum spent' }, money(spent)),
        h('span', { class: 'muted' }, ' gastado'),
      ]),
      status ? budgetMeter(status) : h('div', { class: 'muted sm' }, 'Sin límite definido'),
    ]),
    field('Límite', input),
  ]);
}
