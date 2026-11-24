import { h, field, mount, downloadText } from '../ui/dom.js';
import { panel } from '../ui/widgets.js';
import { toast, toastError, runAction, confirmDialog } from '../ui/feedback.js';
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { money, isoDate, isoDateToMs } from '../core/format.js';
import { uuid } from '../core/id.js';
import { accountPicker } from '../ui/accountPicker.js';

const input = (type, value = '', attrs = {}) => h('input', { class: 'input', type, value, ...attrs });
const select = (items, value) =>
  h(
    'select',
    { class: 'input' },
    items.map(([id, name]) =>
      h('option', { value: id, selected: String(id) === String(value ?? items[0]?.[0]) }, name),
    ),
  );
const accountSelect = (value, label = 'Cuenta') => accountPicker(store.accounts, value, { label });
const categorySelect = (value) =>
  select(
    store.categories.map((c) => [c.id, c.name]),
    value,
  );
const button = (text, onclick) => h('button', { type: 'button', class: 'btn btn-ghost sm', onclick }, text);
function form(fields, label, action) {
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, label);
  const root = h('form', { class: 'form' }, [...fields, submit]);
  root.addEventListener('submit', async (e) => {
    e.preventDefault();
    await runAction(submit, action);
  });
  return root;
}
async function refreshed() {
  await store.load();
}
function transferForm(existing) {
  const d = existing?.data;
  const id = existing?.id ?? uuid();
  const from = accountSelect(d?.fromAccountId, 'Desde'),
    to = accountSelect(d?.toAccountId ?? store.accounts[1]?.id, 'Hacia');
  const amount = input('number', d?.amount ?? '', { min: '0.01', max: '9999999999.99', step: '0.01', required: true });
  const fee = input('number', d?.fee ?? 0, { min: 0, step: '0.01' });
  const category = categorySelect(d?.categoryId);
  const date = input('date', isoDate(d?.date ?? Date.now()), { required: true, min: '2000-01-01', max: '2100-12-31' });
  const description = input('text', d?.description ?? 'Transferencia entre cuentas', {
    required: true,
    maxlength: 120,
  });
  const note = input('text', d?.note ?? '', { maxlength: 200 });
  return form(
    [
      h('div', { class: 'transfer-accounts' }, [from, to]),
      field('Monto', amount),
      field('Comisión (gasto real)', fee),
      field('Categoría de la comisión', category),
      field('Fecha', date),
      field('Descripción', description),
      field('Nota', note),
    ],
    existing ? 'Guardar transferencia' : 'Transferir',
    async () => {
      const payload = {
        fromAccountId: Number(from.value),
        toAccountId: Number(to.value),
        amount: Number(amount.value),
        fee: Number(fee.value),
        categoryId: Number(category.value),
        date: isoDateToMs(date.value),
        description: description.value,
        note: note.value,
      };
      if (payload.fromAccountId === payload.toAccountId)
        throw Error('Elige cuentas distintas para el origen y el destino.');
      await api[existing ? 'put' : 'post'](`/finance/transfers/${id}`, payload);
      toast('Transferencia guardada');
      await refreshed();
    },
  );
}
function reconciliationForm(accounts) {
  const account = accountPicker(accounts, undefined, { label: 'Cuenta y saldo calculado hoy' });
  const actual = input('number', '', { step: '0.01', required: true });
  const note = input('text', '', { required: true, maxlength: 200 });
  const category = categorySelect();
  const id = uuid();
  return form(
    [
      h(
        'p',
        {},
        'Compara el saldo actual con tu banco o efectivo. El ajuste queda registrado y no cuenta como ingreso o gasto. Los movimientos futuros solo aparecen en el saldo proyectado.',
      ),
      account,
      field('Saldo real observado', actual),
      field('Motivo de la diferencia', note),
      field('Categoría de referencia', category),
    ],
    'Revisar conciliación',
    async () => {
      const a = accounts.find((x) => x.id === Number(account.value));
      if (
        !(await confirmDialog(
          `Saldo calculado ${money(a.currentBalance)}. Saldo observado ${money(Number(actual.value))}. Ajuste ${money(Number(actual.value) - a.currentBalance)}. ¿Registrar?`,
          { confirmText: 'Registrar ajuste', danger: false },
        ))
      )
        return;
      await api.post(`/finance/reconciliations/${id}`, {
        accountId: a.id,
        expectedBalance: a.currentBalance,
        actualBalance: Number(actual.value),
        categoryId: Number(category.value),
        note: note.value,
      });
      toast('Conciliación registrada');
      await refreshed();
    },
  );
}
function scheduleForm(existing) {
  const creationKey = existing?.data.creationKey ?? uuid();
  const d = existing?.data,
    t = d?.transaction;
  const description = input('text', t?.description ?? '', { required: true, maxlength: 120 });
  const amount = input('number', t?.amount ?? '', { min: 0.01, step: '0.01', required: true });
  const type = select(
    [
      ['EXPENSE', 'Gasto'],
      ['INCOME', 'Ingreso'],
    ],
    t?.type ?? 'EXPENSE',
  );
  const category = categorySelect(t?.categoryId),
    account = accountSelect(t?.accountId);
  const start = input('date', d?.startDate ?? isoDate(Date.now()), {
    required: true,
    min: '2000-01-01',
    max: '2100-12-31',
  });
  const end = input('date', d?.endDate ?? '', { min: '2000-01-01', max: '2100-12-31' });
  const day = input('number', d?.dayOfMonth ?? 1, { min: 1, max: 31, required: true });
  return form(
    [
      field('Descripción', description),
      field('Monto mensual', amount),
      field('Tipo', type),
      field('Categoría', category),
      account,
      field('Desde', start),
      field('Hasta (opcional)', end),
      field('Día del mes', day, 'Si no existe ese día, se utiliza el último del mes.'),
    ],
    existing ? 'Actualizar recurrencia' : 'Crear recurrencia',
    async () => {
      await api[existing ? 'put' : 'post'](`/finance/schedules${existing ? `/${existing.id}` : ''}`, {
        transaction: {
          description: description.value,
          amount: Number(amount.value),
          type: type.value,
          categoryId: Number(category.value),
          accountId: Number(account.value),
          note: t?.note ?? '',
        },
        startDate: start.value,
        endDate: end.value || null,
        dayOfMonth: Number(day.value),
        active: d?.active ?? true,
        creationKey,
      });
      toast('Recurrencia guardada');
      await refreshed();
    },
  );
}
const scheduleDate = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const formatDue = (day) => scheduleDate.format(isoDateToMs(day));

