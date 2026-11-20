import { h } from './dom.js';
import { ACCOUNT_TYPES } from '../domain/accountTypes.js';
import { money } from '../core/format.js';
let sequence = 0;

/** Radios nativos: teclado, lector de pantalla y nombres seguros, con tarjetas visuales. */
export function accountPicker(accounts, value, { label }) {
  const id = `account-picker-${++sequence}`,
    name = id;
  let current = String(value ?? accounts[0]?.id ?? '');
  const legend = h('legend', { id: `${id}-label`, class: 'field-label' }, label);
  const group = h('div', { class: 'account-options', role: 'radiogroup', 'aria-labelledby': legend.id });
  const root = h('fieldset', { class: 'account-picker', id }, [legend, group]);
  const radios = [];
  const select = (next) => {
    current = String(next);
    for (const radio of radios) radio.checked = radio.value === current;
  };
  for (const account of accounts) {
    const type = ACCOUNT_TYPES[account.type] ?? ACCOUNT_TYPES.CASH;
    const radio = h('input', {
      type: 'radio',
      name,
      value: String(account.id),
      checked: current === String(account.id),
      required: true,
      onchange: () => select(account.id),
    });
    radios.push(radio);
    group.append(
      h('label', { class: 'account-option' }, [
        radio,
        h('span', { class: 'account-option-icon', 'aria-hidden': 'true' }, type.icon),
        h('span', { class: 'account-option-copy' }, [
          h('b', {}, account.name),
          h('small', {}, type.label),
          account.currentBalance != null
            ? h('small', { class: 'tnum' }, `Saldo actual ${money(account.currentBalance)}`)
            : null,
          account.projectedBalance != null && account.projectedBalance !== account.currentBalance
            ? h('small', { class: 'tnum' }, `Proyectado ${money(account.projectedBalance)}`)
            : null,
        ]),
        h('span', { class: 'account-option-check', 'aria-hidden': 'true' }, '✓'),
      ]),
    );
  }
  if (!accounts.length) group.append(h('p', { class: 'muted' }, 'Crea una cuenta para continuar.'));
  Object.defineProperty(root, 'value', { get: () => current, set: select });
  return root;
}
