// Vista Perfil: datos personales, moneda, contraseña y gestión de datos.
import { h, field, mount } from '../ui/dom.js';
import { toast, confirmDialog, runAction } from '../ui/feedback.js';
import { panel } from '../ui/widgets.js';
import { exportTransactionsCsv } from '../ui/exportCsv.js';
import { store } from '../core/store.js';
import { CURRENCIES, MONTHS, isoDate } from '../core/format.js';

const MIN_PASSWORD = 6;

export function render(root) {
  mount(
    root,
    h('div', { class: 'profile-grid' }, [
      h('div', { class: 'profile-col' }, [personalPanel(), securityPanel()]),
      h('div', { class: 'profile-col' }, [dataPanel()]),
    ]),
  );
}

function personalPanel() {
  const user = store.user;
  const name = h('input', { class: 'input', type: 'text', maxlength: '80', autocomplete: 'name', value: user.name });
  const email = h('input', { class: 'input', type: 'email', value: user.email, readonly: true });
  const currency = h(
    'select',
    { class: 'input' },
    CURRENCIES.map((c) => h('option', { value: c.symbol, selected: c.symbol === user.currency }, c.label)),
  );
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Guardar cambios');

  const form = h('form', { class: 'form', novalidate: true }, [
    field('Nombre', name),
    field('Correo', email, 'El correo es tu usuario para ingresar; no se puede cambiar.'),
    field('Moneda', currency, 'Se usa para mostrar todos los montos.'),
    h('div', { class: 'modal-actions' }, [h('div', { class: 'spacer' }), submit]),
  ]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (name.value.trim().length < 2) return toast('Escribe tu nombre', 'warn');
    const ok = await runAction(submit, () =>
      store.updateProfile({ name: name.value.trim(), currency: currency.value }),
    );
    if (ok) toast('Perfil actualizado');
  });

  return panel('Tus datos', 'nombre y preferencias', form);
}

function securityPanel() {
  const input = (autocomplete) => h('input', { class: 'input', type: 'password', autocomplete, maxlength: '128' });
  const current = input('current-password');
  const next = input('new-password');
  const confirm = input('new-password');
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Cambiar contraseña');

  const form = h('form', { class: 'form', novalidate: true }, [
    field('Contraseña actual', current),
    h('div', { class: 'form-row' }, [
      field('Nueva contraseña', next, `Mínimo ${MIN_PASSWORD} caracteres.`),
      field('Repite la nueva', confirm),
    ]),
    h('div', { class: 'modal-actions' }, [h('div', { class: 'spacer' }), submit]),
  ]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!current.value) return toast('Escribe tu contraseña actual', 'warn');
    if (next.value.length < MIN_PASSWORD)
      return toast(`La nueva contraseña debe tener al menos ${MIN_PASSWORD} caracteres`, 'warn');
    if (next.value !== confirm.value) return toast('Las contraseñas nuevas no coinciden', 'warn');
    const ok = await runAction(submit, () =>
      store.changePassword({ currentPassword: current.value, newPassword: next.value }),
    );
    if (ok) {
      form.reset();
      toast('Contraseña actualizada');
    }
  });

  return panel('Seguridad', 'cambia tu contraseña', form);
}

function dataPanel() {
  const { user, transactions, categories, accounts } = store;
  const since = new Date(user.createdAt);
  const memberSince = Number.isNaN(since.getTime())
    ? '—'
    : `${since.getDate()} de ${MONTHS[since.getMonth()].toLowerCase()} de ${since.getFullYear()}`;

  const stat = (label, value) =>
    h('div', { class: 'pstat' }, [h('span', { class: 'pstat-v tnum' }, value), h('span', { class: 'pstat-k' }, label)]);

  const resetButton = h('button', { class: 'btn ghost-danger sm' }, 'Restaurar datos de ejemplo');
  resetButton.addEventListener('click', async () => {
    const confirmed = await confirmDialog(
      'Se borrarán tus movimientos, categorías propias, cuentas y presupuestos, y se cargará el mes de ejemplo.',
      { confirmText: 'Restaurar' },
    );
    if (confirmed && (await runAction(resetButton, () => store.resetToSample()))) toast('Datos de ejemplo restaurados');
  });

  return panel(
    'Tus datos en FlowMoney',
    `miembro desde el ${memberSince}`,
    h('div', { class: 'data-panel' }, [
      h('div', { class: 'pstat-grid' }, [
        stat('movimientos', String(transactions.length)),
        stat('categorías', String(categories.length)),
        stat('cuentas', String(accounts.length)),
      ]),
      h('div', { class: 'data-action' }, [
        h('div', {}, [
          h('p', { class: 'da-t' }, 'Exportar movimientos'),
          h('p', { class: 'da-s' }, 'Todos tus movimientos en un CSV para Excel o Sheets.'),
        ]),
        h(
          'button',
          {
            class: 'btn btn-ghost sm',
            disabled: transactions.length === 0,
            onclick: () => exportTransactionsCsv(transactions, `flowmoney-movimientos-${isoDate(Date.now())}.csv`),
          },
          'Exportar CSV',
        ),
      ]),
      h('div', { class: 'data-action' }, [
        h('div', {}, [h('p', { class: 'da-t' }, 'Sesión'), h('p', { class: 'da-s' }, `Conectado como ${user.email}`)]),
        h('button', { class: 'btn btn-ghost sm', onclick: () => store.logout() }, 'Cerrar sesión'),
      ]),
      h('div', { class: 'data-action danger' }, [
        h('div', {}, [
          h('p', { class: 'da-t' }, 'Volver al ejemplo'),
          h('p', { class: 'da-s' }, 'Reemplaza todos tus datos por el mes de ejemplo. No se puede deshacer.'),
        ]),
        resetButton,
      ]),
    ]),
  );
}
