// Tema elegido por la persona: "Verde y negro" (por defecto) o "Blanco y negro".
// Se guarda en este navegador y se aplica con <html data-theme="…">.

// Íconos del selector (SVG propio, sin datos del usuario): luna verde = tema oscuro con acento verde;
// círculo mitad blanco y mitad negro = tema de alto contraste en blanco y negro.
const ICONS = {
  green:
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M20.4 14.6A8.5 8.5 0 0 1 9.4 3.6 8.5 8.5 0 1 0 20.4 14.6Z" fill="#2fdc8a"/></svg>',
  mono: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="#ffffff" stroke="currentColor" stroke-width="1.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="#0a0a0a"/></svg>',
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
