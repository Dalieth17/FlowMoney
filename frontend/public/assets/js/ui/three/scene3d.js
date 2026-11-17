// Infraestructura común de las escenas 3D (Three.js, en assets/vendor): carga perezosa,
// tamaño responsivo, bucle de animación y liberación del contexto WebGL cuando la vista cambia.
import { themeColor } from '../../core/theme.js';

let threePromise = null;
/** Three.js pesa ~650 KB: solo se descarga en las páginas que lo usan. */
export const loadThree = () => (threePromise ??= import('../../../vendor/three/three.module.min.js'));

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Colores del tema actual como enteros que entiende Three.js. */
export function palette() {
  const hex = (name) => parseInt(themeColor(name).replace('#', ''), 16) || 0;
  return {
    canvas: hex('--paper'),
    ink: hex('--ink'),
    muted: hex('--muted'),
    accent: hex('--pine'),
    line: hex('--line'),
    grid: hex('--scene-grid'),
    past: hex('--scene-past'),
    dark: document.documentElement.dataset.theme !== 'mono',
  };
}

/**
 * Monta una escena sobre `canvas`. `build(THREE, ctx)` crea los objetos y devuelve
 * `{ camera, update(t) }`. Devuelve una función que libera todo; además se libera sola
 * cuando el canvas sale del documento (al cambiar de vista).
 */
export async function mountScene(canvas, build) {
  const THREE = await loadThree();
  if (!canvas.isConnected) return () => {};
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const ctx = { scene, renderer, colors: palette(), size: { w: 1, h: 1 } };
  const { camera, update } = build(THREE, ctx);

  const resize = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    ctx.size = { w, h };
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  const still = reducedMotion();
  const t0 = performance.now();
  let frame = 0;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    scene.traverse((o) => {
      o.geometry?.dispose();
      [].concat(o.material ?? []).forEach((m) => m.dispose());
    });
    renderer.dispose();
  };
  const tick = () => {
    if (!canvas.isConnected) return dispose();
    // Con "reducir movimiento" se dibuja un cuadro fijo y la escena no se anima.
    update(still ? 4 : (performance.now() - t0) / 1000, ctx);
    renderer.render(scene, camera);
    if (!still) frame = requestAnimationFrame(tick);
  };
  tick();
  return dispose;
}

/** Posiciona una etiqueta HTML sobre un punto 3D. */
export function placeLabel(el, vector, camera, { w, h }) {
  const p = vector.clone().project(camera);
  el.style.left = `${((p.x + 1) / 2) * w}px`;
  el.style.top = `${((1 - p.y) / 2) * h}px`;
}
