// Gasto acumulado del mes en 3D: una columna por día bajo el "techo" de los presupuestos.
import { mountScene, placeLabel } from './scene3d.js';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ days: {day:number, cumulative:number}[], today: number, limit: number|null, perDay: number,
 *           labels: HTMLElement, text: { today: string, limit: string, end: string } }} data
 *   today: último día con datos reales (los siguientes se dibujan como proyección).
 */
export function mountColumns(canvas, { days, today, limit, perDay, labels, text }) {
  return mountScene(canvas, (THREE, { scene, colors }) => {
    scene.add(new THREE.AmbientLight(0xffffff, colors.dark ? 0.75 : 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(4, 7, 5);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);

    const n = days.length;
    const lastReal = days[Math.min(today, n) - 1]?.cumulative ?? 0;
    const projected = (d) => lastReal + Math.max(0, d - today) * perDay;
    const top = Math.max(limit ?? 0, projected(n), lastReal, 1);
    const scaleY = 3.2 / top;
    const step = 0.3;
    const x0 = -((n - 1) * step) / 2;
    const edges = new THREE.LineBasicMaterial({ color: colors.line });
    const ghost = new THREE.LineBasicMaterial({ color: colors.muted, transparent: true, opacity: 0.55 });
    const group = new THREE.Group();
    scene.add(group);

    days.forEach(({ day, cumulative }) => {
      const real = day <= today;
      const value = real ? cumulative : projected(day);
      const height = Math.max(0.02, value * scaleY);
      const geo = new THREE.BoxGeometry(0.2, height, 0.2);
      const x = x0 + (day - 1) * step;
      if (real) {
        const isToday = day === today;
        const mesh = new THREE.Mesh(
          geo,
          new THREE.MeshStandardMaterial({
            color: isToday ? colors.accent : colors.past,
            roughness: 0.45,
            metalness: 0.15,
            emissive: isToday && colors.dark ? colors.accent : 0x000000,
            emissiveIntensity: 0.35,
          }),
        );
        mesh.position.set(x, height / 2, 0);
        group.add(mesh);
      }
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geo), real ? edges : ghost);
      outline.position.set(x, height / 2, 0);
      group.add(outline);
    });

    const width = n * step + 0.4;
    if (limit) {
      const y = limit * scaleY;
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(width, 1.2),
        new THREE.MeshBasicMaterial({
          color: colors.ink,
          transparent: true,
          opacity: 0.05,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = y;
      group.add(plane);
      const rim = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, 1.2)),
        new THREE.LineBasicMaterial({ color: colors.muted }),
      );
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = y;
      group.add(rim);
      const pace = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x0, 0, 0.25),
          new THREE.Vector3(x0 + (n - 1) * step, y, 0.25),
        ]),
        new THREE.LineDashedMaterial({ color: colors.muted, dashSize: 0.08, gapSize: 0.08 }),
      );
      pace.computeLineDistances();
      group.add(pace);
    }
    group.add(new THREE.GridHelper(14, 28, colors.grid, colors.grid));

    const tag = (html) => {
      const el = document.createElement('span');
      el.className = 'label3d';
      el.innerHTML = html;
      labels.append(el);
      return el;
    };
    labels.replaceChildren();
    const lToday = today >= 1 ? tag(text.today) : null;
    const lLimit = limit ? tag(text.limit) : null;
    const lEnd = today < n ? tag(text.end) : null;

    return {
      camera,
      update(t, { size }) {
        const a = -0.5 + Math.sin(t * 0.3) * 0.12;
        camera.position.set(Math.sin(a) * 10.5, 3.2, Math.cos(a) * 10.5);
        camera.lookAt(0.3, 1.1, 0);
        if (lToday)
          placeLabel(lToday, new THREE.Vector3(x0 + (today - 1) * step, lastReal * scaleY + 0.25, 0), camera, size);
        if (lLimit) placeLabel(lLimit, new THREE.Vector3(x0 + 9 * step, limit * scaleY + 0.05, 0.6), camera, size);
        if (lEnd)
          placeLabel(lEnd, new THREE.Vector3(x0 + (n - 1) * step, projected(n) * scaleY + 0.25, 0), camera, size);
      },
    };
  });
}
