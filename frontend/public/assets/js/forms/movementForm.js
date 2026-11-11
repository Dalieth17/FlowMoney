// Formulario de movimiento (crear/editar) con sugerencia de categoría por IA.
import { h, clear, field } from '../ui/dom.js';
import { openModal, closeModal, toast, confirmDialog, runAction } from '../ui/feedback.js';
import { store } from '../core/store.js';
import { isoDate, isoDateToMs } from '../core/format.js';
import { classify, confidenceLabel } from '../domain/classifier.js';

const AI_DEBOUNCE_MS = 180;

export function openMovementForm(existing) {
  const editing = Boolean(existing);
  let type = existing?.type ?? 'EXPENSE';
  let categoryTouched = editing; // al editar no pisamos la categoría elegida

  const description = h('input', {
    class: 'input',
    type: 'text',
    maxlength: '120',
    required: true,
    autocomplete: 'off',
    placeholder: 'Ej. Starbucks, Uber, Sueldo…',
    value: existing?.description ?? '',
  });
  const amount = h('input', {
    class: 'input tnum',
    type: 'number',
    step: '0.01',
    min: '0.01',
    required: true,
    inputmode: 'decimal',
    placeholder: '0.00',
    value: existing ? String(existing.amount) : '',
  });
  const date = h('input', {
    class: 'input',
    type: 'date',
    required: true,
    value: isoDate(existing?.date ?? Date.now()),
  });
  const note = h('textarea', {
    class: 'input',
    rows: '2',
    maxlength: '200',
    placeholder: 'Opcional',
    value: existing?.note ?? '',
  });

  const category = h(
    'select',
    { class: 'input' },
    store.categories.map((c) =>
      h('option', { value: String(c.id), selected: c.id === existing?.categoryId }, `${c.icon}  ${c.name}`),
    ),
  );
  category.addEventListener('change', () => {
    categoryTouched = true;
  });

  const defaultAccountId = editing ? existing.accountId : (store.accounts[0]?.id ?? null);
  const account = h('select', { class: 'input' }, [
    ...store.accounts.map((a) => h('option', { value: String(a.id), selected: a.id === defaultAccountId }, a.name)),
    h('option', { value: '', selected: defaultAccountId == null }, 'Sin cuenta'),
  ]);

  // ---- Tipo (ingreso / gasto) ----
  const typeButtons = {};
  const setType = (value) => {
    type = value;
    Object.entries(typeButtons).forEach(([key, btn]) => {
      const on = key === value;
      btn.classList.toggle('active', on);
      btn.classList.toggle(key === 'INCOME' ? 'in' : 'out', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    suggest();
  };
  typeButtons.INCOME = h('button', { type: 'button', class: 'seg', onclick: () => setType('INCOME') }, 'Ingreso');
  typeButtons.EXPENSE = h('button', { type: 'button', class: 'seg', onclick: () => setType('EXPENSE') }, 'Gasto');
  const segmented = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Tipo de movimiento' }, [
    typeButtons.INCOME,
    typeButtons.EXPENSE,
  ]);

  // ---- Sugerencia de IA ----
  const suggestion = h('div', { class: 'suggest-box', 'aria-live': 'polite' });
  function suggest() {
    clear(suggestion);
    const result = classify(description.value, type);
    const match = result && store.categories.find((c) => c.name === result.name);
    if (!match) return;
    if (!categoryTouched) category.value = String(match.id);
    suggestion.append(
      h('span', { class: 'sugg-lead' }, 'Sugerencia de la IA'),
      h(
        'button',
        {
          type: 'button',
          class: 'sugg-chip',
          title: 'Usar esta categoría',
          onclick: () => {
            category.value = String(match.id);
            categoryTouched = true;
            toast(`Categoría: ${match.name}`);
          },
        },
        [h('span', { class: 'ic', style: { background: match.color }, 'aria-hidden': 'true' }, match.icon), match.name],
      ),
      h(
        'span',
        { class: 'sugg-conf' },
        `confianza ${confidenceLabel(result.confidence)} · ${Math.round(result.confidence * 100)}%`,
      ),
    );
  }
  let timer;
  description.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(suggest, AI_DEBOUNCE_MS);
  });

  // ---- Envío ----
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, editing ? 'Guardar cambios' : 'Guardar');
  const remove = editing
    ? h(
        'button',
        {
          type: 'button',
          class: 'btn ghost-danger',
          onclick: async () => {
            // El diálogo reemplaza al formulario: si cancela, lo reabrimos.
            if (!(await confirmDialog(`¿Eliminar "${existing.description}"?`))) return openMovementForm(existing);
            if (await runAction(null, () => store.deleteTransaction(existing.id))) toast('Movimiento eliminado');
          },
        },
        'Eliminar',
      )
    : null;

  const form = h('form', { class: 'form', novalidate: true }, [
    field('Tipo', segmented),
    field('Descripción', description, 'La IA sugiere la categoría a partir de lo que escribas.'),
    suggestion,
    h('div', { class: 'form-row' }, [field('Monto', amount), field('Fecha', date)]),
    h('div', { class: 'form-row' }, [field('Categoría', category), field('Cuenta', account)]),
    field('Nota', note),
    h('div', { class: 'modal-actions' }, [
      remove,
      h('div', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: closeModal }, 'Cancelar'),
      submit,
    ]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = Number.parseFloat(amount.value);
    if (!description.value.trim()) return toast('Escribe una descripción', 'warn');
    if (!(value > 0)) return toast('El monto debe ser mayor a 0', 'warn');
    if (!date.value) return toast('Elige una fecha', 'warn');

    const payload = {
      description: description.value.trim(),
      amount: Math.round(value * 100) / 100,
      type,
      categoryId: Number(category.value),
      accountId: account.value ? Number(account.value) : null,
      date: isoDateToMs(date.value),
      note: note.value.trim(),
    };
    const ok = await runAction(submit, () =>
      editing ? store.updateTransaction(existing.id, payload) : store.addTransaction(payload),
    );
    if (ok) {
      closeModal();
      toast(editing ? 'Cambios guardados' : 'Movimiento registrado');
    }
  });

  openModal(editing ? 'Editar movimiento' : 'Nuevo movimiento', form);
  setType(type);
}
