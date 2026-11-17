// Tema elegido por la persona: "Verde y negro" (por defecto) o "Blanco y negro".
// Se guarda en este navegador y se aplica con <html data-theme="…">.

export const THEMES = Object.freeze([
  { id: 'green', label: 'Verde y negro', short: 'Verde', compact: 'Verde', swatch: '#2fdc8a' },
  {
    id: 'mono',
    label: 'Blanco y negro',
    short: 'Blanco y negro',
    compact: 'B/N',
    swatch: 'linear-gradient(90deg, #ffffff 50%, #0a0a0a 50%)',
  },
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
    const compact = host.dataset.themeSwitch === 'compact';
    host.replaceChildren(
      ...THEMES.map((t) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.theme = t.id;
        b.title = t.label;
        const sw = document.createElement('span');
        sw.className = 'sw';
        sw.style.background = t.swatch;
        b.append(sw, compact ? t.compact : t.short);
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
