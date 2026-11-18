import { h, field, mount } from '../ui/dom.js';
import { panel } from '../ui/widgets.js';
import { confirmDialog, runAction, toast } from '../ui/feedback.js';
import { api } from '../core/api.js';
import { money, isoDate } from '../core/format.js';
import { uuid } from '../core/id.js';
import { goalProgress } from '../domain/goals.js';
const input = (type, value = '', attrs = {}) => h('input', { class: 'input', type, value, ...attrs });
const button = (label, onclick) => h('button', { type: 'button', class: 'btn btn-ghost sm', onclick }, label);
function form(fields, label, action) {
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, label);
  const el = h('form', { class: 'form' }, [...fields, submit]);
  el.addEventListener('submit', async (e) => {
    e.preventDefault();
    await runAction(submit, action);
  });
  return el;
}
function goalForm(existing, reload) {
  const id = existing?.id ?? uuid();
  const name = input('text', existing?.data.name ?? '', { required: true, maxlength: 80 });
  const target = input('number', existing?.data.target ?? '', {
    required: true,
    min: '0.01',
    max: '9999999999.99',
    step: '0.01',
  });
  const deadline = input('date', existing?.data.deadline ?? '', { min: '2000-01-01', max: '2100-12-31' });
  return form(
    [field('Nombre de la meta', name), field('Objetivo de ahorro', target), field('Fecha límite (opcional)', deadline)],
    existing ? 'Guardar meta' : 'Crear meta',
    async () => {
      await api[existing ? 'put' : 'post'](`/goals/${id}`, {
        name: name.value,
        target: Number(target.value),
        deadline: deadline.value || null,
        archived: existing?.data.archived ?? false,
      });
      toast('Meta guardada');
      await reload();
    },
  );
}
function entryForm(goal, reload) {
  const id = uuid();
  const amount = input('number', '', { min: '0.01', max: '9999999999.99', step: '0.01', required: true });
  const type = h('select', { class: 'input' }, [
    h('option', { value: 'ADD', selected: true }, 'Aporte'),
    h('option', { value: 'WITHDRAW' }, 'Retiro del ahorro'),
  ]);
  const date = input('date', isoDate(Date.now()), { min: '2000-01-01', max: isoDate(Date.now()), required: true });
  const note = input('text', '', { maxlength: 200 });
  return form(
    [field('Tipo de registro', type), field('Monto', amount), field('Fecha', date), field('Nota', note)],
    'Registrar aporte o retiro',
    async () => {
      await api.post(`/goals/${goal.id}/entries/${id}`, {
        amount: Number(amount.value),
        type: type.value,
        date: date.value,
        note: note.value,
      });
      toast('Registro de ahorro guardado');
      await reload();
    },
  );
}
const renders = new WeakMap();
export async function render(root) {
  const token = Symbol();
  renders.set(root, token);
  const active = () => renders.get(root) === token && root.isConnected && location.hash === '#/metas';
  mount(root, h('p', {}, 'Cargando metas…'));
  try {
    const { goals, goalEntries } = await api.get('/goals');
    if (!active()) return;
    const reload = () => render(root);
    const editor = h('div');
    const cards = goals.map((goal) => {
      const p = goalProgress(goal, goalEntries);
      const entries = goalEntries
        .filter((e) => e.goalId === goal.id)
        .sort((a, b) => b.data.date.localeCompare(a.data.date) || b.id.localeCompare(a.id));
      return panel(
        goal.data.name,
        goal.data.archived ? 'Archivada' : p.complete ? 'Meta alcanzada' : p.overdue ? 'Fecha vencida' : 'En progreso',
        h('div', { class: 'form' }, [
          h('p', {}, `${money(p.saved)} de ${money(goal.data.target)} · ${p.percent}%`),
          h('progress', { value: p.percent, max: 100, 'aria-label': `Progreso de ${goal.data.name}` }),
          h(
            'p',
            {},
            `Faltan ${money(p.remaining)}${goal.data.deadline ? ` · fecha límite ${goal.data.deadline}` : ''}`,
          ),
          p.daily !== null && !p.complete
            ? h('p', {}, `Aporte diario orientativo: ${money(p.daily)} (contando hoy).`)
            : null,
          button('Editar meta', () => mount(editor, goalForm(goal, reload))),
          button(goal.data.archived ? 'Reactivar' : 'Archivar', async () => {
            await runAction(null, async () => {
              await api.put(`/goals/${goal.id}`, { ...goal.data, archived: !goal.data.archived });
              await reload();
            });
          }),
          !goal.data.archived ? entryForm(goal, reload) : null,
          h('details', {}, [
            h('summary', {}, `Historial: ${entries.length} registros`),
            ...entries.map((e) =>
              h('div', {}, [
                h(
                  'p',
                  {},
                  `${e.data.date} · ${e.data.type === 'ADD' ? 'Aporte' : 'Retiro'} · ${money(e.data.amount)} · ${e.data.note}`,
                ),
                button('Eliminar registro', async () => {
                  if (await confirmDialog('¿Eliminar este registro de ahorro? Los saldos de tus cuentas no cambiarán.'))
                    await runAction(null, async () => {
                      await api.del(`/goals/${goal.id}/entries/${e.id}`);
                      await reload();
                    });
                }),
              ]),
            ),
          ]),
        ]),
      );
    });
    mount(
      root,
      h(
        'p',
        { class: 'note-banner' },
        'Las metas registran el ahorro que tú indicas. No reservan fondos, no mueven dinero ni modifican tus cuentas o reportes. Evita asignar el mismo dinero a varias metas.',
      ),
      editor,
      panel('Nueva meta', 'Define para qué quieres ahorrar', goalForm(null, reload)),
      ...(cards.length ? cards : [h('p', {}, 'Aún no tienes metas de ahorro.')]),
      h('a', { href: '#/operaciones' }, 'Descargar o restaurar un respaldo de tus metas'),
    );
  } catch (e) {
    if (active()) mount(root, h('p', {}, e.message));
  }
}
