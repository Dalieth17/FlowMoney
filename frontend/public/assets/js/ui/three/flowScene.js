// "El flujo": el dinero entra como un solo río de partículas y se abre en las categorías de gasto.
import { mountScene, placeLabel } from './scene3d.js';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ name: string, share: number }[]} streams  categorías (de mayor a menor) con su porcentaje
 * @param {HTMLElement} [labels] contenedor para las etiquetas de cada brazo
 */
export function mountFlow(canvas, streams, labels) {
  return mountScene(canvas, (THREE, { scene, colors }) => {
    const n = streams.length;
    scene.fog = new THREE.Fog(colors.canvas, 6, 15);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    const curve = new THREE.CatmullRomCurve3(
      [
        [-6.5, 0.7, -3.5],
        [-3.2, 0.2, -1.2],
        [0, -0.05, 0.3],
        [2.8, 0.1, 0.4],
        [5.8, -0.1, -1],
      ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    // Tonos del acento: el brazo más grande es el más intenso.
    const base = new THREE.Color(colors.accent);
    const bg = new THREE.Color(colors.canvas);
    const shade = (i) => base.clone().lerp(bg, (i / Math.max(1, n)) * 0.75);

    const COUNT = 4200;
    const seeds = Array.from({ length: COUNT }, (_, i) => ({
      u: Math.random(),
      oy: Math.random() - 0.5,
      oz: Math.random() - 0.5,
      c: i % n,
      v: 0.8 + Math.random() * 0.5,
    }));
    const positions = new Float32Array(COUNT * 3);
    const tint = new Float32Array(COUNT * 3);
    seeds.forEach((s, i) => tint.set(shade(s.c).toArray(), i * 3));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(tint, 3));
    scene.add(
      new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          size: 0.05,
          vertexColors: true,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
        }),
      ),
    );
    scene.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(curve, 200, 0.01, 6),
        new THREE.MeshBasicMaterial({ color: colors.accent, transparent: true, opacity: 0.5 }),
      ),
    );
    const grid = new THREE.GridHelper(40, 80, colors.grid, colors.grid);
    grid.position.y = -1.8;
    scene.add(grid);

    const fan = (c, u) => {
      const k = Math.max(0, (u - 0.55) / 0.45);
      return { y: (c - (n - 1) / 2) * k * k * 0.9, z: (c - (n - 1) / 2) * k * 0.25, squeeze: 1 - k * 0.6 };
    };
    const tags = labels
      ? streams.map((s) => {
          const el = document.createElement('span');
          el.className = 'label3d';
          el.innerHTML = `${s.name} <b>${s.share} %</b>`;
          labels.append(el);
          return el;
        })
      : [];

    const P = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const side = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    return {
      camera,
      update(t, { size }) {
        for (let i = 0; i < COUNT; i++) {
          const s = seeds[i];
          const u = (s.u + t * 0.045 * s.v) % 1;
          curve.getPointAt(u, P);
          curve.getTangentAt(u, tan);
          side.crossVectors(tan, up).normalize();
          const f = fan(s.c, u);
          const z = s.oz * 0.45 * f.squeeze + f.z;
          positions[i * 3] = P.x + side.x * z;
          positions[i * 3 + 1] = P.y + s.oy * 0.36 * f.squeeze + f.y;
          positions[i * 3 + 2] = P.z + side.z * z;
        }
        geo.attributes.position.needsUpdate = true;
        camera.position.set(0.4 + Math.sin(t * 0.25) * 0.35, 0.9, 6.6);
        camera.lookAt(2.3, 0.05, 0);
        tags.forEach((el, c) => {
          const end = curve.getPointAt(0.97);
          const f = fan(c, 0.97);
          placeLabel(el, new THREE.Vector3(end.x, end.y + f.y + 0.14, end.z + f.z), camera, size);
        });
      },
    };
  });
}
