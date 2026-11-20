// Vista Presupuestos: límite por categoría y mes, con aviso al 80%.
import { h, field, mount } from '../ui/dom.js';
import { toast, runAction } from '../ui/feedback.js';
import { budgetMeter, sumPill } from '../ui/widgets.js';
import { store } from '../core/store.js';
import { money, monthLabel } from '../core/format.js';
import { inMonth, budgetStatus, BUDGET_WARNING_PCT } from '../domain/selectors.js';
import { budgetOverview, parseBudgetAmount } from '../domain/budgets.js';

export function render(root, { month, year }) {
  const list = inMonth(store.transactions, month, year);
  const overview = budgetOverview(list, store.budgets, month, year);
  const previous = new Date(Date.UTC(year, month - 1, 1));
  const source = { month: previous.getUTCMonth(), year: previous.getUTCFullYear() };
  const sourceBudgets =
    source.year >= 2000
      ? store.budgets.filter((b) => b.month === source.month && b.year === source.year && b.amount > 0)
      : [];
  const missing = sourceBudgets.filter((b) => !store.budgetFor(b.categoryId, month, year)).length;
  const copy = h(
    'button',
    {
      class: 'btn btn-ghost sm',
      type: 'button',
      disabled: missing === 0,
      title: missing
        ? `Completa ${missing} categorías sin límite; conserva los límites existentes`
        : sourceBudgets.length
          ? 'Todas las categorías del mes anterior ya tienen un límite en este mes'
          : 'El mes anterior no tiene límites para copiar',
      onclick: () =>
        runAction(copy, async () => {
          const result = await store.copyPreviousBudgets(month, year);
          toast(
            `${result.copied} límites copiados a ${monthLabel(month, year)}; ${result.existing} categorías ya tenían límite`,
          );
        }),
    },
    'Copiar del mes anterior',
  );

  mount(
    root,
    h('div', { class: 'toolbar' }, [
      h(
        'p',
        { class: 'muted' },
        'Copia los límites del mes anterior para completar las categorías que aún no tienen uno.',
      ),
      copy,
    ]),
    h('div', { class: 'bud-summary' }, [
      sumPill('Presupuestado', money(overview.budgeted), 'var(--pine)'),
      sumPill('Gastos con límite', money(overview.limitedSpent), 'var(--clay)'),
      sumPill(
        overview.remaining < 0 ? 'Excedido' : 'Disponible',
        money(Math.abs(overview.remaining)),
        overview.remaining < 0 ? 'var(--clay)' : 'var(--brass)',
      ),
      sumPill('Gastos sin límite', money(overview.unbudgetedSpent), 'var(--ink-soft)'),
      h('div', { class: 'spacer' }),
      h('p', { class: 'muted sm' }, `Aviso al llegar al ${BUDGET_WARNING_PCT}% · ${monthLabel(month, year)}`),
    ]),
    h(
      'p',
      { class: 'muted sm' },
      'Disponible compara los límites con los gastos de esas categorías. Los gastos sin límite se muestran aparte. Se incluyen todos los movimientos del mes, también los de fechas futuras. Los límites se guardan al salir del campo; déjalo vacío o escribe 0 para quitarlo.',
    ),
    h(
      'div',
      { class: 'bud-rows' },
      store.categories.map((c) => budgetRow(c, overview.spentByCategory.get(c.id) || 0, month, year)),
    ),
  );
}

function budgetRow(category, spent, month, year) {
  const limit = store.budgetFor(category.id, month, year)?.amount ?? 0;
  const status = budgetStatus(spent, limit);

  const input = h('input', {
    class: 'input slim tnum bud-input',
    type: 'number',
    min: '0',
    max: '9999999999.99',
    step: '0.01',
    inputmode: 'decimal',
    placeholder: 'Sin límite',
    value: limit ? String(limit) : '',
    'aria-label': `Límite de ${category.name}`,
  });
  const currency = store.user.currency;
  const error = h('span', { class: 'field-error', id: `budget-error-${category.id}`, role: 'alert', hidden: true });
  const retry = h(
    'button',
    { type: 'button', class: 'link-btn', hidden: true, onclick: () => save() },
    'Reintentar guardado',
  );
  const saving = h('span', { class: 'field-hint', role: 'status', 'aria-live': 'polite', hidden: true }, 'Guardando…');
  const showError = (message) => {
    error.textContent = message;
    error.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', error.id);
  };
  async function save() {
    if (input.disabled || input.getAttribute('aria-busy') === 'true') return;
    let amount;
    try {
      amount = parseBudgetAmount(input.value, { badInput: input.validity?.badInput });
    } catch (err) {
      retry.hidden = true;
      showError(`${err.message}. El límite guardado se conserva.`);
      return;
    }
    error.hidden = true;
    retry.hidden = true;
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
    input.disabled = true;
    input.setAttribute('aria-busy', 'true');
    saving.hidden = false;
    try {
      const saved = await store.setBudget(category.id, month, year, amount);
      if (input.isConnected && store.user.currency === currency) input.value = saved ? String(saved.amount) : '';
      toast(`Límite de ${category.name} ${saved ? 'guardado' : 'quitado'} para ${monthLabel(month, year)}`);
    } catch (err) {
      showError(`${err.message}. No se pudo confirmar el guardado. Reintenta para actualizarlo.`);
      retry.hidden = false;
    } finally {
      input.disabled = false;
      input.removeAttribute('aria-busy');
      saving.hidden = true;
    }
  }
  input.addEventListener('change', save);

  return h('div', { class: 'bud-row' }, [
    h('div', { class: 'bud-cat' }, [
      h('span', { class: 'ic', style: { background: category.color }, 'aria-hidden': 'true' }, category.icon),
      h('span', { class: 'nm' }, category.name),
    ]),
    h('div', { class: 'bud-mid' }, [
      h('div', { class: 'bud-figs' }, [
        h('span', { class: 'tnum spent' }, money(spent)),
        h('span', { class: 'muted' }, ' del mes'),
      ]),
      status ? budgetMeter(status) : h('div', { class: 'muted sm' }, 'Sin límite definido'),
    ]),
    h('div', {}, [field('Límite', input), saving, error, retry]),
  ]);
}
