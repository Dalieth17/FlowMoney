// Menú de selección única. El popover nativo gestiona el clic fuera y la capa superior.
import { h, withAlpha } from './dom.js';

const paths = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  type: '<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/>',
  categoryId:
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  accountId:
    '<path d="M20 8V5a1 1 0 0 0-1-1L5 7a2 2 0 0 0-2 2v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5"/><path d="M21 12h-5v4h5"/>',
};

export function filterIcon(key) {
  return h('span', {
    class: 'filter-symbol',
    'aria-hidden': 'true',
    html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[key]}</svg>`,
  });
}

function place(menu) {
  const box = menu.previousElementSibling.getBoundingClientRect();
  const width = Math.min(Math.max(box.width, 244), document.documentElement.clientWidth - 16);
  const below = window.innerHeight - box.bottom - 14;
  const above = box.top - 14;
  const upwards = below < Math.min(448, menu.childElementCount * 44 + 12) && above > below;
  Object.assign(menu.style, {
    width: `${width}px`,
    left: `${Math.max(8, Math.min(box.left, document.documentElement.clientWidth - width - 8))}px`,
    top: upwards ? 'auto' : `${box.bottom + 6}px`,
    bottom: upwards ? `${window.innerHeight - box.top + 6}px` : 'auto',
    maxHeight: `${Math.min(448, Math.max(0, upwards ? above : below))}px`,
  });
}
function positionOpenMenu(event) {
  const menu = document.querySelector('.filter-menu:popover-open');
  if (menu && event.target !== menu) place(menu);
}

export function movementFilter({ key, label, options, value, onChange }) {
  const id = `movement-filter-${key}`;
  const native = h('select', { class: 'input', 'aria-label': label });
  if (typeof native.showPopover !== 'function') {
    for (const item of options)
      native.append(h('option', { value: item.value, selected: item.value === value }, item.name));
    native.onchange = () => onChange(native.value);
    return {
      root: native,
      reset: () => {
        native.value = options[0].value;
        native.focus();
      },
    };
  }

  const caption = h('b', { class: 'filter-value' });
  const trigger = h(
    'button',
    {
      type: 'button',
      class: 'filter-trigger',
      popovertarget: id,
      'aria-haspopup': 'menu',
      'aria-controls': id,
      'aria-expanded': 'false',
    },
    [
      filterIcon(key),
      h('span', { class: 'filter-copy' }, [h('small', {}, label), caption]),
      h('i', { class: 'filter-chevron', 'aria-hidden': 'true' }),
    ],
  );
  const menu = h('div', { id, class: 'filter-menu', popover: 'auto', role: 'menu', 'aria-label': label });
  const root = h('div', { class: 'movement-filter' }, [trigger, menu]);
  let selected = options.findIndex((item) => item.value === value);
  if (selected < 0) selected = 0;

  function close() {
    menu.hidePopover();
    trigger.focus();
  }

  const rows = options.map((item, index) => {
    const badge = item.icon
      ? h(
          'span',
          {
            class: 'filter-symbol',
            'aria-hidden': 'true',
            style: item.color ? { backgroundColor: withAlpha(item.color, 0.16) } : null,
          },
          item.icon,
        )
      : filterIcon(key);
    return h(
      'button',
      {
        type: 'button',
        role: 'menuitemradio',
        tabindex: '-1',
        class: 'filter-option',
        onclick: () => {
          update(index);
          close();
          onChange(item.value);
        },
      },
      [badge, h('span', {}, item.name), h('i', { class: 'filter-tick', 'aria-hidden': 'true' })],
    );
  });
  menu.append(...rows);

  function update(index) {
    selected = index;
    caption.textContent = options[index].name;
    trigger.title = options[index].name;
    trigger.classList.toggle('is-filtered', index !== 0);
    rows.forEach((row, i) => row.setAttribute('aria-checked', String(i === index)));
  }
  update(selected);

  window.addEventListener('resize', positionOpenMenu);
  window.addEventListener('scroll', positionOpenMenu, true);
  menu.addEventListener('beforetoggle', (event) => {
    const open = event.newState === 'open';
    trigger.setAttribute('aria-expanded', String(open));
    menu.querySelector('[autofocus]')?.removeAttribute('autofocus');
    if (open) {
      rows[selected].autofocus = true;
      prefix = '';
      place(menu);
    }
  });
  trigger.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      if (!menu.matches(':popover-open')) trigger.click();
    }
  });
  let prefix = '',
    typedAt = 0;
  const fold = (name) => name.toLocaleLowerCase('es').normalize('NFD').replace(/\p{M}/gu, '');
  menu.addEventListener('keydown', (event) => {
    const index = rows.indexOf(document.activeElement);
    let next;
    switch (event.key) {
      case 'ArrowDown':
        next = (index + 1) % rows.length;
        break;
      case 'ArrowUp':
        next = (index - 1 + rows.length) % rows.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = rows.length - 1;
        break;
      case 'Escape':
        event.preventDefault();
        close();
        return;
      case 'Tab':
        close();
        return;
      default: {
        if (event.key.length !== 1 || !event.key.trim() || event.ctrlKey || event.metaKey || event.altKey) return;
        const now = performance.now();
        const letter = fold(event.key);
        prefix = now - typedAt < 650 && prefix !== letter ? prefix + letter : letter;
        typedAt = now;
        next = options.findIndex((_, offset) =>
          fold(options[(index + 1 + offset) % rows.length].name).startsWith(prefix),
        );
        if (next < 0) return;
        next = (index + 1 + next) % rows.length;
      }
    }
    event.preventDefault();
    rows[next].focus();
  });
  return {
    root,
    reset: () => {
      update(0);
      trigger.focus();
    },
  };
}
