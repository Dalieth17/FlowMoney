// Gráficos en SVG puro (sin librerías): dona y barras agrupadas.
// Devuelven cadenas SVG; todo texto variable pasa por esc().

import { money, compact } from '../core/format.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * Dona por categorías.
 * @param {Array<{label:string,value:number,color:string}>} data
 * @param {{size?:number, total?:number, centerTop?:string, centerBottom?:string}} opts
 */
export function donut(data, opts = {}) {
  const size = opts.size || 220;
  const r = size / 2 - 14;
  const cx = size / 2,
    cy = size / 2;
  const stroke = 26;
  const circ = 2 * Math.PI * r;
  const total = opts.total != null ? opts.total : data.reduce((a, d) => a + d.value, 0);

  if (!total) {
    return `<svg viewBox="0 0 ${size} ${size}" class="donut" role="img" aria-label="Sin datos">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--line-soft)" stroke-width="${stroke}"/>
      <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" class="donut-empty">Sin gastos</text>
    </svg>`;
  }

  let offset = 0;
  const arcs = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const frac = d.value / total;
      const dash = frac * circ;
      const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color}" stroke-width="${stroke}"
        stroke-dasharray="${dash.toFixed(2)} ${(circ - dash).toFixed(2)}"
        stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt">
        <title>${esc(d.label)}: ${money(d.value)} (${Math.round(frac * 100)}%)</title></circle>`;
      offset += dash;
      return seg;
    })
    .join('');

  const top = opts.centerTop != null ? opts.centerTop : money(total);
  const bottom = opts.centerBottom != null ? opts.centerBottom : 'gastado';
  return `<svg viewBox="0 0 ${size} ${size}" class="donut" role="img" aria-label="Distribución de gastos por categoría">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--line-soft)" stroke-width="${stroke}"/>
    ${arcs}
    <text x="${cx}" y="${cy - 6}" text-anchor="middle" class="donut-top">${esc(top)}</text>
    <text x="${cx}" y="${cy + 15}" text-anchor="middle" class="donut-sub">${esc(bottom)}</text>
  </svg>`;
}

/**
 * Barras agrupadas ingresos/gastos por período (semana o mes).
 * @param {Array<{label:string, income:number, expense:number}>} data
 */
export function groupedBars(data, opts = {}) {
  const w = opts.width || 560;
  const h = opts.height || 240;
  const padL = 44,
    padR = 12,
    padT = 14,
    padB = 30;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));
  // escala "bonita" para la grilla
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const groups = data.length;
  const gw = innerW / groups;
  const bw = Math.min(26, gw / 3.2);
  const gap = 6;

  const y = (v) => padT + innerH - (v / top) * innerH;

  // grilla horizontal + etiquetas
  let grid = '';
  for (let v = 0; v <= top + 0.001; v += step) {
    const gy = y(v);
    grid += `<line x1="${padL}" y1="${gy.toFixed(1)}" x2="${w - padR}" y2="${gy.toFixed(1)}" class="grid"/>
      <text x="${padL - 8}" y="${(gy + 4).toFixed(1)}" text-anchor="end" class="axis">${compact(v)}</text>`;
  }

  let bars = '';
  data.forEach((d, i) => {
    const cx = padL + gw * i + gw / 2;
    const xInc = cx - bw - gap / 2;
    const xExp = cx + gap / 2;
    const hInc = padT + innerH - y(d.income);
    const hExp = padT + innerH - y(d.expense);
    bars += `<rect x="${xInc.toFixed(1)}" y="${y(d.income).toFixed(1)}" width="${bw}" height="${Math.max(0, hInc).toFixed(1)}" rx="4" class="bar-inc"><title>${esc(d.label)} · Ingresos ${money(d.income)}</title></rect>
      <rect x="${xExp.toFixed(1)}" y="${y(d.expense).toFixed(1)}" width="${bw}" height="${Math.max(0, hExp).toFixed(1)}" rx="4" class="bar-exp"><title>${esc(d.label)} · Gastos ${money(d.expense)}</title></rect>
      <text x="${cx.toFixed(1)}" y="${h - 10}" text-anchor="middle" class="axis">${esc(d.label)}</text>`;
  });

  return `<svg viewBox="0 0 ${w} ${h}" class="bars-svg" role="img" aria-label="Ingresos y gastos por período">
    ${grid}${bars}
  </svg>`;
}

function niceStep(max) {
  const raw = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return Math.max(1, mult * pow);
}
