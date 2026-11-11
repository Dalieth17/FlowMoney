// Router por hash (#/movimientos): refrescar mantiene la vista y el botón
// "atrás" del navegador funciona. También guarda el mes que se está viendo.

const routes = new Map();
const now = new Date();
const nav = { route: null, month: now.getMonth(), year: now.getFullYear() };
let els = null;
let defaultRoute = null;

/** routes: [{ id, title, render(root, period), monthScoped }] */
export function defineRoutes(list, { fallback }) {
  list.forEach((r) => routes.set(r.id, r));
  defaultRoute = fallback;
}

export function mountRouter(elements) {
  els = elements;
  window.addEventListener('hashchange', syncWithHash);
  syncWithHash();
}

export const getPeriod = () => ({ month: nav.month, year: nav.year });

export function go(id) {
  const target = `#/${id}`;
  if (location.hash === target) render();
  else location.hash = target;
}

export function shiftMonth(delta) {
  const d = new Date(nav.year, nav.month + delta, 1);
  nav.month = d.getMonth();
  nav.year = d.getFullYear();
  render();
}

export function render() {
  const route = routes.get(nav.route);
  if (!route || !els) return;
  els.title.textContent = route.title;
  document.title = `${route.title} · FlowMoney`;
  els.monthNav.hidden = !route.monthScoped;
  els.monthLabel.textContent = els.formatPeriod(getPeriod());
  route.render(els.root, getPeriod());
}

function syncWithHash() {
  const id = location.hash.replace(/^#\/?/, '');
  nav.route = routes.has(id) ? id : defaultRoute;
  document.querySelectorAll('[data-route]').forEach((link) => {
    const active = link.dataset.route === nav.route;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  render();
  els.root.scrollTo?.(0, 0);
}
