import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { barsChart, donutChart } from '../public/assets/js/ui/financialChart.js';
const { document, window } = parseHTML('<html><body><main></main></body></html>');
const frames = [];
Object.assign(globalThis, {
  document,
  window,
  Node: window.Node,
  CustomEvent: window.CustomEvent,
  requestAnimationFrame: (fn) => {
    frames.push(fn);
    return 1;
  },
});
const data = [{ label: 'Noviembre', income: 100, expense: 25 }];
test('2D conserva los SVG existentes sin crear contextos ni controles 3D', () => {
  document.documentElement.dataset.chartStyle = '2d';
  const chart = barsChart(data);
  assert.ok(chart.querySelector('svg'));
  assert.equal(chart.querySelector('canvas'), null);
  assert.equal(chart.dataset.renderStyle, '2d');
  assert.equal(frames.length, 0);
});
test('el modo 3D no fabrica columnas o categorías cuando no hay importes', () => {
  document.documentElement.dataset.chartStyle = '3d';
  assert.equal(barsChart([{ label: 'Vacío', income: 0, expense: 0 }]).querySelector('canvas'), null);
  assert.equal(donutChart([], { total: 0 }).querySelector('canvas'), null);
});
test('sin GPU se muestra 2D, se conservan importes y la preferencia sigue en 3D', async () => {
  document.documentElement.dataset.chartStyle = '3d';
  const chart = barsChart(data);
  document.querySelector('main').replaceChildren(chart);
  await frames.shift()();
  assert.equal(chart.dataset.renderStyle, '2d');
  assert.equal(chart.querySelector('.financial-chart-fallback').hidden, false);
  assert.ok(chart.querySelector('[role=status]').textContent.includes('2D'));
  assert.equal(document.documentElement.dataset.chartStyle, '3d');
  assert.ok(chart.querySelector('.financial-data').textContent.includes('100'));
});
