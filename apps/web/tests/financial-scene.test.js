import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import * as THREE from '../public/assets/vendor/three/three.module.min.js';
const { document, window } = parseHTML('<html><body><canvas></canvas><div id="labels"></div></body></html>');
Object.assign(globalThis, { document, window });
const { buildFinancialChart } = await import('../public/assets/js/ui/three/financialScene.js');
const colors = { accent: 0x22cc88, expense: 0xcc3322, line: 0x222222, muted: 0x888888 };
const labels = document.querySelector('#labels'),
  canvas = document.querySelector('canvas');
const meshes = (scene) => {
  const result = [];
  scene.traverse((mesh) => {
    if (mesh.userData.kind) result.push(mesh);
  });
  return result;
};
test('anillo extruido: los sectores representan los importes exactos, suman 360° y omiten ceros', () => {
  const scene = new THREE.Scene();
  const built = buildFinancialChart(
    THREE,
    { scene, colors },
    {
      kind: 'donut',
      data: [
        { label: 'A', value: 25, color: '#22cc88' },
        { label: 'B', value: 75, color: '#cc3322' },
        { label: 'Cero', value: 0 },
      ],
      labels,
      canvas,
    },
  );
  const sectors = meshes(scene);
  assert.equal(sectors.length, 2);
  assert.deepEqual(
    sectors.map((s) => s.userData.amount),
    [25, 75],
  );
  const angle = (s) => s.userData.end - s.userData.start;
  assert.ok(Math.abs(angle(sectors[1]) / angle(sectors[0]) - 3) < 1e-12);
  assert.equal(sectors.at(-1).userData.end, Math.PI * 2);
  assert.equal(sectors[0].geometry.parameters.options.depth, 0.42);
  built.dispose();
});
test('columnas 3D proporcionales sin geometría para ceros y etiquetas finitas', () => {
  const scene = new THREE.Scene();
  const built = buildFinancialChart(
    THREE,
    { scene, colors },
    {
      kind: 'bars',
      data: [
        { label: 'A', income: 0, expense: 10 },
        { label: 'B', income: 20, expense: 40 },
        { label: 'C', income: 0, expense: 0 },
      ],
      labels,
      canvas,
    },
  );
  const bars = meshes(scene);
  assert.equal(bars.length, 3);
  assert.deepEqual(
    bars.map((b) => b.userData.amount),
    [10, 20, 40],
  );
  assert.equal(bars[2].geometry.parameters.height / bars[0].geometry.parameters.height, 4);
  assert.ok(built.camera.isOrthographicCamera);
  built.update(0, { size: { w: 560, h: 280 } });
  assert.equal((built.camera.right - built.camera.left) / (built.camera.top - built.camera.bottom), 2);
  for (const label of labels.children) {
    assert.ok(Number.isFinite(parseFloat(label.style.left)));
    assert.ok(Number.isFinite(parseFloat(label.style.top)));
  }
  built.dispose();
});
test('rotación manual redibuja la escena estática y libera sus manejadores al salir', () => {
  const scene = new THREE.Scene();
  let invalidations = 0;
  const built = buildFinancialChart(
    THREE,
    { scene, colors, invalidate: () => invalidations++ },
    { kind: 'donut', data: [{ label: 'A', value: 10, color: '#22cc88' }], labels, canvas },
  );
  const group = scene.children.find((child) => child.isGroup);
  canvas.dispatchEvent(new window.CustomEvent('flowmoney:chart-view', { detail: 0.5 }));
  built.update(0, { size: { w: 300, h: 280 } });
  assert.equal(group.rotation.y, 0.5);
  assert.equal(invalidations, 1);
  canvas.dispatchEvent(new window.CustomEvent('flowmoney:chart-view', { detail: 'reset' }));
  built.update(100, { size: { w: 300, h: 280 } });
  assert.equal(group.rotation.y, 0);
  built.dispose();
  canvas.dispatchEvent(new window.CustomEvent('flowmoney:chart-view', { detail: 0.5 }));
  assert.equal(invalidations, 2);
});
