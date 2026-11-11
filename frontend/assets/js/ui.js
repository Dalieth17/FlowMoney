// ui.js — primitivas de interfaz: factory de elementos, modal, toast, confirm.

/** Crea un elemento. h('div', {class:'x', onclick:fn}, [hijos|texto]) */
export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null || c === false) return;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  });
  return el;
}

export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); };

// ---- Modal ----
let activeModal = null;

export function openModal(title, contentNode, { wide = false } = {}) {
  closeModal();
  const close = () => closeModal();
  const card = h('div', { class: 'modal-card' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
    h('div', { class: 'modal-head' }, [
      h('h3', {}, title),
      h('button', { class: 'icon-btn', 'aria-label': 'Cerrar', onclick: close }, '✕'),
    ]),
    h('div', { class: 'modal-body' }, [contentNode]),
  ]);
  const overlay = h('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay) close(); } }, [card]);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  activeModal = { overlay, onKey };
  // foco al primer campo
  requestAnimationFrame(() => {
    const f = card.querySelector('input, select, textarea, button');
    if (f) f.focus();
  });
  return close;
}

export function closeModal() {
  if (!activeModal) return;
  document.removeEventListener('keydown', activeModal.onKey);
  activeModal.overlay.remove();
  document.body.style.overflow = '';
  activeModal = null;
}

// ---- Toast ----
export function toast(message, type = 'ok') {
  let host = document.querySelector('.toast-host');
  if (!host) { host = h('div', { class: 'toast-host' }); document.body.appendChild(host); }
  const t = h('div', { class: `toast ${type}` }, message);
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 2600);
}

// ---- Confirm ----
export function confirmDialog(message, { confirmText = 'Eliminar', danger = true } = {}) {
  return new Promise((resolve) => {
    const done = (v) => { closeModal(); resolve(v); };
    const body = h('div', {}, [
      h('p', { class: 'confirm-msg' }, message),
      h('div', { class: 'modal-actions' }, [
        h('button', { class: 'btn btn-ghost', onclick: () => done(false) }, 'Cancelar'),
        h('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), onclick: () => done(true) }, confirmText),
      ]),
    ]);
    openModal('¿Confirmas?', body);
  });
}

// ---- Pickers para categorías ----
export const EMOJIS = ['🍽', '🚌', '🎬', '🩺', '📚', '💡', '🏠', '💼', '🛒', '☕', '✈️', '🎁', '💳', '📱', '👕', '🐶', '💧', '⚡', '🎓', '✨'];
export const COLORS = ['#C25A44', '#3E78A8', '#7A5BA8', '#5B9E86', '#D9A648', '#C08A3E', '#A86A54', '#1F4D3A', '#6B8F7D', '#8A94A6', '#B0506B', '#4E86B0'];
