// Selectores visuales (ícono y color) para categorías.
import { h } from './dom.js';

export const EMOJIS = [
  '🍽',
  '🚌',
  '🎬',
  '🩺',
  '📚',
  '💡',
  '🏠',
  '💼',
  '🛒',
  '☕',
  '✈️',
  '🎁',
  '💳',
  '📱',
  '👕',
  '🐶',
  '💧',
  '⚡',
  '🎓',
  '✨',
];
export const COLORS = [
  '#C25A44',
  '#3E78A8',
  '#7A5BA8',
  '#5B9E86',
  '#D9A648',
  '#C08A3E',
  '#A86A54',
  '#1F4D3A',
  '#6B8F7D',
  '#8A94A6',
  '#B0506B',
  '#4E86B0',
];

/**
 * Grupo de botones de opción única (role=radiogroup).
 * @param {{ label: string, options: string[], value: string, kind: 'emoji'|'color', onChange: (v: string) => void }} opts
 */
export function swatchPicker({ label, options, value, kind, onChange }) {
  const group = h('div', { class: `picker ${kind}`, role: 'radiogroup', 'aria-label': label });
  const select = (button, option) => {
    group.querySelectorAll('.swatch').forEach((b) => {
      b.classList.remove('sel');
      b.setAttribute('aria-checked', 'false');
    });
    button.classList.add('sel');
    button.setAttribute('aria-checked', 'true');
    onChange(option);
  };
  options.forEach((option) => {
    const selected = option === value;
    const button = h(
      'button',
      {
        type: 'button',
        role: 'radio',
        'aria-checked': String(selected),
        'aria-label': option,
        class: `swatch ${kind}${selected ? ' sel' : ''}`,
        style: kind === 'color' ? { background: option } : null,
      },
      kind === 'emoji' ? option : null,
    );
    button.addEventListener('click', () => select(button, option));
    group.append(button);
  });
  return group;
}
