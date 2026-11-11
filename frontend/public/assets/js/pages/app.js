// Punto de entrada del panel (app.html): carga los datos, registra las vistas y arranca el router.
import { h, clear } from '../ui/dom.js';
import { store } from '../core/store.js';
import { defineRoutes, mountRouter, render, shiftMonth } from '../core/router.js';
import { monthLabel } from '../core/format.js';
import { openMovementForm } from '../forms/movementForm.js';
import * as resumen from '../views/resumen.js';
import * as movimientos from '../views/movimientos.js';
import * as cuentas from '../views/cuentas.js';
import * as categorias from '../views/categorias.js';
import * as presupuestos from '../views/presupuestos.js';
import * as reportes from '../views/reportes.js';
import * as perfil from '../views/perfil.js';

// monthScoped: la vista depende del mes elegido (muestra el selector de mes).
const ROUTES = [
  { id: 'resumen', title: 'Resumen', monthScoped: true, render: resumen.render },
  { id: 'movimientos', title: 'Movimientos', monthScoped: true, render: movimientos.render },
  { id: 'cuentas', title: 'Cuentas', monthScoped: false, render: cuentas.render },
  { id: 'categorias', title: 'Categorías', monthScoped: false, render: categorias.render },
  { id: 'presupuestos', title: 'Presupuestos', monthScoped: true, render: presupuestos.render },
  { id: 'reportes', title: 'Reportes', monthScoped: true, render: reportes.render },
  { id: 'perfil', title: 'Perfil', monthScoped: false, render: perfil.render },
];

const $ = (id) => document.getElementById(id);

function renderUserCard() {
  const { name = '', email = '' } = store.user ?? {};
  $('user-name').textContent = name;
  $('user-email').textContent = email;
  $('user-initial').textContent = name.trim().charAt(0).toUpperCase() || '·';
}

function renderLoadError(err) {
  const view = $('view');
  clear(view);
  view.append(
    h('div', { class: 'empty' }, [
      h('p', { class: 'empty-t' }, 'No pudimos cargar tus datos'),
      h('p', { class: 'empty-s' }, err.message),
      h('button', { class: 'btn btn-primary sm', onclick: () => location.reload() }, 'Reintentar'),
    ]),
  );
}

async function init() {
  $('new-mv').addEventListener('click', () => openMovementForm());
  $('prev-month').addEventListener('click', () => shiftMonth(-1));
  $('next-month').addEventListener('click', () => shiftMonth(1));
  $('logout').addEventListener('click', () => store.logout());

  try {
    await store.load();
  } catch (err) {
    // 401 ya redirigió al login; cualquier otro error se muestra con opción de reintentar.
    if (err.status !== 401) renderLoadError(err);
    return;
  }

  renderUserCard();
  defineRoutes(ROUTES, { fallback: 'resumen' });
  mountRouter({
    root: $('view'),
    title: $('view-title'),
    monthNav: $('month-nav'),
    monthLabel: $('month-label'),
    formatPeriod: ({ month, year }) => monthLabel(month, year),
  });
  store.subscribe(() => {
    renderUserCard();
    render();
  });
}

init();
