export const CHART_STYLE_EVENT = 'flowmoney:chart-style';
export const CHART_STYLES = Object.freeze([
  { id: '2d', label: '2D · Claro y sencillo', description: 'Barras y gráfico circular planos, con lectura directa.' },
  {
    id: '3d',
    label: '3D · Inmersivo',
    description: 'Columnas con profundidad y un anillo de categorías en volumen. Puedes girar la vista.',
  },
]);
const valid = (value) => CHART_STYLES.some((style) => style.id === value);
export function getChartStyle() {
  if (typeof document === 'undefined') return '2d';
  const current = document.documentElement.dataset.chartStyle;
  if (valid(current)) return current;
  try {
    const saved = localStorage.getItem('flowmoney.chartStyle');
    if (valid(saved)) return saved;
  } catch {
    /* almacenamiento opcional */
  }
  return '2d';
}
export function setChartStyle(value) {
  if (!valid(value) || value === getChartStyle()) return;
  document.documentElement.dataset.chartStyle = value;
  document.querySelectorAll('input[name="chartStyle"]').forEach((input) => {
    input.checked = input.value === value;
  });
  try {
    localStorage.setItem('flowmoney.chartStyle', value);
  } catch {
    /* dura en esta página */
  }
  document.dispatchEvent(new CustomEvent(CHART_STYLE_EVENT, { detail: value }));
}
