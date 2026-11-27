// Vista Perfil: datos personales, moneda, contraseña y gestión de datos.
import { h, field, mount, downloadText } from '../ui/dom.js';
import { toast, confirmDialog, runAction, openModal, closeModal } from '../ui/feedback.js';
import { panel } from '../ui/widgets.js';
import { exportTransactionsCsv } from '../ui/exportCsv.js';
import { store } from '../core/store.js';
import { api } from '../core/api.js';
import { CURRENCIES, MONTHS, isoDate } from '../core/format.js';
import { THEMES, getTheme, setTheme } from '../core/theme.js';
import { currencyExchange, currencyChangeNote } from '../ui/currencyExchange.js';
import { CHART_STYLES, getChartStyle, setChartStyle } from '../core/chartStyle.js';

const MIN_PASSWORD = 6;

export function render(root) {
  mount(
    root,
    h('div', { class: 'profile-grid' }, [
      h('div', { class: 'profile-col' }, [personalPanel(), appearancePanel(), chartStylePanel(), securityPanel()]),
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
    CURRENCIES.map((c) => h('option', { value: c.code, selected: c.code === user.currency }, c.label)),
  );
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Guardar cambios');
  const exchange = currencyExchange(currency, user);

  const form = h('form', { class: 'form', novalidate: true }, [
    field('Nombre', name),
    field('Correo', email, 'El correo es tu usuario para ingresar; no se puede cambiar.'),
    field('Moneda', currency, 'Al cambiarla se convierten tus importes con la tasa que confirmes.'),
    exchange.element,
    user.lastCurrencyChange ? h('p', { class: 'field-hint' }, currencyChangeNote(user.lastCurrencyChange)) : null,
    h('div', { class: 'modal-actions' }, [h('div', { class: 'spacer' }), submit]),
  ]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submit.disabled) return;
    if (name.value.trim().length < 2) return toast('Escribe tu nombre', 'warn');
    // Capturar antes del diálogo: la cotización confirmada debe ser la aplicada.
    const payload = { name: name.value.trim(), currency: currency.value };
    const changing = payload.currency !== user.currency;
    if (changing) {
      try {
        payload.exchange = exchange.change();
      } catch (err) {
        return toast(err.message, 'warn');
      }
    }
    submit.disabled = true;
    try {
      if (
        changing &&
        !(await confirmDialog(
          `Se convertirán tus cuentas, movimientos, presupuestos, operaciones, recurrencias y metas de ${user.currency} a ${payload.currency}, con 1 USD = ${payload.exchange.copPerUsd} COP. Se redondeará cada importe a 2 decimales; al volver a cambiar de moneda pueden existir diferencias de centavos. ¿Aplicar esta conversión?`,
          { confirmText: 'Convertir importes', danger: false },
        ))
      )
        return;
      const ok = await runAction(submit, () => store.updateProfile(payload));
      if (ok) toast(changing ? 'Importes convertidos y perfil actualizado' : 'Perfil actualizado');
    } finally {
      if (submit.isConnected) submit.disabled = false;
    }
  });

  return panel('Tus datos', 'nombre y preferencias', form);
}

