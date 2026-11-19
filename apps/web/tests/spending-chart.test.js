import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { spendingChart } from '../public/assets/js/domain/spendingChart.js';
import { dailyBars } from '../public/assets/js/ui/charts.js';
import { setCurrency } from '../public/assets/js/core/format.js';
import * as THREE from '../public/assets/vendor/three/three.module.min.js';

const at = (day, month = 10, year = 2026) => Date.UTC(year, month, day, 17);
const today = new Date(2026, 10, 19, 12);
const tx = (id, amount, day, extra = {}) => ({
  id,
  amount,
  type: 'EXPENSE',
  kind: 'NORMAL',
  date: at(day),
  categoryId: 1,
  accountId: 1,
  description: 'Prueba',
  note: '',
  ...extra,
});
const model = (list) => spendingChart(list, 10, 2026, today);

test('las barras suman los gastos del día, no ingresos, transferencias ni ajustes; la comisión sí cuenta', () => {
  const data = model([
    tx(1, 100, 5),
    tx(2, 50, 5),
    tx(3, 400, 6, { type: 'INCOME' }),
    tx(4, 900, 7, { kind: 'TRANSFER' }),
    tx(5, 900, 7, { kind: 'TRANSFER', type: 'INCOME' }),
    tx(6, 20, 8, { kind: 'ADJUSTMENT' }),
    tx(7, 2, 7, { operationId: 'transferencia' }),
    tx(8, 999, 1, { date: at(1, 9) }),
  ]);
  assert.equal(data.days[4].expense, 150);
  assert.equal(data.days[5].expense, 0);
  assert.equal(data.days[6].expense, 2);
  assert.equal(data.total, 152);
  assert.equal(data.spent, 152);
  assert.equal(data.scheduled, 0);
});

test('futuros muestran únicamente gastos programados explícitos, no una proyección', () => {
  const data = model([tx(1, 10, 19), tx(2, 25, 25)]);
  assert.equal(data.spent, 10);
  assert.equal(data.scheduled, 25);
  assert.equal(data.total, 35);
  assert.equal(data.days[18].scheduled, false);
  assert.equal(data.days[24].scheduled, true);
  assert.equal(data.days[25].expense, 0);
  assert.equal(data.days[29].cumulative, 35);
});

test('mes pasado, futuro, año bisiesto y día civil de Colombia', () => {
  assert.equal(spendingChart([tx(1, 10, 1)], 10, 2026, new Date(2026, 11, 1)).scheduled, 0);
  assert.equal(spendingChart([tx(1, 10, 1)], 10, 2026, new Date(2026, 9, 1)).spent, 0);
  assert.equal(spendingChart([], 1, 2024, today).days.length, 29);
  assert.equal(spendingChart([], 1, 2025, today).days.length, 28);
  const midnight = model([tx(1, 9, 1, { date: Date.UTC(2026, 10, 2, 1) })]);
  assert.equal(midnight.days[0].expense, 9, '01:00 UTC aún es el día anterior en Colombia');
});

test('editar, borrar o cambiar de mes recalcula todos los importes sin mutar el historial', () => {
  const list = [tx(1, 100, 5), tx(2, 200, 8)];
  const saved = structuredClone(list);
  assert.equal(model(list).total, 300);
  const edited = list.map((t) => (t.id === 1 ? { ...t, amount: 25, date: at(7) } : t));
  assert.equal(model(edited).days[4].expense, 0);
  assert.equal(model(edited).days[6].expense, 25);
  assert.equal(model(edited.filter((t) => t.id !== 2)).total, 25);
  assert.equal(spendingChart(list, 9, 2026, today).total, 0);
  assert.deepEqual(list, saved);
});

test('centavos y escala visible proporcionales en ambas monedas', () => {
  for (const currency of ['COP', 'USD']) {
    setCurrency(currency);
    const data = model([tx(1, 0.1, 2), tx(2, 0.2, 2), tx(3, 0.15, 3)]);
    assert.equal(data.total, 0.45);
    assert.equal(data.days[1].expense, 0.3);
    assert.ok(data.top >= 0.3 && data.top < 1);
    assert.equal(data.ticks[0], 0);
    assert.equal(data.ticks.at(-1), data.top);
    assert.ok(dailyBars(data).includes(currency === 'USD' ? 'US$ 0.45' : '$ 0,45'));
  }
  setCurrency('COP');
});

test('SVG: columnas solo en días con gastos, importes exactos y proporciones correctas', () => {
  const data = model([tx(1, 10, 5), tx(2, 20, 25)]);
  const { document } = parseHTML(dailyBars(data));
  const bars = [...document.querySelectorAll('rect[data-day]')];
  assert.deepEqual(
    bars.map((r) => [r.dataset.day, r.dataset.amount]),
    [
      ['5', '10'],
      ['25', '20'],
    ],
  );
  assert.equal(Number(bars[1].getAttribute('height')) / Number(bars[0].getAttribute('height')), 2);
  assert.equal(bars[1].getAttribute('class'), 'bar-scheduled');
  assert.equal(parseHTML(dailyBars(model([]))).document.querySelectorAll('rect').length, 0);
});

test('escena 3D real: altura proporcional, ceros sin geometría y estado programado', async () => {
  const { document, window } = parseHTML('<html><body><div id="labels"></div></body></html>');
  Object.assign(globalThis, { document, window });
  const { buildColumns } = await import('../public/assets/js/ui/three/columnsScene.js');
  const data = model([tx(1, 10, 5), tx(2, 20, 25)]);
  const scene = new THREE.Scene();
  const config = buildColumns(
    THREE,
    { scene, colors: { dark: true, muted: 0x888888, accent: 0x22cc88 } },
    { ...data, labels: document.querySelector('#labels') },
  );
  const bars = scene.children.filter((o) => o.isMesh);
  assert.deepEqual(
    bars.map((o) => o.userData),
    [
      { day: 5, amount: 10, scheduled: false },
      { day: 25, amount: 20, scheduled: true },
    ],
  );
  assert.equal(bars[1].geometry.parameters.height / bars[0].geometry.parameters.height, 2);
  assert.equal(bars[0].position.y, bars[0].geometry.parameters.height / 2);
  assert.equal(bars[1].material.transparent, true);
  config.update(0, { size: { w: 640, h: 300 } });
  for (const label of document.querySelectorAll('.label3d')) {
    assert.ok(Number.isFinite(Number.parseFloat(label.style.left)));
    assert.ok(Number.isFinite(Number.parseFloat(label.style.top)));
  }
  assert.ok(config.camera.isOrthographicCamera);
});