function scheduleCard({ data, preview }, actions) {
  const tx = data.transaction;
  const account = store.account(tx.accountId)?.name ?? 'Sin cuenta';
  const dates = [];
  if (data.active && preview) {
    if (preview.pending)
      dates.push(
        `${preview.pending} ${preview.pending === 1 ? 'pendiente' : 'pendientes'} desde el ${formatDue(preview.firstPending)}`,
      );
    if (preview.nextDate) dates.push(`Próxima fecha: ${formatDue(preview.nextDate)}`);
    else dates.push('Sin fechas futuras');
  }
  return h('article', { class: 'recurring-card' }, [
    h('strong', {}, tx.description),
    h('span', { class: 'tnum' }, `${tx.type === 'INCOME' ? 'Ingreso' : 'Gasto'} de ${money(tx.amount)} · ${account}`),
    h(
      'small',
      { class: 'muted' },
      [data.active ? `Día ${data.dayOfMonth} de cada mes` : 'Pausada', ...dates].join(' · '),
    ),
    h('div', { class: 'recurring-actions' }, actions),
  ]);
}
function backupPanel() {
  const file = input('file', '', { accept: '.json,application/json' });
  const preview = h('div', { 'aria-live': 'polite' });
  let pending = null,
    digest = null,
    selection = 0;
  file.addEventListener('change', async () => {
    const current = ++selection;
    pending = null;
    digest = null;
    preview.replaceChildren();
    try {
      const selected = file.files[0];
      if (!selected) return;
      if (selected.size > 20 * 1024 * 1024) throw Error('El archivo supera 20 MB');
      const data = JSON.parse((await selected.text()).replace(/^\uFEFF/, ''));
      const result = await api.post('/finance/backup/preview', data);
      if (current !== selection) return;
      pending = data;
      digest = result.digest;
      preview.textContent = `Moneda ${result.currency}: ${result.accounts} cuentas, ${result.transactions} movimientos, ${result.budgets} presupuestos, ${result.operations} operaciones, ${result.schedules} recurrencias, ${result.goals ?? 0} metas y ${result.goalEntries ?? 0} aportes/retiros de ahorro. Se reemplazarán tus datos activos. El perfil y la contraseña se conservan; la moneda será la del respaldo.`;
    } catch (e) {
      toastError(e);
    }
  });
  const password = input('password', '', { autocomplete: 'current-password', required: true, maxlength: 128 });
  const restore = form(
    [
      field('Seleccionar respaldo FlowMoney (versiones 1, 2 o 3)', file),
      preview,
      field('Tu contraseña para confirmar', password),
    ],
    'Restaurar datos',
    async () => {
      if (!pending || !digest) throw Error('Selecciona y revisa un respaldo válido');
      if (
        !(await confirmDialog(
          'Se reemplazarán tus datos financieros. Descarga primero una copia actual. ¿Restaurar el archivo revisado?',
          { confirmText: 'Restaurar' },
        ))
      )
        return;
      await api.post('/finance/backup/restore', { backup: pending, digest, password: password.value });
      password.value = '';
      toast('Respaldo restaurado');
      await refreshed();
    },
  );
  return panel(
    'Respaldos y restauración',
    'La copia incluye transferencias, conciliaciones y ocurrencias ya procesadas.',
    h('div', { class: 'form' }, [
      button('Descargar respaldo completo', async () => {
        try {
          downloadText(
            `flowmoney-respaldo-${isoDate(Date.now())}.json`,
            JSON.stringify(await api.get('/finance/backup'), null, 2),
            'application/json',
          );
        } catch (e) {
          toastError(e);
        }
      }),
      restore,
    ]),
  );
}
const renders = new WeakMap();
export function render(root) {
  const token = Symbol();
  renders.set(root, token);
  const active = () => root.isConnected && location.hash === '#/operaciones' && renders.get(root) === token;
  mount(root, h('p', {}, 'Cargando operaciones…'));
  api
    .get('/finance')
    .then((data) => {
      if (!active()) return;
      const editor = h('div');
      const edit = (content) => {
        mount(editor, content);
        editor.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
      };
      mount(
        root,
        editor,
        panel(
          'Transferencias',
          'Mueven dinero sin aumentar ingresos ni gastos; las comisiones sí son gastos.',
          transferForm(),
        ),
        panel('Conciliar saldos', 'Saldo real y saldo proyectado', reconciliationForm(data.accounts)),
        panel(
          'Recurrencias mensuales',
          'Se registran al pulsar Procesar pendientes; cada mes se procesa una sola vez, incluso si borras después el movimiento.',
          h('div', { class: 'form' }, [
            button('Procesar pendientes', async (event) => {
              await runAction(event.currentTarget, async () => {
                const r = await api.post('/finance/schedules/run', {});
                toast(`${r.generated} movimientos registrados${r.more ? '; pulsa otra vez para continuar' : ''}`);
                await refreshed();
              });
            }),
            ...data.schedules.map((s) =>
              scheduleCard(s, [
                button('Editar', () => edit(scheduleForm(s))),
                button(s.data.active ? 'Pausar' : 'Reanudar', async () => {
                  await runAction(null, async () => {
                    await api.put(`/finance/schedules/${s.id}`, { ...s.data, active: !s.data.active });
                    await refreshed();
                  });
                }),
              ]),
            ),
            scheduleForm(),
          ]),
        ),
        panel(
          'Historial de operaciones',
          'Las conciliaciones se conservan; una corrección se registra con otra conciliación.',
          h(
            'div',
            {},
            data.operations.map((o) =>
              h('div', { class: 'form' }, [
                h(
                  'p',
                  {},
                  o.kind === 'TRANSFER'
                    ? `${o.data.description} · ${money(o.data.amount)} · ${isoDate(o.data.date)}`
                    : `Conciliación · ${isoDate(o.data.date)} · ${money(o.data.expectedBalance)} → ${money(o.data.actualBalance)} · ${o.data.note}`,
                ),
                ...(o.kind === 'TRANSFER'
                  ? [
                      button('Editar ambas partes', () => edit(transferForm(o))),
                      button('Eliminar transferencia', async () => {
                        if (await confirmDialog('¿Eliminar ambos movimientos y la comisión de esta transferencia?'))
                          await runAction(null, async () => {
                            await api.del(`/finance/transfers/${o.id}`);
                            await refreshed();
                          });
                      }),
                    ]
                  : []),
              ]),
            ),
          ),
        ),
        backupPanel(),
      );
    })
    .catch((e) => {
      if (active()) mount(root, h('p', {}, e.message));
    });
}