/** Tema de colores: se aplica al instante y se recuerda en este navegador. */
function appearancePanel() {
  const current = getTheme();
  const options = THEMES.map((t) =>
    h('label', { class: 'theme-opt' }, [
      h('input', {
        type: 'radio',
        name: 'theme',
        value: t.id,
        checked: t.id === current,
        onchange: () => setTheme(t.id),
      }),
      h('span', { class: `theme-prev ${t.id}`, 'aria-hidden': 'true' }, [h('i'), h('i'), h('i')]),
      h('span', { class: 'theme-txt' }, [
        h('b', {}, t.label),
        h('span', {}, t.id === 'green' ? 'Fondo oscuro con acentos verdes.' : 'Fondo claro, solo tinta negra.'),
      ]),
    ]),
  );
  return panel(
    'Apariencia',
    'el tema de colores',
    h('div', { class: 'theme-opts', role: 'radiogroup', 'aria-label': 'Tema' }, options),
  );
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

function chartStylePanel() {
  const current = getChartStyle();
  return panel(
    'Diseño de los gráficos',
    'elige cómo ver tus finanzas',
    h('div', { class: 'form' }, [
      h(
        'div',
        { class: 'chart-style-options', role: 'radiogroup', 'aria-label': 'Diseño de los gráficos' },
        CHART_STYLES.map((style) =>
          h('label', { class: 'chart-style-option' }, [
            h('input', {
              type: 'radio',
              name: 'chartStyle',
              value: style.id,
              checked: current === style.id,
              onchange: () => setChartStyle(style.id),
            }),
            h('span', { class: `chart-style-preview ${style.id === '3d' ? 'depth' : ''}`, 'aria-hidden': 'true' }, [
              h('i'),
              h('i'),
              h('i'),
              h('span', { class: 'preview-ring' }),
            ]),
            h('span', {}, [h('b', {}, style.label), h('span', { class: 'field-hint' }, style.description)]),
          ]),
        ),
      ),
      h(
        'p',
        { class: 'field-hint' },
        'Se aplica al Resumen y a Reportes y se recuerda en este navegador. Los importes son los mismos en ambos diseños. Si el equipo no admite 3D, se muestra la vista 2D.',
      ),
    ]),
  );
}

function dataPanel() {
  const { user, transactionCount, categories, accounts } = store;
  const since = new Date(user.createdAt);
  const memberSince = Number.isNaN(since.getTime())
    ? '—'
    : `${since.getDate()} de ${MONTHS[since.getMonth()].toLowerCase()} de ${since.getFullYear()}`;

  const stat = (label, value) =>
    h('div', { class: 'pstat' }, [h('span', { class: 'pstat-v tnum' }, value), h('span', { class: 'pstat-k' }, label)]);

  const resetButton = h('button', { class: 'btn ghost-danger sm' }, 'Reiniciar mis finanzas');
  resetButton.addEventListener('click', async () => {
    const confirmed = await confirmDialog(
      'Se eliminarán tus movimientos, cuentas, categorías propias, presupuestos, metas e historial financiero. Se crearán Efectivo y Banco con saldo cero. Conservas tu usuario y contraseña. Exporta un respaldo antes de continuar.',
      { confirmText: 'Reiniciar en cero' },
    );
    if (confirmed && (await runAction(resetButton, () => store.resetData())))
      toast('Tus finanzas se reiniciaron en cero');
  });

  return panel(
    'Tus datos en FlowMoney',
    `miembro desde el ${memberSince}`,
    h('div', { class: 'data-panel' }, [
      h('div', { class: 'pstat-grid' }, [
        stat('movimientos', String(transactionCount)),
        stat('categorías', String(categories.length)),
        stat('cuentas', String(accounts.length)),
      ]),
      h('div', { class: 'data-action' }, [
        h('div', {}, [
          h('p', { class: 'da-t' }, 'Exportar todos los datos'),
          h(
            'p',
            { class: 'da-s' },
            'Copia JSON con perfil, cuentas, categorías, movimientos y presupuestos. Contiene información privada.',
          ),
        ]),
        h(
          'button',
          {
            class: 'btn btn-ghost sm',
            onclick: () =>
              runAction(null, async () =>
                downloadText(
                  `flowmoney-${isoDate(Date.now())}.json`,
                  JSON.stringify(await api.get('/finance/backup')),
                  'application/json;charset=utf-8',
                ),
              ),
          },
          'Exportar JSON',
        ),
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
            disabled: transactionCount === 0,
            onclick: (event) =>
              runAction(event.currentTarget, async () =>
                exportTransactionsCsv(
                  await store.allTransactions(),
                  `flowmoney-movimientos-${isoDate(Date.now())}.csv`,
                ),
              ),
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
          h('p', { class: 'da-t' }, 'Empezar de cero'),
          h(
            'p',
            { class: 'da-s' },
            'Borra tus datos financieros y deja tus cuentas en cero. Exporta un respaldo primero; no se puede deshacer.',
          ),
        ]),
        resetButton,
      ]),
      h('div', { class: 'data-action danger' }, [
        h('div', {}, [
          h('p', { class: 'da-t' }, 'Eliminar mi cuenta'),
          h('p', { class: 'da-s' }, 'Borra tu cuenta y todos tus datos de forma definitiva.'),
        ]),
        h('button', { class: 'btn ghost-danger sm', onclick: openDeleteAccount }, 'Eliminar cuenta'),
      ]),
      h('p', { class: 'legal-links' }, [
        'Tus derechos sobre tus datos: ',
        h(
          'a',
          { href: 'privacidad.html#derechos', target: '_blank', rel: 'noopener' },
          'Política de tratamiento de datos',
        ),
        ' · ',
        h('a', { href: 'terminos.html', target: '_blank', rel: 'noopener' }, 'Términos de uso'),
      ]),
    ]),
  );
}

/**
 * Derecho de supresión (Ley 1581 de 2012): explica qué se borra y pide la contraseña,
 * porque no se puede deshacer.
 */
function openDeleteAccount() {
  const password = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', maxlength: '128' });
  const submit = h('button', { type: 'submit', class: 'btn btn-danger' }, 'Eliminar definitivamente');
  const form = h('form', { class: 'form', novalidate: true }, [
    h('p', { class: 'confirm-msg' }, [
      'Se borrarán de inmediato tu cuenta, tus movimientos, cuentas, categorías propias y presupuestos. ',
      h('strong', {}, 'No se puede deshacer.'),
      ' Si quieres conservar tu historial, exporta tus movimientos antes.',
    ]),
    field('Escribe tu contraseña para confirmar', password),
    h('div', { class: 'modal-actions' }, [
      h('div', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: closeModal }, 'Cancelar'),
      submit,
    ]),
  ]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!password.value) return toast('Escribe tu contraseña para confirmar', 'warn');
    await runAction(submit, () => store.deleteProfile(password.value));
  });
  openModal('Eliminar mi cuenta', form);
  password.focus();
}
