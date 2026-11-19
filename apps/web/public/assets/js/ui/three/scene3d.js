// Infraestructura común de las escenas 3D (Three.js, en assets/vendor): carga perezosa,
// tamaño responsivo, bucle de animación y liberación del contexto WebGL cuando la vista cambia.
import { themeColor } from '../../core/theme.js';

let threePromise = null;
/** Three.js pesa ~650 KB: solo se descarga en las páginas que lo usan. */
export const loadThree = () => (threePromise ??= import('../../../vendor/three/three.module.min.js'));

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    const context = c.getContext('webgl2') || c.getContext('webgl');
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(context);
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
export async function mountScene(canvas, build, { animated = true } = {}) {
  const THREE = await loadThree();
  if (!canvas.isConnected) return () => {};
  let renderer, scene, observer, removalObserver;
  let frame = 0,
    disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    removalObserver?.disconnect();
    canvas.removeEventListener('webglcontextlost', dispose);
    const geometries = new Set(),
      materials = new Set();
    scene?.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      for (const material of [].concat(o.material ?? [])) materials.add(material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    renderer?.dispose();
    // La portada reutiliza el mismo canvas al cambiar el tema; no perder ese contexto.
    if (!canvas.isConnected) renderer?.forceContextLoss();
  };
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene = new THREE.Scene();
    const ctx = { scene, renderer, colors: palette(), size: { w: 1, h: 1 } };
    const { camera, update } = build(THREE, ctx);
    const still = !animated || reducedMotion();
    const t0 = performance.now();
    const draw = () => {
      if (disposed) return;
      if (!canvas.isConnected) return dispose();
      update(still ? 4 : (performance.now() - t0) / 1000, ctx);
      renderer.render(scene, camera);
    };
    const resize = () => {
      if (disposed) return;
      const w = canvas.clientWidth || 1,
        h = canvas.clientHeight || 1;
      ctx.size = { w, h };
      renderer.setSize(w, h, false);
      if (camera.isPerspectiveCamera) camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // También se redibuja al cambiar el tamaño con movimiento reducido o cámara fija.
      draw();
    };
    observer = new ResizeObserver(resize);
    observer.observe(canvas);
    removalObserver = new MutationObserver(() => {
      if (!canvas.isConnected) dispose();
    });
    removalObserver.observe(document.body, { childList: true, subtree: true });
    canvas.addEventListener('webglcontextlost', dispose);
    resize();
    if (!still) {
      const tick = () => {
        draw();
        if (!disposed) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }
    return dispose;
  } catch (err) {
    dispose();
    throw err;
  }
}

/** Posiciona una etiqueta HTML sobre un punto 3D. */
export function placeLabel(el, vector, camera, { w, h }) {
  const p = vector.clone().project(camera);
  el.style.left = `${((p.x + 1) / 2) * w}px`;
  el.style.top = `${((1 - p.y) / 2) * h}px`;
}
