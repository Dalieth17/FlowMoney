// Modal, avisos (toast) y confirmación. Accesible: el foco entra al modal,
// Tab no se escapa, Escape cierra y el foco vuelve a donde estaba.

import { h } from './dom.js';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
let active = null;

export function openModal(title, content) {
  closeModal();
  const previousFocus = document.activeElement;
  const titleId = `modal-title-${Date.now()}`;

  const card = h('div', { class: 'modal-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId }, [
    h('div', { class: 'modal-head' }, [
      h('h3', { id: titleId }, title),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Cerrar', onclick: closeModal }, '✕'),
    ]),
    h('div', { class: 'modal-body' }, content),
  ]);
  const overlay = h('div', { class: 'modal-overlay' }, card);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) closeModal();
  });

  const onKey = (e) => {
    if (e.key === 'Escape') return closeModal();
    if (e.key !== 'Tab') return;
    const items = [...card.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled);
    if (!items.length) return;
    const [first, last] = [items[0], items[items.length - 1]];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  document.body.append(overlay);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKey);
  active = { overlay, onKey, previousFocus };

  requestAnimationFrame(() => card.querySelector('.modal-body ' + FOCUSABLE)?.focus());
}

export function closeModal() {
  if (!active) return;
  const { overlay, onKey, previousFocus } = active;
  active = null;
  document.removeEventListener('keydown', onKey);
  overlay.remove();
  document.body.style.overflow = '';
  previousFocus?.focus?.();
}

export function toast(message, type = 'ok') {
  let host = document.querySelector('.toast-host');
  if (!host) {
    host = h('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
    document.body.append(host);
  }
  const el = h('div', { class: `toast ${type}` }, message);
  host.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, 2800);
}

/** Muestra el mensaje de un error de la API como aviso. */
export const toastError = (err) => toast(err?.message || 'Algo salió mal', 'warn');

export function confirmDialog(message, { confirmText = 'Eliminar', danger = true } = {}) {
  return new Promise((resolve) => {
    const done = (value) => {
      closeModal();
      resolve(value);
    };
    openModal('¿Confirmas?', [
      h('p', { class: 'confirm-msg' }, message),
      h('div', { class: 'modal-actions' }, [
        h('div', { class: 'spacer' }),
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => done(false) }, 'Cancelar'),
        h(
          'button',
          { type: 'button', class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, onclick: () => done(true) },
          confirmText,
        ),
      ]),
    ]);
  });
}

/**
 * Ejecuta una acción async desde un botón: lo deshabilita mientras corre,
 * muestra el error si falla y devuelve true si salió bien.
 */
export async function runAction(button, action) {
  if (button) button.disabled = true;
  try {
    await action();
    return true;
  } catch (err) {
    toastError(err);
    return false;
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}
