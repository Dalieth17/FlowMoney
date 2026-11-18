// Utilidades DOM. Todo el texto se inserta como textContent (nunca HTML), lo
// que evita XSS con datos del usuario. `html` se usa solo para SVG propio.

/** h('div', { class: 'x', onclick }, [hijos | texto]) */
export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function')
      el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'value' || key === 'checked' || key === 'selected' || key === 'disabled') el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export const clear = (node) => node.replaceChildren();

/** Reemplaza el contenido de `root`. Ignora null/false (append() los convertiría en texto "null"). */
export const mount = (root, ...nodes) => root.replaceChildren(...nodes.filter((n) => n != null && n !== false));

let fieldSeq = 0;
/** Campo de formulario con etiqueta asociada (accesible). */
export function field(label, control, hint) {
  const id = control.id || `f-${++fieldSeq}`;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(control.tagName)) control.id = id;
  return h('div', { class: 'field' }, [
    h('label', { class: 'field-label', for: control.id ? id : null }, label),
    control,
    hint ? h('span', { class: 'field-hint' }, hint) : null,
  ]);
}

/** "#C25A44" + 0.12 -> "rgba(194,90,68,0.12)" */
export function withAlpha(hex, alpha) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return `rgba(107,143,125,${alpha})`;
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Descarga un texto como archivo (BOM para que Excel lea bien las tildes). */
export function downloadText(filename, text, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: mime }));
  const link = h('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
