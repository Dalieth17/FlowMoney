import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { getChartStyle, setChartStyle, CHART_STYLE_EVENT } from '../public/assets/js/core/chartStyle.js';
const { document, window } = parseHTML('<html><body><main></main></body></html>');
const saved = new Map();
Object.assign(globalThis, {
  document,
  window,
  Node: window.Node,
  CustomEvent: window.CustomEvent,
  localStorage: { getItem: (key) => saved.get(key), setItem: (key, value) => saved.set(key, value) },
});
test('preferencia 2D/3D se guarda, emite cambios y restaura al recargar la raíz', () => {
  assert.equal(getChartStyle(), '2d');
  const values = [];
  document.addEventListener(CHART_STYLE_EVENT, (e) => values.push(e.detail));
  setChartStyle('3d');
  assert.equal(getChartStyle(), '3d');
  assert.equal(saved.get('flowmoney.chartStyle'), '3d');
  setChartStyle('3d');
  setChartStyle('otro');
  assert.deepEqual(values, ['3d']);
  delete document.documentElement.dataset.chartStyle;
  assert.equal(getChartStyle(), '3d');
  setChartStyle('2d');
  assert.equal(saved.get('flowmoney.chartStyle'), '2d');
});
test('almacenamiento bloqueado o valor inválido no impide cambiar de diseño', () => {
  globalThis.localStorage = {
    getItem: () => {
      throw Error('Bloqueado');
    },
    setItem: () => {
      throw Error('Bloqueado');
    },
  };
  delete document.documentElement.dataset.chartStyle;
  assert.equal(getChartStyle(), '2d');
  setChartStyle('3d');
  assert.equal(getChartStyle(), '3d');
  setChartStyle('2d');
});
test('Configuración ofrece ambas opciones junto a Apariencia y cambia al seleccionar', async () => {
  const { api } = await import('../public/assets/js/core/api.js');
  const { store } = await import('../public/assets/js/core/store.js');
  api.get = async (path) =>
    path.startsWith('/bootstrap')
      ? {
          user: { name: 'Pruebas', email: 'test@example.test', currency: 'COP', createdAt: '2026-11-01' },
          categories: [],
          accounts: [],
          transactions: [],
          budgets: [],
        }
      : { items: [], nextCursor: null };
  await store.load();
  const { render } = await import('../public/assets/js/views/perfil.js');
  render(document.querySelector('main'));
  const controls = document.querySelectorAll('input[name=chartStyle]');
  assert.equal(controls.length, 2);
  const immersive = [...controls].find((el) => el.value === '3d');
  immersive.checked = true;
  immersive.dispatchEvent(new window.Event('change'));
  assert.equal(getChartStyle(), '3d');
  assert.ok(document.querySelector('main').textContent.includes('Apariencia'));
});
