import { mountScene, placeLabel, webglAvailable } from './scene3d.js';
import { money } from '../../core/format.js';

export async function mountFinancialChart(canvas, data) {
  if (!webglAvailable()) throw Error('WebGL no disponible');
  return mountScene(canvas, (THREE, context) => buildFinancialChart(THREE, context, { ...data, canvas }), {
    animated: false,
  });
}

/** Geometría real: ángulos según importe y columnas proporcionales, sin altura para ceros. */
export function buildFinancialChart(THREE, { scene, colors, invalidate = () => {} }, { kind, data, labels, canvas }) {
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.position.set(-3, 7, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 1);
  fill.position.set(5, 3, -3);
  scene.add(fill);
  const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 80);
  const group = new THREE.Group();
  scene.add(group);
  const tags = [];
  const tag = (text, point, { axis = false, title = text } = {}) => {
    const el = document.createElement('span');
    el.className = `financial-label${axis ? ' axis' : ''}`;
    el.textContent = text;
    el.title = title;
    labels.append(el);
    tags.push({ el, point });
  };
  labels.replaceChildren();
  let viewWidth = 6,
    centerY = 0,
    initialYaw = 0;
  const material = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.16 });
  if (kind === 'donut') {
    const positive = data.filter((d) => Number.isFinite(d.value) && d.value > 0);
    const total = positive.reduce((n, d) => n + Math.round(d.value * 100), 0);
    let start = 0;
    for (const [i, item] of positive.entries()) {
      const end =
        i === positive.length - 1 ? Math.PI * 2 : start + (Math.round(item.value * 100) / total) * Math.PI * 2;
      const shape = new THREE.Shape(),
        inner = 1.02,
        outer = 1.83;
      shape.moveTo(outer * Math.cos(start), outer * Math.sin(start));
      shape.absarc(0, 0, outer, start, end, false);
      shape.lineTo(inner * Math.cos(end), inner * Math.sin(end));
      shape.absarc(0, 0, inner, end, start, true);
      shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 0.42,
        bevelEnabled: true,
        bevelSegments: 2,
        bevelSize: 0.025,
        bevelThickness: 0.025,
        curveSegments: 72,
      });
      const color = /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : colors.accent;
      const sector = new THREE.Mesh(geometry, material(color));
      sector.rotation.x = -Math.PI / 2;
      sector.position.y = 0.1;
      sector.userData = { kind: 'sector', label: item.label, amount: item.value, start, end };
      group.add(sector);
      start = end;
    }
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.03, 2.08, 0.13, 96), material(colors.line));
    base.position.y = -0.07;
    group.add(base);
    camera.position.set(0, 4.8, 6.4);
    camera.lookAt(0, 0.15, 0);
    viewWidth = 4.9;
  } else {
    const top = niceTop(Math.max(1, ...data.map((d) => Math.max(d.income, d.expense))));
    const step = Math.max(1, Math.min(2, 6 / Math.max(1, data.length))),
      span = Math.max(2, data.length * step),
      x0 = (-(data.length - 1) * step) / 2;
    const height = 2.7;
    centerY = 1.15;
    initialYaw = -0.16;
    viewWidth = span + 2.1;
    const gridMaterial = new THREE.LineBasicMaterial({ color: colors.muted, transparent: true, opacity: 0.28 });
    for (let i = 0; i <= 4; i++) {
      const value = (top * i) / 4,
        y = (height * i) / 4;
      group.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-span / 2, y, -0.35),
            new THREE.Vector3(span / 2, y, -0.35),
          ]),
          gridMaterial,
        ),
      );
      tag(money(value), new THREE.Vector3(-span / 2 - 0.16, y, -0.35), { axis: true });
    }
    const fills = {};
    data.forEach((item, index) => {
      const x = x0 + index * step;
      tag(item.label.length > 15 ? `${item.label.slice(0, 14)}…` : item.label, new THREE.Vector3(x, -0.22, 0.2), {
        title: item.label,
      });
      for (const [type, amount, offset, color] of [
        ['income', item.income, -0.18, colors.accent],
        ['expense', item.expense, 0.18, colors.expense],
      ]) {
        if (!(amount > 0)) continue;
        fills[type] ??= material(color);
        const size = (amount / top) * height;
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.26, size, 0.38), fills[type]);
        bar.position.set(x + offset, size / 2, 0);
        bar.userData = { kind: 'bar', type, label: item.label, amount, top };
        group.add(bar);
      }
    });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(span + 0.3, 0.045, 0.85), material(colors.line));
    floor.position.y = -0.05;
    group.add(floor);
    camera.position.set(0, 4.3, 10);
    camera.lookAt(0, centerY, 0);
  }
  let yaw = initialYaw,
    drag = null;
  const rotate = (delta) => {
    yaw = kind === 'donut' ? (yaw + delta) % (Math.PI * 2) : Math.max(-0.6, Math.min(0.6, yaw + delta));
    invalidate();
  };
  const down = (event) => {
    if (event.button !== 0) return;
    drag = { x: event.clientX, id: event.pointerId };
    canvas.setPointerCapture?.(event.pointerId);
  };
  const move = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    drag.x = event.clientX;
    rotate(dx * 0.008);
  };
  const up = () => {
    drag = null;
  };
  const view = (event) => {
    if (event.detail === 'reset') {
      yaw = initialYaw;
      invalidate();
    } else if (Number.isFinite(event.detail)) rotate(event.detail);
  };
  const listeners = [
    ['pointerdown', down],
    ['pointermove', move],
    ['pointerup', up],
    ['pointercancel', up],
    ['flowmoney:chart-view', view],
  ];
  for (const [event, handler] of listeners) canvas?.addEventListener(event, handler);
  return {
    camera,
    update(_time, { size }) {
      const halfHeight = Math.max(viewWidth / (size.w / size.h) / 2, kind === 'donut' ? 1.6 : 2.05);
      const halfWidth = (halfHeight * size.w) / size.h;
      camera.left = -halfWidth;
      camera.right = halfWidth;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      group.rotation.y = yaw;
      group.updateMatrixWorld(true);
      for (const { el, point } of tags) {
        placeLabel(el, group.localToWorld(point.clone()), camera, size);
        if (el.classList.contains('axis'))
          el.style.left = `${Math.max((el.offsetWidth || 0) + 6, parseFloat(el.style.left))}px`;
      }
    },
    dispose() {
      for (const [event, handler] of listeners) canvas?.removeEventListener(event, handler);
    },
  };
}
function niceTop(max) {
  const power = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / power / 0.5) * power * 0.5;
}
