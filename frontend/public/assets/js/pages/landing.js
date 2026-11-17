// Punto de entrada de index.html: selector de tema y el río 3D del hero.
import { mountThemeSwitches, THEME_EVENT } from '../core/theme.js';
import { webglAvailable } from '../ui/three/scene3d.js';
import { mountFlow } from '../ui/three/flowScene.js';

// Reparto de un mes de ejemplo (el mismo que se siembra al crear una cuenta en pesos).
const SAMPLE = [
  { name: 'Alimentación', share: 37 },
  { name: 'Servicios', share: 23 },
  { name: 'Transporte', share: 18 },
  { name: 'Salud', share: 15 },
  { name: 'Entretenimiento', share: 7 },
];

mountThemeSwitches();

const river = document.querySelector('.river');
const canvas = river?.querySelector('canvas.flow3d');
if (river && canvas && webglAvailable()) {
  river.classList.add('has-3d');
  river.querySelector('.river-head').after(canvas);
  river.querySelector('.ttl').textContent = 'Así se reparte tu dinero';
  river.querySelector('.sub').textContent = 'Cada punto es dinero que entra y sigue a su categoría';
  const labels = document.createElement('div');
  labels.className = 'flow-labels';
  river.append(labels);

  let dispose = () => {};
  const draw = async () => {
    dispose();
    labels.replaceChildren();
    dispose = await mountFlow(canvas, SAMPLE, labels);
  };
  draw();
  // El 3D toma sus colores del tema: se vuelve a montar al cambiarlo.
  document.addEventListener(THEME_EVENT, draw);
}
