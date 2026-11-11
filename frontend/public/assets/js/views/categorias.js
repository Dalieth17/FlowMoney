// Vista Categorías: predeterminadas + propias (crear, editar, eliminar).
import { h, mount } from '../ui/dom.js';
import { toast, confirmDialog, runAction } from '../ui/feedback.js';
import { store } from '../core/store.js';
import { openCategoryForm } from '../forms/categoryForm.js';

export function render(root) {
  const counts = new Map();
  store.transactions.forEach((t) => counts.set(t.categoryId, (counts.get(t.categoryId) || 0) + 1));
  const plural = (n) => `${n} movimiento${n === 1 ? '' : 's'}`;

  const remove = async (category) => {
    if (!(await confirmDialog(`¿Eliminar la categoría "${category.name}"?`))) return;
    if (await runAction(null, () => store.deleteCategory(category.id))) toast('Categoría eliminada');
  };

  mount(
    root,
    h('div', { class: 'toolbar' }, [
      h('p', { class: 'muted' }, `${store.categories.length} categorías. Usa las predeterminadas o crea las tuyas.`),
      h('button', { class: 'btn btn-primary sm', onclick: () => openCategoryForm() }, '+ Nueva categoría'),
    ]),
    h(
      'div',
      { class: 'cat-grid' },
      store.categories.map((c) =>
        h('div', { class: 'cat-card' }, [
          h('div', { class: 'cat-ic', style: { background: c.color }, 'aria-hidden': 'true' }, c.icon),
          h('div', { class: 'cat-info' }, [
            h('div', { class: 'cat-nm' }, c.name),
            h(
              'div',
              { class: 'cat-meta' },
              `${c.isDefault ? 'Predeterminada · ' : ''}${plural(counts.get(c.id) || 0)}`,
            ),
          ]),
          h('div', { class: 'cat-actions' }, [
            h(
              'button',
              {
                class: 'icon-btn sm',
                'aria-label': `Editar ${c.name}`,
                title: 'Editar',
                onclick: () => openCategoryForm(c),
              },
              '✎',
            ),
            c.isDefault
              ? null
              : h(
                  'button',
                  {
                    class: 'icon-btn sm',
                    'aria-label': `Eliminar ${c.name}`,
                    title: 'Eliminar',
                    onclick: () => remove(c),
                  },
                  '🗑',
                ),
          ]),
        ]),
      ),
    ),
  );
}
