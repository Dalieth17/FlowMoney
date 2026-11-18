// Tema elegido por la persona: "Verde y negro" (por defecto) o "Blanco y negro".
// Se guarda en este navegador y se aplica con <html data-theme="…">.

// Íconos del selector (SVG propio, sin datos del usuario): hoja para Verde y negro;
// círculo dividido para Blanco y negro. Ambos heredan el color del botón.
const ICONS = {
  green:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 4c-7-1-13 2-13 8a5 5 0 0 0 5 5c6 0 9-6 8-13Z"/><path d="m4 20 11-11"/></svg>',
  mono: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor"/></svg>',
};

export const THEMES = Object.freeze([
  { id: 'green', label: 'Verde y negro', icon: ICONS.green },
  { id: 'mono', label: 'Blanco y negro', icon: ICONS.mono },
]);
export const DEFAULT_THEME = 'green';
const KEY = 'flowmoney.theme';
export const THEME_EVENT = 'flowmoney:theme';

export const isTheme = (id) => THEMES.some((t) => t.id === id);

export function getTheme() {
  const current = document.documentElement.dataset.theme;
  return isTheme(current) ? current : DEFAULT_THEME;
}

export function setTheme(id) {
  if (!isTheme(id) || id === getTheme()) return;
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* sin almacenamiento: el cambio dura hasta recargar */
  }
  document.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: id }));
}

/** Lee un color del tema actual (lo usan las escenas 3D). */
export const themeColor = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Convierte cada [data-theme-switch] en un selector de dos botones que se mantiene sincronizado. */
export function mountThemeSwitches(root = document) {
  root.querySelectorAll('[data-theme-switch]').forEach((host) => {
    host.classList.add('theme-switch');
    host.setAttribute('role', 'group');
    host.setAttribute('aria-label', 'Tema de colores');
    host.replaceChildren(
      ...THEMES.map((t) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.theme = t.id;
        // Solo ícono: el nombre del tema lo dan aria-label (lectores de pantalla) y title (al pasar el mouse).
        b.title = `Tema ${t.label}`;
        b.setAttribute('aria-label', `Tema ${t.label}`);
        b.innerHTML = t.icon;
        b.addEventListener('click', () => setTheme(t.id));
        return b;
      }),
    );
  });
  syncSwitches();
}

function syncSwitches() {
  const current = getTheme();
  document.querySelectorAll('[data-theme-switch] button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.theme === current));
  });
}
document.addEventListener(THEME_EVENT, syncSwitches);
