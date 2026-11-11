// Formulario de categoría: nombre, ícono y color.
import { h, field } from '../ui/dom.js';
import { openModal, closeModal, toast, runAction } from '../ui/feedback.js';
import { swatchPicker, EMOJIS, COLORS } from '../ui/pickers.js';
import { store } from '../core/store.js';

export function openCategoryForm(existing) {
  const editing = Boolean(existing);
  let icon = existing?.icon ?? EMOJIS[0];
  let color = existing?.color ?? COLORS[0];

  const name = h('input', {
    class: 'input',
    type: 'text',
    maxlength: '40',
    required: true,
    placeholder: 'Ej. Mascotas',
    value: existing?.name ?? '',
  });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, editing ? 'Guardar' : 'Crear categoría');

  const form = h('form', { class: 'form', novalidate: true }, [
    field('Nombre', name),
    field(
      'Ícono',
      swatchPicker({
        label: 'Ícono',
        options: EMOJIS,
        value: icon,
        kind: 'emoji',
        onChange: (v) => {
          icon = v;
        },
      }),
    ),
    field(
      'Color',
      swatchPicker({
        label: 'Color',
        options: COLORS,
        value: color,
        kind: 'color',
        onChange: (v) => {
          color = v;
        },
      }),
    ),
    h('div', { class: 'modal-actions' }, [
      h('div', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: closeModal }, 'Cancelar'),
      submit,
    ]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!name.value.trim()) return toast('Ponle un nombre', 'warn');
    const payload = { name: name.value.trim(), icon, color };
    const ok = await runAction(submit, () =>
      editing ? store.updateCategory(existing.id, payload) : store.addCategory(payload),
    );
    if (ok) {
      closeModal();
      toast(editing ? 'Categoría actualizada' : 'Categoría creada');
    }
  });

  openModal(editing ? 'Editar categoría' : 'Nueva categoría', form);
}
