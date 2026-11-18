// Formulario de cuenta: nombre, tipo y saldo inicial.
import { h, field } from '../ui/dom.js';
import { openModal, closeModal, toast, runAction } from '../ui/feedback.js';
import { store } from '../core/store.js';
import { getCurrency } from '../core/format.js';
import { ACCOUNT_TYPES } from '../domain/accountTypes.js';

export function openAccountForm(existing) {
  const editing = Boolean(existing);

  const name = h('input', {
    class: 'input',
    type: 'text',
    maxlength: '40',
    required: true,
    placeholder: 'Ej. Cuenta sueldo',
    value: existing?.name ?? '',
  });
  const type = h(
    'select',
    { class: 'input' },
    Object.entries(ACCOUNT_TYPES).map(([value, t]) =>
      h('option', { value, selected: value === (existing?.type ?? 'BANK') }, `${t.icon}  ${t.label}`),
    ),
  );
  const initialBalance = h('input', {
    class: 'input tnum',
    type: 'number',
    step: '0.01',
    inputmode: 'decimal',
    value: String(existing?.initialBalance ?? 0),
  });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, editing ? 'Guardar' : 'Crear cuenta');

  const form = h('form', { class: 'form', novalidate: true }, [
    field('Nombre', name),
    h('div', { class: 'form-row' }, [
      field('Tipo', type),
      field(`Saldo inicial (${getCurrency()})`, initialBalance, 'Lo que tenía la cuenta antes de usar FlowMoney.'),
    ]),
    h('div', { class: 'modal-actions' }, [
      h('div', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: closeModal }, 'Cancelar'),
      submit,
    ]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!name.value.trim()) return toast('Ponle un nombre a la cuenta', 'warn');
    const balance = Number.parseFloat(initialBalance.value || '0');
    if (!Number.isFinite(balance)) return toast('Saldo inicial no válido', 'warn');
    const payload = { name: name.value.trim(), type: type.value, initialBalance: Math.round(balance * 100) / 100 };
    const ok = await runAction(submit, () =>
      editing ? store.updateAccount(existing.id, payload) : store.addAccount(payload),
    );
    if (ok) {
      closeModal();
      toast(editing ? 'Cuenta actualizada' : 'Cuenta creada');
    }
  });

  openModal(editing ? 'Editar cuenta' : 'Nueva cuenta', form);
}
