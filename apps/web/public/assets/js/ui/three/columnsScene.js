// Una columna por día con gastos registrados. Su altura es proporcional al importe diario.
import { mountScene, placeLabel } from './scene3d.js';
import { dayTick } from '../../domain/spendingChart.js';
import { money } from '../../core/format.js';

export function mountColumns(canvas, data) {
  return mountScene(canvas, (THREE, context) => buildColumns(THREE, context, data), { animated: false });
}

/** La construcción se puede comprobar con Three.js sin depender de una GPU. */
export function buildColumns(THREE, { scene, colors }, { days, top, ticks, labels }) {
  scene.add(new THREE.AmbientLight(0xffffff, colors.dark ? 1.2 : 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(-3, 6, 5);
  scene.add(sun);
  // Cámara fija y ortográfica: el ángulo no altera la comparación entre días.
  const camera = new THREE.OrthographicCamera(-6, 6, 3, -3, 0.1, 80);
  camera.position.set(0, 4.8, 12);
  camera.lookAt(0, 1.5, 0);
  const step = 0.2,
    height = 3.2;
  const x0 = (-(days.length - 1) * step) / 2;
  const line = new THREE.LineBasicMaterial({ color: colors.muted, transparent: true, opacity: 0.5 });
  let fill, scheduledFill, outline;
  const tags = [];
  labels.replaceChildren();
  const tag = (text, point, className = '') => {
    const el = document.createElement('span');
    el.className = `label3d ${className}`;
    el.textContent = text;
    labels.append(el);
    tags.push({ el, point });
  };
  for (const value of ticks) {
    const y = (value / top) * height;
    scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x0 - step / 2, y, -0.16),
          new THREE.Vector3(-x0 + step / 2, y, -0.16),
        ]),
        line,
      ),
    );
    tag(money(value), new THREE.Vector3(x0 - 0.18, y, 0), 'axis3d axis3d-y');
  }
  for (const day of days) {
    const x = x0 + (day.day - 1) * step;
    if (dayTick(day.day, days.length)) tag(String(day.day), new THREE.Vector3(x, -0.12, 0), 'axis3d axis3d-x');
    if (day.expense <= 0) continue; // cero significa ausencia de columna, sin altura artificial
    const size = (day.expense / top) * height;
    const geometry = new THREE.BoxGeometry(0.12, size, 0.16);
    if (!day.scheduled)
      fill ??= new THREE.MeshStandardMaterial({ color: colors.accent, roughness: 0.55, metalness: 0.05 });
    else
      scheduledFill ??= new THREE.MeshStandardMaterial({
        color: colors.muted,
        roughness: 0.8,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
      });
    const bar = new THREE.Mesh(geometry, day.scheduled ? scheduledFill : fill);
    bar.position.set(x, size / 2, 0);
    bar.userData = { day: day.day, amount: day.expense, scheduled: day.scheduled };
    scene.add(bar);
    if (day.scheduled) {
      outline ??= new THREE.LineDashedMaterial({ color: colors.muted, dashSize: 0.045, gapSize: 0.035 });
      const rim = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), outline);
      rim.position.copy(bar.position);
      rim.computeLineDistances();
      scene.add(rim);
    }
  }
  return {
    camera,
    update(_t, { size }) {
      const aspect = size.w / size.h;
      camera.left = (-days.length * step) / 2 - 1.7;
      camera.right = (days.length * step) / 2 + 0.3;
      const halfHeight = Math.max((camera.right - camera.left) / aspect / 2, 2.15);
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      for (const { el, point } of tags) placeLabel(el, point, camera, size);
    },
  };
}
