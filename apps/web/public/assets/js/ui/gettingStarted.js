import { h } from './dom.js';

/** Solo se ofrece cuando toda la cuenta está vacía, no al cambiar a un mes sin actividad. */
export function gettingStartedCard(
  { accounts, transactions, budgets, transactionCount = transactions.length },
  onAddMovement,
) {
  if (transactionCount || budgets.length || accounts.some((a) => Number(a.initialBalance) !== 0)) return null;

  const step = (number, title, detail, action) =>
    h('li', { class: 'getting-started-step' }, [
      h('span', { class: 'getting-started-number', 'aria-hidden': 'true' }, number),
      h('div', {}, [h('h3', {}, title), h('p', {}, detail), action]),
    ]);

  return h('section', { class: 'panel getting-started', 'aria-labelledby': 'getting-started-title' }, [
    h('h2', { id: 'getting-started-title' }, 'Empieza con tus propios datos'),
    h('p', {}, 'Tu cuenta comienza en cero. Registra únicamente el dinero y los movimientos que son tuyos.'),
    h('ol', { class: 'getting-started-steps' }, [
      step(
        '1',
        'Revisa tus cuentas',
        'Indica cuánto tienes en efectivo o en el banco. El saldo inicial no cuenta como ingreso del mes.',
        h('a', { class: 'link-btn', href: '#/cuentas' }, 'Configurar mis cuentas'),
      ),
      step(
        '2',
        'Registra tu primer movimiento',
        'Añade un ingreso o gasto con su fecha, categoría y cuenta.',
        h('button', { class: 'btn sm', type: 'button', onclick: () => onAddMovement() }, 'Nuevo movimiento'),
      ),
      step(
        '3',
        'Define tus límites',
        'Crea presupuestos con los importes que tú decidas.',
        h('a', { class: 'link-btn', href: '#/presupuestos' }, 'Crear presupuesto'),
      ),
    ]),
    h('a', { class: 'link-btn', href: '#/perfil' }, '¿Ya tienes datos? Restaura un respaldo desde tu perfil'),
  ]);
}
